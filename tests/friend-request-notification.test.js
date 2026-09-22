const { test, describe, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { pool } = require('../services/db');
const firebaseService = require('../services/firebaseService');
const notificationService = require('../services/notificationService');
const { sendFriendRequest } = require('../services/friendService');

afterEach(() => {
  mock.restoreAll();
});

describe('Friend Request FCM Push Notifications', () => {
  const requesterId = '11111111-1111-1111-1111-111111111111';
  const recipientId = '22222222-2222-2222-2222-222222222222';
  const recipientUsername = 'sam_21';

  test('1. Friend request with one recipient token creates request and sends FCM notification', async () => {
    mock.method(firebaseService, 'isFirebaseConfigured', () => true);

    // Mock DB queries
    mock.method(pool, 'query', async (query, params) => {
      // Lookup recipient user
      if (query.includes('FROM users') && query.includes('LOWER(username) = LOWER($1)')) {
        return { rows: [{ id: recipientId, username: 'Sam_21', email: 'sam@example.com' }] };
      }
      // Check existing friend requests
      if (query.includes('FROM friend_requests')) {
        return { rows: [] };
      }
      // Check friendships
      if (query.includes('FROM friendships')) {
        return { rowCount: 0, rows: [] };
      }
      // Insert friend request
      if (query.includes('INSERT INTO friend_requests')) {
        return {
          rows: [
            {
              request_id: 'req-101',
              from_user_id: requesterId,
              to_user_id: recipientId,
              status: 'pending',
              created_at: new Date().toISOString(),
            },
          ],
        };
      }
      // Log activity
      if (query.includes('INSERT INTO user_activity')) {
        return { rows: [] };
      }
      // Device tokens for recipient
      if (query.includes('FROM device_tokens')) {
        return {
          rows: [
            {
              id: 'tok-1',
              user_id: recipientId,
              token: 'recipient_fcm_token_1',
              platform: 'android',
              timezone: 'UTC',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
        };
      }
      // Requester user info
      if (query.includes('FROM users WHERE id = $1')) {
        return { rows: [{ name: 'Ayush Sharma', username: 'ayush_01' }] };
      }
      throw new Error(`Unexpected query: ${query}`);
    });

    // Mock sendPushNotification
    const sendPushMock = mock.method(notificationService, 'sendPushNotification', async (token, payload) => {
      return { success: true, messageId: 'fcm-msg-123' };
    });

    const result = await sendFriendRequest(requesterId, recipientUsername);

    assert.equal(result.request_id, 'req-101');
    assert.equal(result.status, 'pending');
    assert.equal(result.to_username, 'Sam_21');

    assert.equal(sendPushMock.mock.callCount(), 1);
    const [calledToken, calledPayload] = sendPushMock.mock.calls[0].arguments;
    assert.equal(calledToken, 'recipient_fcm_token_1');
    assert.equal(calledPayload.title, 'New Friend Request');
    assert.equal(calledPayload.body, 'Ayush Sharma sent you a friend request.');
    assert.deepEqual(calledPayload.data, {
      type: 'friend_request',
      requestId: 'req-101',
      senderId: requesterId,
    });
    // Ensure data values are strictly strings
    assert.equal(typeof calledPayload.data.type, 'string');
    assert.equal(typeof calledPayload.data.requestId, 'string');
    assert.equal(typeof calledPayload.data.senderId, 'string');
  });

  test('2. Recipient with multiple device tokens attempts notification for all tokens', async () => {
    mock.method(firebaseService, 'isFirebaseConfigured', () => true);

    mock.method(pool, 'query', async (query) => {
      if (query.includes('FROM users') && query.includes('LOWER(username) = LOWER($1)')) {
        return { rows: [{ id: recipientId, username: 'Sam_21' }] };
      }
      if (query.includes('FROM friend_requests')) return { rows: [] };
      if (query.includes('FROM friendships')) return { rowCount: 0, rows: [] };
      if (query.includes('INSERT INTO friend_requests')) {
        return {
          rows: [
            {
              request_id: 'req-multi',
              from_user_id: requesterId,
              to_user_id: recipientId,
              status: 'pending',
              created_at: new Date().toISOString(),
            },
          ],
        };
      }
      if (query.includes('INSERT INTO user_activity')) return { rows: [] };
      if (query.includes('FROM device_tokens')) {
        return {
          rows: [
            { id: 'tok-1', user_id: recipientId, token: 'token_phone', platform: 'android' },
            { id: 'tok-2', user_id: recipientId, token: 'token_tablet', platform: 'ios' },
            { id: 'tok-3', user_id: recipientId, token: 'token_web', platform: 'android' },
          ],
        };
      }
      if (query.includes('FROM users WHERE id = $1')) {
        return { rows: [{ name: null, username: 'ayush_01' }] };
      }
      throw new Error(`Unexpected query: ${query}`);
    });

    const sentTokens = [];
    mock.method(notificationService, 'sendPushNotification', async (token, payload) => {
      sentTokens.push(token);
      return { success: true, messageId: `msg-${token}` };
    });

    const result = await sendFriendRequest(requesterId, recipientUsername);

    assert.equal(result.request_id, 'req-multi');
    assert.equal(sentTokens.length, 3);
    assert.deepEqual(sentTokens, ['token_phone', 'token_tablet', 'token_web']);
  });

  test('3. Recipient with zero device tokens succeeds without attempting push notification', async () => {
    mock.method(firebaseService, 'isFirebaseConfigured', () => true);

    mock.method(pool, 'query', async (query) => {
      if (query.includes('FROM users') && query.includes('LOWER(username) = LOWER($1)')) {
        return { rows: [{ id: recipientId, username: 'Sam_21' }] };
      }
      if (query.includes('FROM friend_requests')) return { rows: [] };
      if (query.includes('FROM friendships')) return { rowCount: 0, rows: [] };
      if (query.includes('INSERT INTO friend_requests')) {
        return {
          rows: [
            {
              request_id: 'req-no-tokens',
              from_user_id: requesterId,
              to_user_id: recipientId,
              status: 'pending',
              created_at: new Date().toISOString(),
            },
          ],
        };
      }
      if (query.includes('INSERT INTO user_activity')) return { rows: [] };
      if (query.includes('FROM device_tokens')) {
        return { rows: [] };
      }
      throw new Error(`Unexpected query: ${query}`);
    });

    const sendPushMock = mock.method(notificationService, 'sendPushNotification', async () => {
      throw new Error('Should not be called');
    });

    const result = await sendFriendRequest(requesterId, recipientUsername);

    assert.equal(result.request_id, 'req-no-tokens');
    assert.equal(result.status, 'pending');
    assert.equal(sendPushMock.mock.callCount(), 0);
  });

  test('4. One FCM send failure does not fail the friend request and attempts remaining tokens while pruning invalid token', async () => {
    mock.method(firebaseService, 'isFirebaseConfigured', () => true);

    let tokenDeleted = false;
    mock.method(pool, 'query', async (query, params) => {
      // console.log('DEBUG TEST 4 QUERY:', query.trim().replace(/\s+/g, ' '));
      if (query.includes('FROM users') && query.includes('LOWER(username) = LOWER($1)')) {
        return { rows: [{ id: recipientId, username: 'Sam_21' }] };
      }
      if (query.includes('FROM friend_requests')) return { rows: [] };
      if (query.includes('FROM friendships')) return { rowCount: 0, rows: [] };
      if (query.includes('INSERT INTO friend_requests')) {
        return {
          rows: [
            {
              request_id: 'req-partial-fail',
              from_user_id: requesterId,
              to_user_id: recipientId,
              status: 'pending',
              created_at: new Date().toISOString(),
            },
          ],
        };
      }
      if (query.includes('INSERT INTO user_activity')) return { rows: [] };
      if (query.includes('DELETE FROM device_tokens')) {
        tokenDeleted = true;
        return { rowCount: 1 };
      }
      if (query.includes('FROM device_tokens')) {
        return {
          rows: [
            { id: 'tok-stale', user_id: recipientId, token: 'stale_token_1', platform: 'android' },
            { id: 'tok-valid', user_id: recipientId, token: 'valid_token_2', platform: 'android' },
          ],
        };
      }
      if (query.includes('FROM users WHERE id = $1')) {
        return { rows: [{ name: 'Ayush', username: 'ayush_01' }] };
      }
      throw new Error(`Unexpected query: ${query}`);
    });

    const sendPushMock = mock.method(notificationService, 'sendPushNotification', async (token) => {
      if (token === 'stale_token_1') {
        const err = new Error('Registration token is no longer valid');
        err.code = 'messaging/registration-token-not-registered';
        throw err;
      }
      return { success: true, messageId: 'valid-msg-456' };
    });

    const result = await sendFriendRequest(requesterId, recipientUsername);

    assert.equal(result.request_id, 'req-partial-fail');
    assert.equal(result.status, 'pending');
    assert.equal(sendPushMock.mock.callCount(), 2);
    assert.equal(tokenDeleted, true);
  });

  test('5. Duplicate pending request returns 409 and sends no notification', async () => {
    mock.method(firebaseService, 'isFirebaseConfigured', () => true);

    mock.method(pool, 'query', async (query) => {
      if (query.includes('FROM users') && query.includes('LOWER(username) = LOWER($1)')) {
        return { rows: [{ id: recipientId, username: 'Sam_21' }] };
      }
      if (query.includes('FROM friend_requests')) {
        return { rows: [{ id: 'req-existing', status: 'pending' }] };
      }
      throw new Error(`Unexpected query: ${query}`);
    });

    const sendPushMock = mock.method(notificationService, 'sendPushNotification', async () => {
      throw new Error('Should not be called');
    });

    await assert.rejects(
      () => sendFriendRequest(requesterId, recipientUsername),
      (err) => {
        assert.equal(err.status, 409);
        assert.match(err.message, /Friend request already sent/i);
        return true;
      }
    );

    assert.equal(sendPushMock.mock.callCount(), 0);
  });

  test('6. Rejected request recreated as pending sends notification for the new request', async () => {
    mock.method(firebaseService, 'isFirebaseConfigured', () => true);

    mock.method(pool, 'query', async (query) => {
      if (query.includes('FROM users') && query.includes('LOWER(username) = LOWER($1)')) {
        return { rows: [{ id: recipientId, username: 'Sam_21' }] };
      }
      if (query.includes('FROM friend_requests')) {
        return { rows: [{ id: 'req-rejected-prev', status: 'rejected' }] };
      }
      if (query.includes('FROM friendships')) {
        return { rowCount: 0, rows: [] };
      }
      if (query.includes('UPDATE friend_requests SET')) {
        return {
          rows: [
            {
              request_id: 'req-rejected-prev',
              from_user_id: requesterId,
              to_user_id: recipientId,
              status: 'pending',
              created_at: new Date().toISOString(),
            },
          ],
        };
      }
      if (query.includes('INSERT INTO user_activity')) return { rows: [] };
      if (query.includes('FROM device_tokens')) {
        return {
          rows: [
            { id: 'tok-1', user_id: recipientId, token: 'token_recreated', platform: 'android' },
          ],
        };
      }
      if (query.includes('FROM users WHERE id = $1')) {
        return { rows: [{ name: 'Ayush', username: 'ayush_01' }] };
      }
      throw new Error(`Unexpected query: ${query}`);
    });

    const sendPushMock = mock.method(notificationService, 'sendPushNotification', async () => ({
      success: true,
      messageId: 'recreated-msg-789',
    }));

    const result = await sendFriendRequest(requesterId, recipientUsername);

    assert.equal(result.request_id, 'req-rejected-prev');
    assert.equal(result.status, 'pending');
    assert.equal(sendPushMock.mock.callCount(), 1);
  });

  test('7. Accepted historical friend_request with no current friendship allows sending a new request and updates row to pending', async () => {
    mock.method(firebaseService, 'isFirebaseConfigured', () => true);

    mock.method(pool, 'query', async (query) => {
      if (query.includes('FROM users') && query.includes('LOWER(username) = LOWER($1)')) {
        return { rows: [{ id: recipientId, username: 'chetan_08' }] };
      }
      if (query.includes('FROM friendships')) {
        return { rowCount: 0, rows: [] };
      }
      if (query.includes('FROM friend_requests')) {
        return { rows: [{ id: 'req-accepted-historical', status: 'accepted' }] };
      }
      if (query.includes('UPDATE friend_requests SET')) {
        return {
          rows: [
            {
              request_id: 'req-accepted-historical',
              from_user_id: requesterId,
              to_user_id: recipientId,
              status: 'pending',
              created_at: new Date().toISOString(),
            },
          ],
        };
      }
      if (query.includes('INSERT INTO user_activity')) return { rows: [] };
      if (query.includes('FROM device_tokens')) {
        return {
          rows: [
            { id: 'tok-1', user_id: recipientId, token: 'token_chetan', platform: 'android' },
          ],
        };
      }
      if (query.includes('FROM users WHERE id = $1')) {
        return { rows: [{ name: 'Sam', username: 'sam_21' }] };
      }
      throw new Error(`Unexpected query: ${query}`);
    });

    const sendPushMock = mock.method(notificationService, 'sendPushNotification', async () => ({
      success: true,
      messageId: 'msg-chetan-new-request',
    }));

    const result = await sendFriendRequest(requesterId, 'chetan_08');

    assert.equal(result.request_id, 'req-accepted-historical');
    assert.equal(result.status, 'pending');
    assert.equal(result.to_username, 'chetan_08');
    assert.equal(sendPushMock.mock.callCount(), 1);
  });
});

