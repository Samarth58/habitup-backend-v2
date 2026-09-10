const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const { registerTestUser, authFetch } = require('./helpers');
const { getDeviceTokensByUserId } = require('../services/deviceTokenService');

describe('Notifications API - Device Token Registration', () => {
  let userA;
  let userB;

  before(async () => {
    userA = await registerTestUser();
    userB = await registerTestUser();
  });

  describe('Authentication Requirements', () => {
    test('unauthenticated request returns 401 Unauthorized', async () => {
      const res = await authFetch(
        '/notifications/device-token',
        {
          method: 'POST',
          body: JSON.stringify({
            token: 'fcm_test_token_unauth_123',
            platform: 'android',
            timezone: 'Asia/Kolkata',
          }),
        }
      );

      assert.equal(res.status, 401);
      const data = await res.json();
      assert.ok(data.error);
    });

    test('request with invalid JWT token returns 401 Unauthorized', async () => {
      const res = await authFetch(
        '/notifications/device-token',
        {
          method: 'POST',
          body: JSON.stringify({
            token: 'fcm_test_token_invalid_jwt_123',
            platform: 'android',
          }),
        },
        'invalid.jwt.token'
      );

      assert.equal(res.status, 401);
      const data = await res.json();
      assert.ok(data.error);
    });
  });

  describe('Input Validation', () => {
    test('missing token in request body returns 400', async () => {
      const res = await authFetch(
        '/notifications/device-token',
        {
          method: 'POST',
          body: JSON.stringify({
            platform: 'android',
            timezone: 'Asia/Kolkata',
          }),
        },
        userA.accessToken
      );

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.match(data.error, /token is required/i);
    });

    test('empty string token returns 400', async () => {
      const res = await authFetch(
        '/notifications/device-token',
        {
          method: 'POST',
          body: JSON.stringify({
            token: '   ',
            platform: 'android',
          }),
        },
        userA.accessToken
      );

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.match(data.error, /token is required/i);
    });

    test('missing platform returns 400', async () => {
      const res = await authFetch(
        '/notifications/device-token',
        {
          method: 'POST',
          body: JSON.stringify({
            token: 'fcm_token_no_platform',
          }),
        },
        userA.accessToken
      );

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.match(data.error, /platform is required/i);
    });

    test('invalid platform returns 400', async () => {
      const res = await authFetch(
        '/notifications/device-token',
        {
          method: 'POST',
          body: JSON.stringify({
            token: 'fcm_token_invalid_plat',
            platform: 'windows_phone',
          }),
        },
        userA.accessToken
      );

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.match(data.error, /platform must be 'android' or 'ios'/i);
    });

    test('invalid IANA timezone returns 400', async () => {
      const res = await authFetch(
        '/notifications/device-token',
        {
          method: 'POST',
          body: JSON.stringify({
            token: 'fcm_token_invalid_tz',
            platform: 'android',
            timezone: 'Invalid/NonExistentZone',
          }),
        },
        userA.accessToken
      );

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.match(data.error, /invalid iana timezone/i);
    });
  });

  describe('Device Token Registration & Storage', () => {
    test('successfully registers a valid Android device token with timezone', async () => {
      const token = `fcm_android_token_${Date.now()}_1`;
      const res = await authFetch(
        '/notifications/device-token',
        {
          method: 'POST',
          body: JSON.stringify({
            token,
            platform: 'android',
            timezone: 'Asia/Kolkata',
          }),
        },
        userA.accessToken
      );

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.message, 'Device token registered successfully');

      // Verify token in database
      const tokens = await getDeviceTokensByUserId(userA.user.id);
      const registered = tokens.find((t) => t.token === token);
      assert.ok(registered);
      assert.equal(registered.platform, 'android');
      assert.equal(registered.timezone, 'Asia/Kolkata');
      assert.equal(registered.user_id, userA.user.id);
    });

    test('successfully registers an iOS device token without explicit timezone (defaults to UTC)', async () => {
      const token = `fcm_ios_token_${Date.now()}_2`;
      const res = await authFetch(
        '/notifications/device-token',
        {
          method: 'POST',
          body: JSON.stringify({
            token,
            platform: 'ios',
          }),
        },
        userA.accessToken
      );

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);

      // Verify token in database has UTC timezone
      const tokens = await getDeviceTokensByUserId(userA.user.id);
      const registered = tokens.find((t) => t.token === token);
      assert.ok(registered);
      assert.equal(registered.platform, 'ios');
      assert.equal(registered.timezone, 'UTC');
    });

    test('handles case-insensitive platform values like ANDROID or iOS', async () => {
      const token = `fcm_mixedcase_token_${Date.now()}_3`;
      const res = await authFetch(
        '/notifications/device-token',
        {
          method: 'POST',
          body: JSON.stringify({
            token,
            platform: 'ANDROID',
            timezone: 'America/New_York',
          }),
        },
        userA.accessToken
      );

      assert.equal(res.status, 200);
      const tokens = await getDeviceTokensByUserId(userA.user.id);
      const registered = tokens.find((t) => t.token === token);
      assert.ok(registered);
      assert.equal(registered.platform, 'android');
      assert.equal(registered.timezone, 'America/New_York');
    });
  });

  describe('Duplicate & Idempotency Handling', () => {
    test('repeated registration of the same token updates record without creating duplicates', async () => {
      const token = `fcm_idempotent_token_${Date.now()}_4`;

      // 1. Initial registration
      const res1 = await authFetch(
        '/notifications/device-token',
        {
          method: 'POST',
          body: JSON.stringify({
            token,
            platform: 'android',
            timezone: 'UTC',
          }),
        },
        userA.accessToken
      );
      assert.equal(res1.status, 200);

      // 2. Second registration with updated timezone
      const res2 = await authFetch(
        '/notifications/device-token',
        {
          method: 'POST',
          body: JSON.stringify({
            token,
            platform: 'android',
            timezone: 'Europe/London',
          }),
        },
        userA.accessToken
      );
      assert.equal(res2.status, 200);

      // Verify only 1 token record exists for this token
      const tokens = await getDeviceTokensByUserId(userA.user.id);
      const matchingTokens = tokens.filter((t) => t.token === token);
      assert.equal(matchingTokens.length, 1);
      assert.equal(matchingTokens[0].timezone, 'Europe/London');
    });

    test('token moves cleanly to new user when re-registered by a different user (device transfer)', async () => {
      const sharedDeviceToken = `fcm_shared_device_${Date.now()}_5`;

      // 1. User A registers the device
      await authFetch(
        '/notifications/device-token',
        {
          method: 'POST',
          body: JSON.stringify({
            token: sharedDeviceToken,
            platform: 'android',
            timezone: 'Asia/Kolkata',
          }),
        },
        userA.accessToken
      );

      let userATokens = await getDeviceTokensByUserId(userA.user.id);
      assert.ok(userATokens.some((t) => t.token === sharedDeviceToken));

      // 2. User B logs in on same device and registers the same token
      const res = await authFetch(
        '/notifications/device-token',
        {
          method: 'POST',
          body: JSON.stringify({
            token: sharedDeviceToken,
            platform: 'android',
            timezone: 'America/Los_Angeles',
          }),
        },
        userB.accessToken
      );
      assert.equal(res.status, 200);

      // 3. User A no longer owns the token, User B now owns it
      userATokens = await getDeviceTokensByUserId(userA.user.id);
      const userBTokens = await getDeviceTokensByUserId(userB.user.id);

      assert.equal(userATokens.some((t) => t.token === sharedDeviceToken), false);
      const userBToken = userBTokens.find((t) => t.token === sharedDeviceToken);
      assert.ok(userBToken);
      assert.equal(userBToken.user_id, userB.user.id);
      assert.equal(userBToken.timezone, 'America/Los_Angeles');
    });
  });

  describe('User Association & Security', () => {
    test('ignores client-sent userId in request body and associates strictly with authenticated user', async () => {
      const token = `fcm_spoofed_user_${Date.now()}_6`;

      // User A attempts to submit User B's user_id in body
      const res = await authFetch(
        '/notifications/device-token',
        {
          method: 'POST',
          body: JSON.stringify({
            token,
            platform: 'android',
            timezone: 'UTC',
            userId: userB.user.id,
            user_id: userB.user.id,
          }),
        },
        userA.accessToken
      );

      assert.equal(res.status, 200);

      // Verify token was associated with User A, NOT User B
      const userATokens = await getDeviceTokensByUserId(userA.user.id);
      const userBTokens = await getDeviceTokensByUserId(userB.user.id);

      assert.ok(userATokens.some((t) => t.token === token));
      assert.equal(userBTokens.some((t) => t.token === token), false);
    });

    test('supports multiple distinct devices for the same user', async () => {
      const phoneToken = `fcm_phone_${Date.now()}_7`;
      const tabletToken = `fcm_tablet_${Date.now()}_8`;

      await authFetch(
        '/notifications/device-token',
        {
          method: 'POST',
          body: JSON.stringify({ token: phoneToken, platform: 'android', timezone: 'Asia/Kolkata' }),
        },
        userA.accessToken
      );

      await authFetch(
        '/notifications/device-token',
        {
          method: 'POST',
          body: JSON.stringify({ token: tabletToken, platform: 'ios', timezone: 'Asia/Kolkata' }),
        },
        userA.accessToken
      );

      const tokens = await getDeviceTokensByUserId(userA.user.id);
      const hasPhone = tokens.some((t) => t.token === phoneToken && t.platform === 'android');
      const hasTablet = tokens.some((t) => t.token === tabletToken && t.platform === 'ios');

      assert.ok(hasPhone, 'User should have phone token registered');
      assert.ok(hasTablet, 'User should have tablet token registered');
    });
  });
});
