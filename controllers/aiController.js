const { generateAIResponse } = require('../services/aiService');
const { getAIUserContext } = require('../services/aiContextService');

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
 * Handles user chat requests to the HabitUp AI Coach by retrieving user habits/streaks context and generating an AI response.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function handleAIChat(req, res) {
  const { message, history } = req.body || {};

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Message is required and must be a non-empty string.' });
  }

  const trimmedMessage = message.trim();

  if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({
      error: `Message exceeds maximum allowed length of ${MAX_MESSAGE_LENGTH} characters.`,
    });
  }

  let sanitizedHistory;
  try {
    sanitizedHistory = validateAndSanitizeHistory(history);
  } catch (validationErr) {
    return res.status(validationErr.status || 400).json({ error: validationErr.message });
  }

  try {
    const userContext = await getAIUserContext(req.userId);
    const reply = await generateAIResponse(trimmedMessage, userContext, sanitizedHistory);

    return res.status(200).json({ reply });
  } catch (err) {
    console.error('[aiController] Chat error:', err.message || 'Unknown error');
    const status = err.status || 500;
    const errorMessage = err.isSafe ? err.message : 'Failed to generate AI response.';
    return res.status(status).json({ error: errorMessage });
  }
}

module.exports = {
  handleAIChat,
  validateAndSanitizeHistory,
  MAX_MESSAGE_LENGTH,
  MAX_HISTORY_MESSAGES,
  MAX_HISTORY_MESSAGE_LENGTH,
  MAX_TOTAL_HISTORY_LENGTH,
};
