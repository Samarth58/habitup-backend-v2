const { pool } = require('./db');

/**
 * Generates a concise, deterministic title from the first user message without AI calls.
 *
 * @param {string} message
 * @returns {string} Clean title string (max 60 chars)
 */
function generateConversationTitle(message) {
  if (!message || typeof message !== 'string') return 'New Conversation';
  let clean = message.trim().replace(/^[\s\r\n]+|[\s\r\n]+$/g, '');

  // Strip common conversational question prefixes
  clean = clean.replace(
    /^(can you tell me|can you help me with|how do i|how can i|please help me with|what is the best way to|tell me how to)\s+/i,
    ''
  );

  // Capitalize first character
  clean = clean.charAt(0).toUpperCase() + clean.slice(1);

  // Strip trailing punctuation
  clean = clean.replace(/[?.!]+$/, '');

  // Truncate to maximum 60 characters
  if (clean.length > 60) {
    clean = clean.slice(0, 57).trim() + '...';
  }

  return clean || 'New Conversation';
}

/**
 * Creates a new conversation for a user.
 *
 * @param {string} userId
 * @param {string} title
 * @returns {Promise<object>} Created conversation record
 */
async function createConversation(userId, title) {
  const cleanTitle = title || 'New Conversation';
  const { rows } = await pool.query(
    `INSERT INTO ai_conversations (user_id, title)
     VALUES ($1, $2)
     RETURNING id, user_id, title, created_at, updated_at`,
    [userId, cleanTitle]
  );
  return rows[0];
}

/**
 * Retrieves a single conversation by ID for an authenticated user.
 *
 * @param {string} userId
 * @param {string} conversationId
 * @returns {Promise<object|null>}
 */
async function getConversationById(userId, conversationId) {
  const { rows } = await pool.query(
    `SELECT id, user_id, title, created_at, updated_at
     FROM ai_conversations
     WHERE id = $1 AND user_id = $2`,
    [conversationId, userId]
  );
  return rows[0] || null;
}

/**
 * Lists all conversations belonging to an authenticated user ordered newest updated first.
 *
 * @param {string} userId
 * @returns {Promise<Array<object>>}
 */
async function listConversations(userId) {
  const { rows } = await pool.query(
    `SELECT id, title, created_at, updated_at
     FROM ai_conversations
     WHERE user_id = $1
     ORDER BY updated_at DESC`,
    [userId]
  );

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

/**
 * Retrieves a conversation and all its associated messages for an authenticated user.
 *
 * @param {string} userId
 * @param {string} conversationId
 * @returns {Promise<object|null>} Conversation with messages or null if not found/unauthorized
 */
async function getConversationWithMessages(userId, conversationId) {
  const conversation = await getConversationById(userId, conversationId);
  if (!conversation) {
    return null;
  }

  const { rows: messages } = await pool.query(
    `SELECT id, role, content, created_at
     FROM ai_messages
     WHERE conversation_id = $1
     ORDER BY created_at ASC`,
    [conversationId]
  );

  return {
    id: conversation.id,
    title: conversation.title,
    createdAt: conversation.created_at,
    updatedAt: conversation.updated_at,
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.created_at,
    })),
  };
}

/**
 * Deletes a conversation owned by the authenticated user (cascades to messages).
 *
 * @param {string} userId
 * @param {string} conversationId
 * @returns {Promise<boolean>} True if deleted, false if not found
 */
async function deleteConversation(userId, conversationId) {
  const { rowCount } = await pool.query(
    `DELETE FROM ai_conversations
     WHERE id = $1 AND user_id = $2`,
    [conversationId, userId]
  );
  return rowCount > 0;
}

/**
 * Appends a message to a conversation and touches updated_at on the conversation.
 *
 * @param {string} conversationId
 * @param {'user'|'assistant'} role
 * @param {string} content
 * @returns {Promise<object>} Created message record
 */
async function addMessage(conversationId, role, content) {
  const { rows } = await pool.query(
    `INSERT INTO ai_messages (conversation_id, role, content)
     VALUES ($1, $2, $3)
     RETURNING id, conversation_id, role, content, created_at`,
    [conversationId, role, content]
  );

  await pool.query(
    `UPDATE ai_conversations
     SET updated_at = NOW()
     WHERE id = $1`,
    [conversationId]
  );

  return rows[0];
}

/**
 * Atomically inserts both user message and assistant reply within a database transaction.
 * Ensures the conversation updated_at timestamp is touched and prevents orphaned messages.
 *
 * @param {string} conversationId
 * @param {string} userContent
 * @param {string} assistantContent
 * @returns {Promise<{ userMessage: object, assistantMessage: object }>}
 */
async function addMessagePair(conversationId, userContent, assistantContent) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userRes = await client.query(
      `INSERT INTO ai_messages (conversation_id, role, content)
       VALUES ($1, 'user', $2)
       RETURNING id, conversation_id, role, content, created_at`,
      [conversationId, userContent]
    );

    const assistantRes = await client.query(
      `INSERT INTO ai_messages (conversation_id, role, content)
       VALUES ($1, 'assistant', $2)
       RETURNING id, conversation_id, role, content, created_at`,
      [conversationId, assistantContent]
    );

    await client.query(
      `UPDATE ai_conversations
       SET updated_at = NOW()
       WHERE id = $1`,
      [conversationId]
    );

    await client.query('COMMIT');

    return {
      userMessage: userRes.rows[0],
      assistantMessage: assistantRes.rows[0],
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Loads the latest messages window for a conversation bounded by message count and total character size.
 *
 * @param {string} conversationId
 * @param {number} [limit=10] Max messages to retrieve
 * @param {number} [maxTotalChars=8000] Max combined character limit
 * @returns {Promise<Array<{ role: string, content: string }>>}
 */
async function getRecentMessagesForGemini(conversationId, limit = 10, maxTotalChars = 8000) {
  const { rows } = await pool.query(
    `SELECT role, content, created_at
     FROM (
       SELECT role, content, created_at
       FROM ai_messages
       WHERE conversation_id = $1
       ORDER BY created_at DESC
       LIMIT $2
     ) sub
     ORDER BY created_at ASC`,
    [conversationId, limit]
  );

  // Enforce total character size bound starting from the newest
  const reversed = [...rows].reverse();
  let totalChars = 0;
  const filtered = [];

  for (const msg of reversed) {
    if (totalChars + msg.content.length > maxTotalChars) {
      break;
    }
    totalChars += msg.content.length;
    filtered.unshift(msg);
  }

  return filtered.map((m) => ({
    role: m.role,
    content: m.content,
  }));
}

module.exports = {
  generateConversationTitle,
  createConversation,
  getConversationById,
  listConversations,
  getConversationWithMessages,
  deleteConversation,
  addMessage,
  addMessagePair,
  getRecentMessagesForGemini,
};

