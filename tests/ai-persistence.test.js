require('dotenv').config();
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const { pool } = require('../services/db');
const {
  createConversation,
  addMessage,
  getConversationWithMessages,
  deleteConversation,
  getRecentMessagesForGemini,
  listConversations,
} = require('../services/aiConversationService');
const { createHabit, addCompletion } = require('../services/habitService');

describe('AI Persistent Conversations & Chat History', () => {
  let server;
  let baseUrl;
  let userAId;
  let userBId;
  let tokenA;
  let tokenB;

  before(async () => {
    // 1. Start test Express app with /ai routes
    const app = express();
    app.use(cors());
    app.use(express.json());
    app.use('/ai', require('../routes/ai'));

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    // 2. Create two test users in PostgreSQL
    const ts = Date.now();
    const userAInsert = await pool.query(
      `INSERT INTO users (name, email, username, password_hash, timezone, preferred_language)
       VALUES ('User A', $1, $2, 'hash_a', 'UTC', 'en')
       RETURNING id`,
      [`ai_user_a_${ts}@example.com`, `user_a_${ts.toString().slice(-6)}`]
    );
    userAId = userAInsert.rows[0].id;

    const userBInsert = await pool.query(
      `INSERT INTO users (name, email, username, password_hash, timezone, preferred_language)
       VALUES ('User B', $1, $2, 'hash_b', 'UTC', 'en')
       RETURNING id`,
      [`ai_user_b_${ts}@example.com`, `user_b_${ts.toString().slice(-6)}`]
    );
    userBId = userBInsert.rows[0].id;

    tokenA = jwt.sign({ sub: userAId, email: `ai_user_a_${ts}@example.com` }, process.env.JWT_ACCESS_SECRET, {
      expiresIn: '1h',
    });
    tokenB = jwt.sign({ sub: userBId, email: `ai_user_b_${ts}@example.com` }, process.env.JWT_ACCESS_SECRET, {
      expiresIn: '1h',
    });

    // Add a habit for User A
    const habit = await createHabit(userAId, { name: 'Morning Meditation', frequency_type: 'daily' });
    await addCompletion(userAId, habit.id, 'UTC');
  });

  after(async () => {
    if (userAId) {
      await pool.query('DELETE FROM ai_conversations WHERE user_id = $1', [userAId]);
      await pool.query('DELETE FROM habit_completions WHERE user_id = $1', [userAId]);
      await pool.query('DELETE FROM habits WHERE user_id = $1', [userAId]);
      await pool.query('DELETE FROM users WHERE id = $1', [userAId]);
    }
    if (userBId) {
      await pool.query('DELETE FROM ai_conversations WHERE user_id = $1', [userBId]);
      await pool.query('DELETE FROM users WHERE id = $1', [userBId]);
    }
    if (server) {
      server.close();
    }
  });

  test('1. Unauthenticated requests to /ai routes return 401', async () => {
    const res1 = await fetch(`${baseUrl}/ai/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'Hi' }) });
    assert.equal(res1.status, 401);

    const res2 = await fetch(`${baseUrl}/ai/conversations`);
    assert.equal(res2.status, 401);
  });

  test('2. Invalid conversation UUID format returns 400', async () => {
    const res = await fetch(`${baseUrl}/ai/conversations/not-a-uuid`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(res.status, 400);
  });

  test('3. Direct conversation creation, message persistence, and listing', async () => {
    const conv = await createConversation(userAId, 'Reading Routine');
    assert.ok(conv.id);
    assert.equal(conv.title, 'Reading Routine');

    // Add user message and assistant reply
    const userMsg = await addMessage(conv.id, 'user', 'How can I read 20 pages daily?');
    assert.equal(userMsg.role, 'user');
    assert.equal(userMsg.content, 'How can I read 20 pages daily?');

    const botMsg = await addMessage(conv.id, 'assistant', 'Set a dedicated 15-minute slot before bed.');
    assert.equal(botMsg.role, 'assistant');

    // Verify GET /ai/conversations
    const listRes = await fetch(`${baseUrl}/ai/conversations`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(listRes.status, 200);
    const listBody = await listRes.json();
    assert.ok(Array.isArray(listBody.conversations));
    assert.ok(listBody.conversations.some((c) => c.id === conv.id && c.title === 'Reading Routine'));

    // Verify GET /ai/conversations/:conversationId
    const detailsRes = await fetch(`${baseUrl}/ai/conversations/${conv.id}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(detailsRes.status, 200);
    const detailsBody = await detailsRes.json();
    assert.equal(detailsBody.conversation.id, conv.id);
    assert.equal(detailsBody.conversation.messages.length, 2);
    assert.equal(detailsBody.conversation.messages[0].role, 'user');
    assert.equal(detailsBody.conversation.messages[1].role, 'assistant');
  });

  test('4. Cross-user isolation: User B cannot access User A conversation', async () => {
    const convA = await createConversation(userAId, 'Secret Conversation A');
    await addMessage(convA.id, 'user', 'User A private note');

    // User B tries to read User A's conversation
    const getRes = await fetch(`${baseUrl}/ai/conversations/${convA.id}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.equal(getRes.status, 404);

    // User B tries to delete User A's conversation
    const deleteRes = await fetch(`${baseUrl}/ai/conversations/${convA.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.equal(deleteRes.status, 404);

    // Verify User A's conversation still exists
    const checkConv = await getConversationWithMessages(userAId, convA.id);
    assert.ok(checkConv);
  });

  test('5. Delete conversation deletes conversation and cascades to messages', async () => {
    const conv = await createConversation(userAId, 'To Delete');
    await addMessage(conv.id, 'user', 'Temporary message');

    const delRes = await fetch(`${baseUrl}/ai/conversations/${conv.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(delRes.status, 200);

    const checkRes = await fetch(`${baseUrl}/ai/conversations/${conv.id}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(checkRes.status, 404);
  });

  test('6. getRecentMessagesForGemini respects max count and character bounds', async () => {
    const conv = await createConversation(userAId, 'Window Bound Test');

    // Insert 15 messages
    for (let i = 1; i <= 15; i++) {
      await addMessage(conv.id, i % 2 === 1 ? 'user' : 'assistant', `Message ${i}`);
    }

    // Limit to 10
    const recent = await getRecentMessagesForGemini(conv.id, 10, 8000);
    assert.equal(recent.length, 10);
    assert.equal(recent[0].content, 'Message 6');
    assert.equal(recent[9].content, 'Message 15');

    // Test total character bound
    const tight = await getRecentMessagesForGemini(conv.id, 10, 25);
    // Each message is ~9-10 chars. 25 chars allows ~2 messages.
    assert.ok(tight.length <= 3);
  });

  test('7. POST /ai/chat with non-existent conversationId returns 404', async () => {
    const fakeUuid = '00000000-0000-0000-0000-000000000000';
    const res = await fetch(`${baseUrl}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ conversationId: fakeUuid, message: 'Hello' }),
    });
    assert.equal(res.status, 404);
  });
});
