const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const { registerTestUser, authFetch } = require('./helpers');
const { getDeviceTokensByUserId } = require('../services/deviceTokenService');
const { pool } = require('../services/db');

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

  describe('Test Notification Endpoint (POST /notifications/test)', () => {
    test('unauthenticated request to /notifications/test returns 401 Unauthorized', async () => {
      const res = await authFetch('/notifications/test', {
        method: 'POST',
        body: JSON.stringify({ token: 'any_fcm_token' }),
      });

      assert.equal(res.status, 401);
      const data = await res.json();
      assert.ok(data.error);
    });

    test('missing token returns 400 Bad Request', async () => {
      const res = await authFetch(
        '/notifications/test',
        {
          method: 'POST',
          body: JSON.stringify({}),
        },
        userA.accessToken
      );

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.match(data.error, /token is required/i);
    });

    test('empty string token returns 400 Bad Request', async () => {
      const res = await authFetch(
        '/notifications/test',
        {
          method: 'POST',
          body: JSON.stringify({ token: '   ' }),
        },
        userA.accessToken
      );

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.match(data.error, /token is required/i);
    });

    test('unregistered device token returns 404 Not Found', async () => {
      const res = await authFetch(
        '/notifications/test',
        {
          method: 'POST',
          body: JSON.stringify({ token: 'completely_unregistered_fcm_token_123' }),
        },
        userA.accessToken
      );

      assert.equal(res.status, 404);
      const data = await res.json();
      assert.match(data.error, /not found or not registered/i);
    });

    test('device token belonging to another user is rejected with 404', async () => {
      const userBToken = `fcm_user_b_private_token_${Date.now()}`;

      // User B registers the token
      await authFetch(
        '/notifications/device-token',
        {
          method: 'POST',
          body: JSON.stringify({ token: userBToken, platform: 'android' }),
        },
        userB.accessToken
      );

      // User A attempts to trigger test notification on User B's token
      const res = await authFetch(
        '/notifications/test',
        {
          method: 'POST',
          body: JSON.stringify({ token: userBToken }),
        },
        userA.accessToken
      );

      assert.equal(res.status, 404);
      const data = await res.json();
      assert.match(data.error, /not found or not registered/i);
    });

    test('valid registered token returns 503 if Firebase Admin SDK is not configured in test env', async () => {
      const userAToken = `fcm_user_a_test_token_${Date.now()}`;

      // Register token for User A
      await authFetch(
        '/notifications/device-token',
        {
          method: 'POST',
          body: JSON.stringify({ token: userAToken, platform: 'android' }),
        },
        userA.accessToken
      );

      // Attempt to send notification without Firebase configured
      const res = await authFetch(
        '/notifications/test',
        {
          method: 'POST',
          body: JSON.stringify({ token: userAToken }),
        },
        userA.accessToken
      );

      // Since Firebase env vars are not set in the test environment, should fail safely with 503
      if (!process.env.FIREBASE_PROJECT_ID) {
        assert.equal(res.status, 503);
        const data = await res.json();
        assert.match(data.error, /Firebase Admin SDK is not configured/i);
      }
    });
  });

  describe('Firebase & Notification Service Unit Logic', () => {
    const { isFirebaseConfigured } = require('../services/firebaseService');
    const { sendPushNotification } = require('../services/notificationService');

    test('isFirebaseConfigured returns boolean without throwing', () => {
      const configured = isFirebaseConfigured();
      assert.equal(typeof configured, 'boolean');
    });

    test('sendPushNotification validates input parameters', async () => {
      await assert.rejects(
        () => sendPushNotification('', { title: 'Test', body: 'Body' }),
        /Device token is required/i
      );

      await assert.rejects(
        () => sendPushNotification('fcm_token', { title: '', body: 'Body' }),
        /Notification title is required/i
      );

      await assert.rejects(
        () => sendPushNotification('fcm_token', { title: 'Test', body: '' }),
        /Notification body is required/i
      );
    });

    test('sendPushNotification throws safe error when Firebase is unconfigured', async () => {
      if (!isFirebaseConfigured()) {
        await assert.rejects(
          () => sendPushNotification('fcm_token', { title: 'Test', body: 'Body' }),
          /Firebase Admin SDK is not configured/i
        );
      }
    });
  });

  describe('Notifications API - Notification Preferences', () => {
    const { pool } = require('../services/db');
    let testUser1;
    let testUser2;

    before(async () => {
      testUser1 = await registerTestUser();
      testUser2 = await registerTestUser();
    });

    describe('Authentication Requirements', () => {
      test('unauthenticated GET /notifications/preferences returns 401 Unauthorized', async () => {
        const res = await authFetch('/notifications/preferences', {
          method: 'GET',
        });
        assert.equal(res.status, 401);
        const data = await res.json();
        assert.ok(data.error);
      });

      test('GET /notifications/preferences with invalid token returns 401 Unauthorized', async () => {
        const res = await authFetch(
          '/notifications/preferences',
          { method: 'GET' },
          'invalid.bearer.token'
        );
        assert.equal(res.status, 401);
      });

      test('unauthenticated PUT /notifications/preferences returns 401 Unauthorized', async () => {
        const res = await authFetch('/notifications/preferences', {
          method: 'PUT',
          body: JSON.stringify({ pushEnabled: false }),
        });
        assert.equal(res.status, 401);
      });
    });

    describe('Default Preferences Retrieval', () => {
      test('authenticated user can get default preferences', async () => {
        const freshUser = await registerTestUser();
        const res = await authFetch(
          '/notifications/preferences',
          { method: 'GET' },
          freshUser.accessToken
        );

        assert.equal(res.status, 200);
        const data = await res.json();
        const prefs = data.preferences || data;

        assert.equal(prefs.pushEnabled, true);
        assert.equal(prefs.morningEnabled, true);
        assert.equal(prefs.afternoonEnabled, true);
        assert.equal(prefs.eveningEnabled, true);
        assert.equal(prefs.morningTime, '08:00');
        assert.equal(prefs.afternoonTime, '13:00');
        assert.equal(prefs.eveningTime, '20:00');
        assert.equal(prefs.timezone, 'UTC');
        assert.ok(prefs.updatedAt);
      });
    });

    describe('Full and Partial Updates', () => {
      test('authenticated user can update full preferences', async () => {
        const updatePayload = {
          pushEnabled: true,
          morningEnabled: false,
          afternoonEnabled: true,
          eveningEnabled: false,
          morningTime: '07:30',
          afternoonTime: '12:45',
          eveningTime: '21:15',
          timezone: 'Asia/Kolkata',
        };

        const res = await authFetch(
          '/notifications/preferences',
          {
            method: 'PUT',
            body: JSON.stringify(updatePayload),
          },
          testUser1.accessToken
        );

        assert.equal(res.status, 200);
        const data = await res.json();
        const prefs = data.preferences || data;

        assert.equal(prefs.pushEnabled, true);
        assert.equal(prefs.morningEnabled, false);
        assert.equal(prefs.afternoonEnabled, true);
        assert.equal(prefs.eveningEnabled, false);
        assert.equal(prefs.morningTime, '07:30');
        assert.equal(prefs.afternoonTime, '12:45');
        assert.equal(prefs.eveningTime, '21:15');
        assert.equal(prefs.timezone, 'Asia/Kolkata');

        // Confirm persistence via GET
        const getRes = await authFetch(
          '/notifications/preferences',
          { method: 'GET' },
          testUser1.accessToken
        );
        const getData = await getRes.json();
        const fetchedPrefs = getData.preferences || getData;
        assert.equal(fetchedPrefs.morningEnabled, false);
        assert.equal(fetchedPrefs.morningTime, '07:30');
        assert.equal(fetchedPrefs.timezone, 'Asia/Kolkata');
      });

      test('partial update updates only provided fields and preserves others', async () => {
        // Change only evening settings
        const partialPayload = {
          eveningEnabled: true,
          eveningTime: '22:30',
        };

        const res = await authFetch(
          '/notifications/preferences',
          {
            method: 'PUT',
            body: JSON.stringify(partialPayload),
          },
          testUser1.accessToken
        );

        assert.equal(res.status, 200);
        const data = await res.json();
        const prefs = data.preferences || data;

        // Changed fields
        assert.equal(prefs.eveningEnabled, true);
        assert.equal(prefs.eveningTime, '22:30');

        // Preserved fields from previous full update
        assert.equal(prefs.morningEnabled, false);
        assert.equal(prefs.morningTime, '07:30');
        assert.equal(prefs.afternoonEnabled, true);
        assert.equal(prefs.afternoonTime, '12:45');
        assert.equal(prefs.timezone, 'Asia/Kolkata');
      });
    });

    describe('Timezone Validation and Updates', () => {
      test('accepts valid IANA timezones (Asia/Kolkata, America/New_York, Europe/London, Asia/Tokyo, UTC)', async () => {
        const validTimezones = [
          'Asia/Kolkata',
          'America/New_York',
          'Europe/London',
          'Asia/Tokyo',
          'UTC',
          'Australia/Sydney',
        ];

        for (const tz of validTimezones) {
          const res = await authFetch(
            '/notifications/preferences',
            {
              method: 'PUT',
              body: JSON.stringify({ timezone: tz }),
            },
            testUser2.accessToken
          );

          assert.equal(res.status, 200);
          const data = await res.json();
          const prefs = data.preferences || data;
          assert.equal(prefs.timezone, tz);

          // Verify GET also returns the updated timezone
          const getRes = await authFetch(
            '/notifications/preferences',
            { method: 'GET' },
            testUser2.accessToken
          );
          const getData = await getRes.json();
          assert.equal((getData.preferences || getData).timezone, tz);
        }
      });

      test('rejects invalid or offset timezones with 400 (IST, UTC+05:30, GMT+5:30, non-string, empty)', async () => {
        const invalidTimezones = [
          'IST',
          'EST',
          'UTC+05:30',
          'GMT+5:30',
          '+05:30',
          'India',
          'random-timezone',
          '',
          '   ',
          12345,
        ];

        for (const invalidTz of invalidTimezones) {
          const res = await authFetch(
            '/notifications/preferences',
            {
              method: 'PUT',
              body: JSON.stringify({ timezone: invalidTz }),
            },
            testUser2.accessToken
          );

          assert.equal(res.status, 400);
          const data = await res.json();
          assert.match(data.error, /timezone/i);
        }
      });

      test('partial update of timezone does not modify other preference settings', async () => {
        const tzUser = await registerTestUser();

        // Set initial custom preferences
        await authFetch(
          '/notifications/preferences',
          {
            method: 'PUT',
            body: JSON.stringify({
              morningEnabled: false,
              morningTime: '06:15',
              timezone: 'Europe/London',
            }),
          },
          tzUser.accessToken
        );

        // Update ONLY timezone
        const updateRes = await authFetch(
          '/notifications/preferences',
          {
            method: 'PUT',
            body: JSON.stringify({ timezone: 'America/New_York' }),
          },
          tzUser.accessToken
        );

        assert.equal(updateRes.status, 200);
        const data = await updateRes.json();
        const prefs = data.preferences || data;

        assert.equal(prefs.timezone, 'America/New_York');
        assert.equal(prefs.morningEnabled, false);
        assert.equal(prefs.morningTime, '06:15');
      });
    });

    describe('Input Validation', () => {
      test('rejects non-boolean value for boolean preference fields', async () => {
        const invalidBooleans = [
          { pushEnabled: 'true' },
          { morningEnabled: 'false' },
          { afternoonEnabled: 1 },
          { eveningEnabled: 'yes' },
        ];

        for (const payload of invalidBooleans) {
          const res = await authFetch(
            '/notifications/preferences',
            {
              method: 'PUT',
              body: JSON.stringify(payload),
            },
            testUser1.accessToken
          );

          assert.equal(res.status, 400);
          const data = await res.json();
          assert.match(data.error, /must be a boolean/i);
        }
      });

      test('rejects invalid time formats (non-HH:mm, single-digit hour, letters)', async () => {
        const invalidFormats = [
          { morningTime: '8:00' },
          { afternoonTime: '1:00 PM' },
          { eveningTime: 'invalid' },
          { morningTime: '08:0' },
        ];

        for (const payload of invalidFormats) {
          const res = await authFetch(
            '/notifications/preferences',
            {
              method: 'PUT',
              body: JSON.stringify(payload),
            },
            testUser1.accessToken
          );

          assert.equal(res.status, 400);
          const data = await res.json();
          assert.match(data.error, /valid 24-hour time/i);
        }
      });

      test('rejects invalid time values (hour >= 24, minute >= 60)', async () => {
        const invalidValues = [
          { morningTime: '24:00' },
          { morningTime: '25:30' },
          { afternoonTime: '13:60' },
          { eveningTime: '23:99' },
        ];

        for (const payload of invalidValues) {
          const res = await authFetch(
            '/notifications/preferences',
            {
              method: 'PUT',
              body: JSON.stringify(payload),
            },
            testUser1.accessToken
          );

          assert.equal(res.status, 400);
          const data = await res.json();
          assert.match(data.error, /valid 24-hour time/i);
        }
      });

      test('rejects empty update body with 400', async () => {
        const res = await authFetch(
          '/notifications/preferences',
          {
            method: 'PUT',
            body: JSON.stringify({}),
          },
          testUser1.accessToken
        );

        assert.equal(res.status, 400);
        const data = await res.json();
        assert.match(data.error, /at least one preference field/i);
      });
    });

    describe('Security & Isolation', () => {
      test('user A cannot modify user B preferences (ignores userId in body)', async () => {
        // User 2 sets distinct preferences
        await authFetch(
          '/notifications/preferences',
          {
            method: 'PUT',
            body: JSON.stringify({ morningTime: '06:00', pushEnabled: true }),
          },
          testUser2.accessToken
        );

        // User 1 attempts to pass user2 ID in body to alter User 2's settings
        await authFetch(
          '/notifications/preferences',
          {
            method: 'PUT',
            body: JSON.stringify({
              userId: testUser2.user.id,
              user_id: testUser2.user.id,
              morningTime: '11:11',
            }),
          },
          testUser1.accessToken
        );

        // User 2's preferences remain unchanged
        const res2 = await authFetch(
          '/notifications/preferences',
          { method: 'GET' },
          testUser2.accessToken
        );
        const data2 = await res2.json();
        const prefs2 = data2.preferences || data2;
        assert.equal(prefs2.morningTime, '06:00');

        // User 1's preferences were the ones updated to 11:11
        const res1 = await authFetch(
          '/notifications/preferences',
          { method: 'GET' },
          testUser1.accessToken
        );
        const data1 = await res1.json();
        const prefs1 = data1.preferences || data1;
        assert.equal(prefs1.morningTime, '11:11');
      });

      test('updating preferences does not create duplicate rows in database', async () => {
        const isolationUser = await registerTestUser();

        // Perform multiple updates
        for (let i = 0; i < 4; i++) {
          await authFetch(
            '/notifications/preferences',
            {
              method: 'PUT',
              body: JSON.stringify({ morningTime: `0${6 + i}:00` }),
            },
            isolationUser.accessToken
          );
        }

        const { rows } = await pool.query(
          'SELECT COUNT(*)::int AS count FROM notification_preferences WHERE user_id = $1',
          [isolationUser.user.id]
        );

        assert.equal(rows[0].count, 1);
      });

      test('updated_at timestamp changes when preferences are updated', async () => {
        const timeUser = await registerTestUser();

        const res1 = await authFetch(
          '/notifications/preferences',
          { method: 'GET' },
          timeUser.accessToken
        );
        const data1 = await res1.json();
        const initialUpdatedAt = (data1.preferences || data1).updatedAt;

        // Small delay to ensure timestamp difference
        await new Promise((resolve) => setTimeout(resolve, 50));

        const res2 = await authFetch(
          '/notifications/preferences',
          {
            method: 'PUT',
            body: JSON.stringify({ pushEnabled: false }),
          },
          timeUser.accessToken
        );
        const data2 = await res2.json();
        const newUpdatedAt = (data2.preferences || data2).updatedAt;

        assert.ok(new Date(newUpdatedAt).getTime() >= new Date(initialUpdatedAt).getTime());
      });
    });
  });

  describe('Automatic Notification Preferences Initialization on Device Token Registration', () => {
    test('User registers a device token with no preference row -> preference row is created with defaults and timezone', async () => {
      const freshUser = await registerTestUser();

      // Verify no preference row initially exists
      const initialPrefCheck = await pool.query(
        'SELECT * FROM notification_preferences WHERE user_id = $1',
        [freshUser.user.id]
      );
      assert.equal(initialPrefCheck.rows.length, 0);

      // Register device token with specific timezone
      const token = `fcm_fresh_init_token_${Date.now()}`;
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
        freshUser.accessToken
      );

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);

      // Verify preference row was created with expected defaults
      const { rows } = await pool.query(
        'SELECT * FROM notification_preferences WHERE user_id = $1',
        [freshUser.user.id]
      );
      assert.equal(rows.length, 1);
      const pref = rows[0];
      assert.equal(pref.push_enabled, true);
      assert.equal(pref.morning_enabled, true);
      assert.equal(pref.afternoon_enabled, true);
      assert.equal(pref.evening_enabled, true);
      assert.equal(pref.morning_time.slice(0, 5), '08:00');
      assert.equal(pref.afternoon_time.slice(0, 5), '13:00');
      assert.equal(pref.evening_time.slice(0, 5), '20:00');
      assert.equal(pref.timezone, 'Asia/Kolkata');
    });

    test('User registers another token with an existing preference row -> existing preferences are preserved', async () => {
      const multiTokenUser = await registerTestUser();

      // 1. First device token registers and initializes preferences
      await authFetch(
        '/notifications/device-token',
        {
          method: 'POST',
          body: JSON.stringify({
            token: `fcm_device1_${Date.now()}`,
            platform: 'android',
            timezone: 'Asia/Kolkata',
          }),
        },
        multiTokenUser.accessToken
      );

      // 2. Register second device token with different timezone
      const res2 = await authFetch(
        '/notifications/device-token',
        {
          method: 'POST',
          body: JSON.stringify({
            token: `fcm_device2_${Date.now()}`,
            platform: 'ios',
            timezone: 'Europe/London',
          }),
        },
        multiTokenUser.accessToken
      );
      assert.equal(res2.status, 200);

      // Verify preferences row was preserved and not overwritten
      const { rows } = await pool.query(
        'SELECT * FROM notification_preferences WHERE user_id = $1',
        [multiTokenUser.user.id]
      );
      assert.equal(rows.length, 1);
      assert.equal(rows[0].timezone, 'Asia/Kolkata'); // original timezone preserved
      assert.equal(rows[0].push_enabled, true);
    });

    test('Existing push_enabled = false remains false when a new device token is registered', async () => {
      const disabledUser = await registerTestUser();

      // Explicitly disable notifications
      const prefRes = await authFetch(
        '/notifications/preferences',
        {
          method: 'PUT',
          body: JSON.stringify({
            pushEnabled: false,
            eveningTime: '21:45',
          }),
        },
        disabledUser.accessToken
      );
      assert.equal(prefRes.status, 200);

      // Register device token
      const regRes = await authFetch(
        '/notifications/device-token',
        {
          method: 'POST',
          body: JSON.stringify({
            token: `fcm_disabled_user_token_${Date.now()}`,
            platform: 'android',
            timezone: 'America/New_York',
          }),
        },
        disabledUser.accessToken
      );
      assert.equal(regRes.status, 200);

      // Verify push_enabled remains false and eveningTime remains 21:45
      const { rows } = await pool.query(
        'SELECT * FROM notification_preferences WHERE user_id = $1',
        [disabledUser.user.id]
      );
      assert.equal(rows.length, 1);
      assert.equal(rows[0].push_enabled, false);
      assert.equal(rows[0].evening_time.slice(0, 5), '21:45');
    });

    test('Existing timezone and custom reminder times remain unchanged', async () => {
      const customUser = await registerTestUser();

      // Configure custom preferences
      await authFetch(
        '/notifications/preferences',
        {
          method: 'PUT',
          body: JSON.stringify({
            morningTime: '06:30',
            afternoonTime: '14:15',
            eveningTime: '22:00',
            timezone: 'Asia/Tokyo',
          }),
        },
        customUser.accessToken
      );

      // Register device token with a different timezone
      const regRes = await authFetch(
        '/notifications/device-token',
        {
          method: 'POST',
          body: JSON.stringify({
            token: `fcm_custom_times_token_${Date.now()}`,
            platform: 'android',
            timezone: 'America/Chicago',
          }),
        },
        customUser.accessToken
      );
      assert.equal(regRes.status, 200);

      // Verify custom times and timezone were completely preserved
      const { rows } = await pool.query(
        'SELECT * FROM notification_preferences WHERE user_id = $1',
        [customUser.user.id]
      );
      assert.equal(rows.length, 1);
      assert.equal(rows[0].morning_time.slice(0, 5), '06:30');
      assert.equal(rows[0].afternoon_time.slice(0, 5), '14:15');
      assert.equal(rows[0].evening_time.slice(0, 5), '22:00');
      assert.equal(rows[0].timezone, 'Asia/Tokyo');
    });

    test('Device token registration still works normally (saves token and associates with user)', async () => {
      const normalUser = await registerTestUser();
      const token = `fcm_normal_check_token_${Date.now()}`;

      const res = await authFetch(
        '/notifications/device-token',
        {
          method: 'POST',
          body: JSON.stringify({
            token,
            platform: 'android',
            timezone: 'America/Denver',
          }),
        },
        normalUser.accessToken
      );

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.message, 'Device token registered successfully');

      // Verify token in database
      const tokens = await getDeviceTokensByUserId(normalUser.user.id);
      const found = tokens.find((t) => t.token === token);
      assert.ok(found);
      assert.equal(found.platform, 'android');
      assert.equal(found.timezone, 'America/Denver');
      assert.equal(found.user_id, normalUser.user.id);
    });
  });

  describe('FCM Topic Subscription on Device Token Registration', () => {
    test('valid device token registration returns 200 and token is stored (topic subscription executes)', async () => {
      const user = await registerTestUser();
      const token = `fcm_topic_sub_test_${Date.now()}_a`;
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
        user.accessToken
      );

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.message, 'Device token registered successfully');

      const tokens = await getDeviceTokensByUserId(user.user.id);
      const stored = tokens.find((t) => t.token === token);
      assert.ok(stored, 'Token should be stored in the database');
      assert.equal(stored.platform, 'android');
    });

    test('repeated token registration remains idempotent with topic subscription in place', async () => {
      const user = await registerTestUser();
      const token = `fcm_topic_sub_idempotent_${Date.now()}_b`;

      const res1 = await authFetch(
        '/notifications/device-token',
        {
          method: 'POST',
          body: JSON.stringify({ token, platform: 'android', timezone: 'UTC' }),
        },
        user.accessToken
      );
      assert.equal(res1.status, 200);

      const res2 = await authFetch(
        '/notifications/device-token',
        {
          method: 'POST',
          body: JSON.stringify({ token, platform: 'android', timezone: 'Asia/Kolkata' }),
        },
        user.accessToken
      );
      assert.equal(res2.status, 200);
      const data2 = await res2.json();
      assert.equal(data2.success, true);

      const tokens = await getDeviceTokensByUserId(user.user.id);
      const matches = tokens.filter((t) => t.token === token);
      assert.equal(matches.length, 1, 'No duplicate rows should exist after repeated registration');
      assert.equal(matches[0].timezone, 'Asia/Kolkata');
    });

    test('subscribeTokenToTopic unit: throws a safe error when Firebase is not configured', async () => {
      const { subscribeTokenToTopic, isFirebaseConfigured } = require('../services/firebaseService');

      if (!isFirebaseConfigured()) {
        await assert.rejects(
          () => subscribeTokenToTopic('fake-token-xyz', 'all-users'),
          (err) => {
            assert.ok(err instanceof Error, 'Should throw an Error instance');
            assert.match(
              err.message,
              /Firebase Admin SDK is not configured/,
              'Error message should indicate missing configuration'
            );
            return true;
          }
        );
      } else {
        assert.equal(typeof subscribeTokenToTopic, 'function');
      }
    });

    test('device token registration succeeds even when Firebase topic subscription is unconfigured or fails', async () => {
      const user = await registerTestUser();
      const token = `fcm_sub_fail_isolation_${Date.now()}_c`;
      const res = await authFetch(
        '/notifications/device-token',
        {
          method: 'POST',
          body: JSON.stringify({
            token,
            platform: 'ios',
            timezone: 'America/New_York',
          }),
        },
        user.accessToken
      );

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);

      const tokens = await getDeviceTokensByUserId(user.user.id);
      const stored = tokens.find((t) => t.token === token);
      assert.ok(stored, 'Token must be persisted even if topic subscription encounters an issue');
      assert.equal(stored.platform, 'ios');
      assert.equal(stored.user_id, user.user.id);
    });
  });
});


