const { generateAIResponse } = require('../services/aiService');
const { getAIUserContext } = require('../services/aiContextService');
const {
  generateConversationTitle,
  createConversation,
  getConversationById,
  listConversations,
  getConversationWithMessages,
  deleteConversation,
  addMessage,
  addMessagePair,
  getRecentMessagesForGemini,
} = require('../services/aiConversationService');

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_MESSAGES = 10;
const MAX_HISTORY_MESSAGE_LENGTH = 2000;
const MAX_TOTAL_HISTORY_LENGTH = 8000;

const ALLOWED_ROLES = new Set(['user', 'assistant', 'model']);

/**
 * Validates the history payload and returns sanitized history or throws a 400 error.
 *
 * @param {any} history
 * @returns {Array<{ role: string, content: string }>}
 */
function validateAndSanitizeHistory(history) {
  if (history === undefined || history === null) {
    return [];
  }

  if (!Array.isArray(history)) {
    const error = new Error('History must be an array.');
    error.status = 400;
    throw error;
  }

  if (history.length > MAX_HISTORY_MESSAGES) {
    const error = new Error(`History exceeds maximum limit of ${MAX_HISTORY_MESSAGES} messages.`);
    error.status = 400;
    throw error;
  }

  let totalLength = 0;
  const sanitized = [];

  for (let i = 0; i < history.length; i++) {
    const item = history[i];

    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      const error = new Error(`History message at index ${i} must be an object.`);
      error.status = 400;
      throw error;
    }

    const { role, content } = item;

    if (!role || typeof role !== 'string' || !ALLOWED_ROLES.has(role.trim().toLowerCase())) {
      const error = new Error(
        `History message at index ${i} has invalid role "${role}". Allowed roles are "user" and "assistant".`
      );
      error.status = 400;
      throw error;
    }

    if (!content || typeof content !== 'string' || !content.trim()) {
      const error = new Error(`History message at index ${i} must contain non-empty string content.`);
      error.status = 400;
      throw error;
    }

    const trimmedContent = content.trim();

    if (trimmedContent.length > MAX_HISTORY_MESSAGE_LENGTH) {
      const error = new Error(
        `History message at index ${i} exceeds maximum allowed length of ${MAX_HISTORY_MESSAGE_LENGTH} characters.`
      );
      error.status = 400;
      throw error;
    }

    totalLength += trimmedContent.length;
    if (totalLength > MAX_TOTAL_HISTORY_LENGTH) {
      const error = new Error(
        `Total conversation history exceeds maximum allowed limit of ${MAX_TOTAL_HISTORY_LENGTH} characters.`
      );
      error.status = 400;
      throw error;
    }

    const normalizedRole = role.trim().toLowerCase() === 'model' ? 'assistant' : role.trim().toLowerCase();

    sanitized.push({
      role: normalizedRole,
      content: trimmedContent,
    });
  }

  return sanitized;
}

/**
 * POST /ai/chat
 * Handles user chat requests to the HabitUp AI Coach with persistent conversation history support.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function handleAIChat(req, res) {
  const { message, conversationId, history } = req.body || {};

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Message is required and must be a non-empty string.' });
  }

  const trimmedMessage = message.trim();

  if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({
      error: `Message exceeds maximum allowed length of ${MAX_MESSAGE_LENGTH} characters.`,
    });
  }

  if (conversationId !== undefined && conversationId !== null) {
    if (typeof conversationId !== 'string' || !UUID_REGEX.test(conversationId)) {
      return res.status(400).json({ error: 'Invalid conversation ID format.' });
    }
  }

  let sanitizedClientHistory = [];
  if (history !== undefined) {
    try {
      sanitizedClientHistory = validateAndSanitizeHistory(history);
    } catch (validationErr) {
      return res.status(validationErr.status || 400).json({ error: validationErr.message });
    }
  }

  try {
    let conversation;

    if (conversationId) {
      conversation = await getConversationById(req.userId, conversationId);
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found.' });
      }
    } else {
      const title = generateConversationTitle(trimmedMessage);
      conversation = await createConversation(req.userId, title);
    }

    // 1. Load recent conversation history before current user message
    let recentHistory = await getRecentMessagesForGemini(
      conversation.id,
      MAX_HISTORY_MESSAGES,
      MAX_TOTAL_HISTORY_LENGTH
    );

    // If client supplied ephemeral history and DB has none yet, use client history
    if (recentHistory.length === 0 && sanitizedClientHistory.length > 0) {
      recentHistory = sanitizedClientHistory;
    }

    // 2. Load user context and generate AI response
    const userContext = await getAIUserContext(req.userId);
    const reply = await generateAIResponse(trimmedMessage, userContext, recentHistory);

    // 3. Atomically persist both user message and assistant reply to DB
    await addMessagePair(conversation.id, trimmedMessage, reply);

    return res.status(200).json({
      conversationId: conversation.id,
      reply,
    });
  } catch (err) {
    console.error('[aiController] Chat error:', err.message || 'Unknown error');
    const status = err.status || 500;
    const errorMessage = err.isSafe ? err.message : 'Failed to generate AI response.';
    return res.status(status).json({ error: errorMessage });
  }
}

/**
 * GET /ai/conversations
 * Lists all conversations for the authenticated user.
 */
async function getUserConversations(req, res) {
  try {
    const conversations = await listConversations(req.userId);
    return res.status(200).json({ conversations });
  } catch (err) {
    console.error('[getUserConversations] Error:', err.message || err);
    return res.status(500).json({ error: 'Failed to retrieve conversations.' });
  }
}

/**
 * GET /ai/conversations/:conversationId
 * Retrieves a conversation and its messages for the authenticated user.
 */
async function getConversationDetails(req, res) {
  try {
    const conversation = await getConversationWithMessages(req.userId, req.params.conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }
    return res.status(200).json({ conversation });
  } catch (err) {
    console.error('[getConversationDetails] Error:', err.message || err);
    return res.status(500).json({ error: 'Failed to retrieve conversation details.' });
  }
}

/**
 * DELETE /ai/conversations/:conversationId
 * Deletes a conversation owned by the authenticated user.
 */
async function deleteUserConversation(req, res) {
  try {
    const deleted = await deleteConversation(req.userId, req.params.conversationId);
    if (!deleted) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }
    return res.status(200).json({ message: 'Conversation deleted successfully.' });
  } catch (err) {
    console.error('[deleteUserConversation] Error:', err.message || err);
    return res.status(500).json({ error: 'Failed to delete conversation.' });
  }
}

module.exports = {
  handleAIChat,
  getUserConversations,
  getConversationDetails,
  deleteUserConversation,
  validateAndSanitizeHistory,
  MAX_MESSAGE_LENGTH,
  MAX_HISTORY_MESSAGES,
  MAX_HISTORY_MESSAGE_LENGTH,
  MAX_TOTAL_HISTORY_LENGTH,
};
