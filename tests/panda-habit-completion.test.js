require('dotenv').config();
const { test, describe, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { pool } = require('../services/db');
const firebaseService = require('../services/firebaseService');
const notificationService = require('../services/notificationService');
const habitRoutes = require('../routes/habits');
const {
  PANDA_STATES,
  determinePandaState,
} = require('../services/pandaNotificationService');

describe('Panda Notifications & Habit Completion Integration Tests', () => {
  let server;
  let baseUrl;
  const createdUserIds = [];

  before(async () => {
    // 1. Start isolated Express app for testing habit routes
    const app = express();
    app.use(cors());
    app.use(express.json());
    app.use((req, res, next) => {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
          const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
          req.userId = decoded.sub;
          req.user = decoded;
        } catch (_) {}
      }
      next();
    });
    app.use('/habits', habitRoutes);

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    for (const uid of createdUserIds) {
      await pool.query('DELETE FROM notification_deliveries WHERE user_id = $1', [uid]);
      await pool.query('DELETE FROM device_tokens WHERE user_id = $1', [uid]);
      await pool.query('DELETE FROM habit_completions WHERE user_id = $1', [uid]);
      await pool.query('DELETE FROM habits WHERE user_id = $1', [uid]);
      await pool.query('DELETE FROM users WHERE id = $1', [uid]);
    }
    if (server) {
      server.close();
    }
    mock.restoreAll();
  });

  async function createTestUser(prefix = 'user') {
    const ts = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const email = `${prefix}_${ts}@example.com`;
    const userRes = await pool.query(
      `INSERT INTO users (name, email, username, password_hash, timezone, preferred_language)
       VALUES ($1, $2, $3, 'dummy_hash', 'UTC', 'en')
       RETURNING id`,
      [`Test ${prefix}`, email, `${prefix}_${ts.slice(-6)}`]
    );
    const userId = userRes.rows[0].id;
    createdUserIds.push(userId);
    const token = jwt.sign({ sub: userId, email }, process.env.JWT_ACCESS_SECRET, { expiresIn: '1h' });
    return { userId, token };
  }

  test('All 6 Panda Habit Completion Integration Requirements', async () => {
    mock.method(firebaseService, 'isFirebaseConfigured', () => true);

    const sentNotifications = [];
    mock.method(notificationService, 'sendPushNotification', async (fcmToken, payload) => {
      sentNotifications.push({ fcmToken, payload });
      return { success: true, messageId: `msg_${sentNotifications.length}` };
    });

    async function waitForNotification(fcmToken, maxWaitMs = 2000) {
      const start = Date.now();
      while (Date.now() - start < maxWaitMs) {
        const found = sentNotifications.find((n) => n.fcmToken === fcmToken);
        if (found) return found;
        await new Promise((r) => setTimeout(r, 50));
      }
      return sentNotifications.find((n) => n.fcmToken === fcmToken);
    }

    // =========================================================================
    // Requirement 1: Normal habit completion -> happy notification
    // =========================================================================
    const user1 = await createTestUser('req1');
    const token1 = `token-user1-${user1.userId}`;
    await pool.query(
      `INSERT INTO device_tokens (user_id, token, platform, timezone) VALUES ($1, $2, 'android', 'UTC')`,
      [user1.userId, token1]
    );

    // Create 2 habits
    const h1Res = await fetch(`${baseUrl}/habits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user1.token}` },
      body: JSON.stringify({ name: 'User1 Habit A', frequency_type: 'daily' }),
    });
    const { habit: h1 } = await h1Res.json();

    await fetch(`${baseUrl}/habits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user1.token}` },
      body: JSON.stringify({ name: 'User1 Habit B', frequency_type: 'daily' }),
    });

    // Complete Habit A (leaves Habit B remaining)
    const complete1Res = await fetch(`${baseUrl}/habits/${h1.id}/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${user1.token}` },
    });
    assert.equal(complete1Res.status, 201);
    const c1Body = await complete1Res.json();
    assert.ok(c1Body.completion);
    assert.equal(c1Body.streak, 1);

    const u1Push = await waitForNotification(token1);
    assert.ok(u1Push, 'Happy notification must be sent');
    assert.equal(u1Push.payload.data.pandaEmotion, PANDA_STATES.HAPPY);
    assert.equal(u1Push.payload.body, 'Great job! You completed your habit. Keep going!');

    // =========================================================================
    // Requirement 2: Completing the final remaining habit -> celebrating notification
    // =========================================================================
    const user2 = await createTestUser('req2');
    const token2 = `token-user2-${user2.userId}`;
    await pool.query(
      `INSERT INTO device_tokens (user_id, token, platform, timezone) VALUES ($1, $2, 'android', 'UTC')`,
      [user2.userId, token2]
    );

    // Exactly 1 habit
    const h2Res = await fetch(`${baseUrl}/habits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user2.token}` },
      body: JSON.stringify({ name: 'User2 Solo Habit', frequency_type: 'daily' }),
    });
    const { habit: h2 } = await h2Res.json();

    const complete2Res = await fetch(`${baseUrl}/habits/${h2.id}/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${user2.token}` },
    });
    assert.equal(complete2Res.status, 201);

    const u2Push = await waitForNotification(token2);
    assert.ok(u2Push, 'Celebrating notification must be sent');
    assert.equal(u2Push.payload.data.pandaEmotion, PANDA_STATES.CELEBRATING);
    assert.equal(u2Push.payload.body, "Amazing! You've completed all your habits for today!");

    // =========================================================================
    // Requirement 3: Streak milestone reached -> excited notification
    // =========================================================================
    const user3 = await createTestUser('req3');
    const token3 = `token-user3-${user3.userId}`;
    await pool.query(
      `INSERT INTO device_tokens (user_id, token, platform, timezone) VALUES ($1, $2, 'android', 'UTC')`,
      [user3.userId, token3]
    );

    const h3aRes = await fetch(`${baseUrl}/habits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user3.token}` },
      body: JSON.stringify({ name: 'User3 Milestone Habit', frequency_type: 'daily' }),
    });
    const { habit: h3a } = await h3aRes.json();

    await fetch(`${baseUrl}/habits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user3.token}` },
      body: JSON.stringify({ name: 'User3 Habit B', frequency_type: 'daily' }),
    });

    // Backfill 2 prior completions so today's completion makes streak 3
    const d1 = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
    const d2 = new Date(Date.now() - 1 * 86400000).toISOString().slice(0, 10);
    await pool.query(
      `INSERT INTO habit_completions (habit_id, user_id, completion_date) VALUES ($1, $2, $3), ($1, $2, $4)`,
      [h3a.id, user3.userId, d1, d2]
    );

    const complete3Res = await fetch(`${baseUrl}/habits/${h3a.id}/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${user3.token}` },
    });
    assert.equal(complete3Res.status, 201);
    const c3Body = await complete3Res.json();
    assert.equal(c3Body.streak, 3);

    const u3Push = await waitForNotification(token3);
    assert.ok(u3Push, 'Excited notification must be sent');
    assert.equal(u3Push.payload.data.pandaEmotion, PANDA_STATES.EXCITED);
    assert.equal(u3Push.payload.body, 'Amazing! You reached a new streak milestone!');

    // =========================================================================
    // Requirement 4: User without active device token -> no push sent
    // =========================================================================
    const user4 = await createTestUser('req4');

    const h4Res = await fetch(`${baseUrl}/habits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user4.token}` },
      body: JSON.stringify({ name: 'User4 No Token Habit', frequency_type: 'daily' }),
    });
    const { habit: h4 } = await h4Res.json();

    const beforeCount = sentNotifications.length;
    const complete4Res = await fetch(`${baseUrl}/habits/${h4.id}/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${user4.token}` },
    });
    assert.equal(complete4Res.status, 201);

    await new Promise((r) => setTimeout(r, 200));
    assert.equal(sentNotifications.length, beforeCount, 'No push must be dispatched for user without tokens');

    // =========================================================================
    // Requirement 5: FCM failure -> habit completion still succeeds with 201
    // =========================================================================
    const user5 = await createTestUser('req5');
    await pool.query(
      `INSERT INTO device_tokens (user_id, token, platform, timezone) VALUES ($1, $2, 'android', 'UTC')`,
      [user5.userId, `token-user5-${user5.userId}`]
    );

    // Override sendPushNotification to throw
    mock.restoreAll();
    mock.method(firebaseService, 'isFirebaseConfigured', () => true);
    mock.method(notificationService, 'sendPushNotification', async () => {
      throw new Error('FCM connection failure');
    });

    const h5Res = await fetch(`${baseUrl}/habits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user5.token}` },
      body: JSON.stringify({ name: 'User5 Resilient Habit', frequency_type: 'daily' }),
    });
    const { habit: h5 } = await h5Res.json();

    const complete5Res = await fetch(`${baseUrl}/habits/${h5.id}/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${user5.token}` },
    });
    assert.equal(complete5Res.status, 201);
    const c5Body = await complete5Res.json();
    assert.ok(c5Body.completion);
    assert.equal(typeof c5Body.streak, 'number');

    // =========================================================================
    // Requirement 6: Only ONE notification selected (milestone > celebrating)
    // =========================================================================
    const multiState = determinePandaState({ isCompleted: true, remainingHabits: 0, streak: 7 });
    assert.equal(multiState, PANDA_STATES.EXCITED, 'Milestone excited takes priority over celebrating');
  });
});
