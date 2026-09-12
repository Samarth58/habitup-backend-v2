const { test, describe, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { pool } = require('../services/db');
const firebaseService = require('../services/firebaseService');
const { upsertDeviceToken } = require('../services/deviceTokenService');

const userId = '123e4567-e89b-12d3-a456-426614174000';

function mockDatabase() {
  return mock.method(pool, 'query', async (query) => {
    if (query.includes('INSERT INTO device_tokens')) {
      return { rows: [{ id: 1, token: 'test-token', platform: 'android', timezone: 'UTC' }] };
    }
    if (query.includes('INSERT INTO notification_preferences')) {
      return { rows: [{ id: 1 }] };
    }
    throw new Error(`Unexpected query in device-token subscription test: ${query}`);
  });
}

afterEach(() => {
  mock.restoreAll();
});

describe('Device token FCM topic subscription', () => {
  test('1. Valid device token registration -> token is subscribed to all-users', async () => {
    mockDatabase();
    mock.method(firebaseService, 'isFirebaseConfigured', () => true);
    const subscribe = mock.method(firebaseService, 'subscribeTokenToTopic', async () => ({ success: true }));

    await upsertDeviceToken(userId, {
      token: 'new-device-token',
      platform: 'android',
    });

    assert.equal(subscribe.mock.callCount(), 1);
    assert.deepEqual(subscribe.mock.calls[0].arguments, ['new-device-token', 'all-users']);
  });

  test('2. Existing token update -> topic subscription remains safe/idempotent', async () => {
    mockDatabase();
    mock.method(firebaseService, 'isFirebaseConfigured', () => true);
    const subscribe = mock.method(firebaseService, 'subscribeTokenToTopic', async () => ({ success: true }));

    await upsertDeviceToken(userId, { token: 'existing-device-token', platform: 'ios' });
    await upsertDeviceToken(userId, { token: 'existing-device-token', platform: 'ios' });

    assert.equal(subscribe.mock.callCount(), 2);
    assert.deepEqual(subscribe.mock.calls[1].arguments, ['existing-device-token', 'all-users']);
  });

  test('3. Firebase topic subscription failure -> device registration behavior remains safe', async () => {
    const database = mockDatabase();
    mock.method(firebaseService, 'isFirebaseConfigured', () => true);
    mock.method(firebaseService, 'subscribeTokenToTopic', async () => {
      throw Object.assign(new Error('FCM unavailable'), { code: 'messaging/internal-error' });
    });

    const result = await upsertDeviceToken(userId, {
      token: 'subscription-failure-token',
      platform: 'android',
    });

    assert.equal(result.token, 'test-token');
    assert.equal(database.mock.callCount(), 2);
  });

  test('4. Existing device-token API behavior continues to work when Firebase is not configured', async () => {
    const database = mockDatabase();
    mock.method(firebaseService, 'isFirebaseConfigured', () => false);
    const subscribe = mock.method(firebaseService, 'subscribeTokenToTopic', async () => ({ success: true }));

    const result = await upsertDeviceToken(userId, {
      token: 'unconfigured-token',
      platform: 'android',
    });

    assert.equal(result.token, 'test-token');
    assert.equal(subscribe.mock.callCount(), 0, 'Should not attempt topic subscription when unconfigured');
    assert.equal(database.mock.callCount(), 2);
  });
});