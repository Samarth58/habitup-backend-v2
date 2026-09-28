const { test, describe, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { pool } = require('../services/db');
const firebaseService = require('../services/firebaseService');
const notificationService = require('../services/notificationService');
const deviceTokenService = require('../services/deviceTokenService');
const { getPersonalizedContent } = require('../services/personalizedNotificationService');
const { processSingleNotification } = require('../services/notificationSchedulerService');
const {
  PANDA_STATES,
  PANDA_TEMPLATES,
  determinePandaState,
  createPandaNotificationPayload,
  handleHabitCompletionPandaNotification,
} = require('../services/pandaNotificationService');

describe('Panda Incomplete Habits & Scheduled Notification Tests', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  const testUserId1 = '11111111-1111-1111-1111-111111111111';
  const testUserId2 = '22222222-2222-2222-2222-222222222222';
  const testDate = '2026-09-28';

  // Helper to mock habit progress database queries
  function mockUserHabitProgress(userProgressMap) {
    mock.method(pool, 'query', async (query, params) => {
      // 1. SELECT COUNT(h.id)::int AS planned
      if (query.includes('SELECT COUNT(h.id)::int AS planned')) {
        const userId = params[0];
        const userProgress = userProgressMap[userId] || { planned: 0, completed: 0 };
        return { rows: [{ planned: userProgress.planned }] };
      }

      // 2. SELECT COUNT(hc.id)::int AS completed
      if (query.includes('SELECT COUNT(hc.id)::int AS completed')) {
        const userId = params[0];
        const userProgress = userProgressMap[userId] || { planned: 0, completed: 0 };
        return { rows: [{ completed: userProgress.completed }] };
      }

      // 3. Notification preference language lookup
      if (query.includes('SELECT preferred_language FROM users')) {
        return { rows: [{ preferred_language: 'en' }] };
      }

      // 4. Notification deliveries insertion / update
      if (query.includes('INSERT INTO notification_deliveries')) {
        return { rows: [{ id: 'deliv-slot-1' }] };
      }
      if (query.includes('UPDATE notification_deliveries')) {
        return { rows: [] };
      }

      return { rows: [] };
    });
  }

  // =========================================================================
  // Requirement A: Incomplete daytime progress -> encouraging
  // =========================================================================
  test('A1. Morning incomplete habits (remaining > 0) produces panda_notification with pandaEmotion = encouraging', async () => {
    mockUserHabitProgress({
      [testUserId1]: { planned: 3, completed: 0 },
    });

    const result = await getPersonalizedContent(testUserId1, 'morning', testDate, 'UTC', 'en');

    assert.ok(result.data, 'Must return data payload');
    assert.equal(result.data.type, 'panda_notification');
    assert.equal(result.data.pandaEmotion, PANDA_STATES.ENCOURAGING);
    assert.equal(result.data.notificationType, 'morning');
    assert.equal(result.data.plannedCount, '3');
    assert.equal(result.data.completedCount, '0');
    assert.equal(result.data.remainingCount, '3');
    assert.equal(result.data.remainingHabits, '3');
  });

  test('A2. Afternoon incomplete habits (remaining > 0) produces panda_notification with pandaEmotion = encouraging', async () => {
    mockUserHabitProgress({
      [testUserId1]: { planned: 3, completed: 1 },
    });

    const result = await getPersonalizedContent(testUserId1, 'afternoon', testDate, 'UTC', 'en');

    assert.ok(result.data, 'Must return data payload');
    assert.equal(result.data.type, 'panda_notification');
    assert.equal(result.data.pandaEmotion, PANDA_STATES.ENCOURAGING);
    assert.equal(result.data.notificationType, 'afternoon');
    assert.equal(result.data.plannedCount, '3');
    assert.equal(result.data.completedCount, '1');
    assert.equal(result.data.remainingCount, '2');
    assert.equal(result.data.remainingHabits, '2');
  });

  // =========================================================================
  // Requirement B: Incomplete evening progress -> sad
  // =========================================================================
  test('B. Evening incomplete habits (remaining > 0) produces panda_notification with pandaEmotion = sad', async () => {
    mockUserHabitProgress({
      [testUserId1]: { planned: 3, completed: 1 },
    });

    const result = await getPersonalizedContent(testUserId1, 'evening', testDate, 'UTC', 'en');

    assert.ok(result.data, 'Must return data payload');
    assert.equal(result.data.type, 'panda_notification');
    assert.equal(result.data.pandaEmotion, PANDA_STATES.SAD);
    assert.equal(result.data.notificationType, 'evening');
    assert.equal(result.data.plannedCount, '3');
    assert.equal(result.data.completedCount, '1');
    assert.equal(result.data.remainingCount, '2');
    assert.equal(result.data.remainingHabits, '2');
  });

  // =========================================================================
  // Requirement C: All habits completed -> no encouraging/sad Panda notification
  // =========================================================================
  test('C. All habits completed (remaining = 0) returns habit_progress celebration, not encouraging/sad', async () => {
    mockUserHabitProgress({
      [testUserId1]: { planned: 3, completed: 3 },
    });

    const afternoonResult = await getPersonalizedContent(testUserId1, 'afternoon', testDate, 'UTC', 'en');
    assert.equal(afternoonResult.data.type, 'habit_progress');
    assert.equal(afternoonResult.data.pandaEmotion, undefined);
    assert.equal(afternoonResult.data.remainingCount, '0');

    const eveningResult = await getPersonalizedContent(testUserId1, 'evening', testDate, 'UTC', 'en');
    assert.equal(eveningResult.data.type, 'habit_progress');
    assert.equal(eveningResult.data.pandaEmotion, undefined);
    assert.equal(eveningResult.data.remainingCount, '0');
  });

  // =========================================================================
  // Requirement D: Zero habits (rest day) -> no encouraging/sad Panda notification
  // =========================================================================
  test('D. 0 planned habits returns habit_progress rest day message, not encouraging/sad', async () => {
    mockUserHabitProgress({
      [testUserId1]: { planned: 0, completed: 0 },
    });

    const morningResult = await getPersonalizedContent(testUserId1, 'morning', testDate, 'UTC', 'en');
    assert.equal(morningResult.data.type, 'habit_progress');
    assert.equal(morningResult.data.pandaEmotion, undefined);
    assert.equal(morningResult.data.plannedCount, '0');
    assert.equal(morningResult.data.remainingCount, '0');
  });

  // =========================================================================
  // Requirement E: Deduplication via notification_deliveries
  // =========================================================================
  test('E. Scheduler deduplication prevents duplicate push when called multiple times in same window', async () => {
    mock.method(firebaseService, 'isFirebaseConfigured', () => true);
    const sentPushes = [];
    mock.method(firebaseService, 'getFirebaseMessaging', () => ({
      send: async (payload) => {
        sentPushes.push(payload);
        return 'msg-dedupe-1';
      },
    }));

    let alreadyClaimed = false;
    mock.method(pool, 'query', async (query) => {
      if (query.includes('INSERT INTO notification_deliveries')) {
        if (!alreadyClaimed) {
          alreadyClaimed = true;
          return { rows: [{ id: 'deliv-slot-unique' }] };
        }
        return { rows: [] }; // Conflict on second run
      }
      if (query.includes('FROM device_tokens')) {
        return { rows: [{ token: 'device-token-123', platform: 'android', timezone: 'UTC' }] };
      }
      if (query.includes('SELECT COUNT(h.id)::int AS planned')) {
        return { rows: [{ planned: 2 }] };
      }
      if (query.includes('SELECT COUNT(hc.id)::int AS completed')) {
        return { rows: [{ completed: 0 }] };
      }
      if (query.includes('SELECT preferred_language FROM users')) {
        return { rows: [{ preferred_language: 'en' }] };
      }
      if (query.includes('UPDATE notification_deliveries')) {
        return { rows: [] };
      }
      return { rows: [] };
    });

    const summary = { sent: 0, alreadyDelivered: 0, failed: 0, skippedNoToken: 0 };

    // Cycle 1 at 08:00
    await processSingleNotification(testUserId1, 'morning', testDate, '08:00', 'UTC', summary, 'en');
    assert.equal(sentPushes.length, 1, 'First cycle dispatches notification');
    assert.equal(sentPushes[0].data.type, 'panda_notification');
    assert.equal(sentPushes[0].data.pandaEmotion, 'encouraging');

    // Cycle 2 at 08:01 (same window slot)
    await processSingleNotification(testUserId1, 'morning', testDate, '08:00', 'UTC', summary, 'en');
    assert.equal(sentPushes.length, 1, 'Second cycle must NOT dispatch duplicate notification');
    assert.equal(summary.alreadyDelivered, 1);
  });

  // =========================================================================
  // Requirement F: User completes remaining habit before subsequent reminder
  // =========================================================================
  test('F. Completing remaining habits turns subsequent evening reminder into celebration instead of sad', async () => {
    // 1. Afternoon state: 1 of 2 habits remaining -> encouraging
    let completedCount = 1;
    mock.method(pool, 'query', async (query) => {
      if (query.includes('SELECT COUNT(h.id)::int AS planned')) {
        return { rows: [{ planned: 2 }] };
      }
      if (query.includes('SELECT COUNT(hc.id)::int AS completed')) {
        return { rows: [{ completed: completedCount }] };
      }
      return { rows: [] };
    });

    const afternoonRes = await getPersonalizedContent(testUserId1, 'afternoon', testDate, 'UTC', 'en');
    assert.equal(afternoonRes.data.pandaEmotion, PANDA_STATES.ENCOURAGING);

    // 2. User completes the final habit in the afternoon
    completedCount = 2;

    // 3. Evening scheduled reminder runs
    const eveningRes = await getPersonalizedContent(testUserId1, 'evening', testDate, 'UTC', 'en');
    assert.equal(eveningRes.data.type, 'habit_progress', 'No longer panda_notification because remaining = 0');
    assert.equal(eveningRes.data.pandaEmotion, undefined);
    assert.equal(eveningRes.data.remainingCount, '0');
  });

  // =========================================================================
  // Requirement G: User isolation
  // =========================================================================
  test('G. User progress is strictly isolated; user 1 incomplete does not make user 2 sad', async () => {
    mockUserHabitProgress({
      [testUserId1]: { planned: 2, completed: 0 }, // User 1: 2 remaining
      [testUserId2]: { planned: 2, completed: 2 }, // User 2: 0 remaining
    });

    const user1Evening = await getPersonalizedContent(testUserId1, 'evening', testDate, 'UTC', 'en');
    assert.equal(user1Evening.data.type, 'panda_notification');
    assert.equal(user1Evening.data.pandaEmotion, PANDA_STATES.SAD);
    assert.equal(user1Evening.data.remainingCount, '2');

    const user2Evening = await getPersonalizedContent(testUserId2, 'evening', testDate, 'UTC', 'en');
    assert.equal(user2Evening.data.type, 'habit_progress');
    assert.equal(user2Evening.data.pandaEmotion, undefined);
    assert.equal(user2Evening.data.remainingCount, '0');
  });

  // =========================================================================
  // Requirement H: Existing Panda completion regression tests remain intact
  // =========================================================================
  test('H1. Normal habit completion triggers happy (regression check)', async () => {
    mock.method(firebaseService, 'isFirebaseConfigured', () => true);
    mock.method(deviceTokenService, 'getDeviceTokensByUserId', async () => [{ token: 'fcm-token-1' }]);
    mock.method(pool, 'query', async () => ({ rows: [{ planned: 3, completed: 1 }] }));

    const sentList = [];
    mock.method(notificationService, 'sendPushNotification', async (token, payload) => {
      sentList.push(payload);
      return { success: true };
    });

    const result = await handleHabitCompletionPandaNotification({
      userId: testUserId1,
      habitId: 'habit-reg-1',
      streak: 2,
      timezone: 'UTC',
    });

    assert.equal(result.sent, true);
    assert.equal(result.state, PANDA_STATES.HAPPY);
    assert.equal(sentList[0].data.pandaEmotion, 'happy');
  });

  test('H2. Completing final habit triggers celebrating (regression check)', async () => {
    mock.method(firebaseService, 'isFirebaseConfigured', () => true);
    mock.method(deviceTokenService, 'getDeviceTokensByUserId', async () => [{ token: 'fcm-token-1' }]);
    mock.method(pool, 'query', async (q) => {
      if (q.includes('INSERT INTO notification_deliveries')) return { rows: [{ id: 'deliv-cel' }] };
      if (q.includes('SELECT COUNT(h.id)::int AS planned')) return { rows: [{ planned: 2 }] };
      if (q.includes('SELECT COUNT(hc.id)::int AS completed')) return { rows: [{ completed: 2 }] };
      return { rows: [] };
    });

    const sentList = [];
    mock.method(notificationService, 'sendPushNotification', async (token, payload) => {
      sentList.push(payload);
      return { success: true };
    });

    const result = await handleHabitCompletionPandaNotification({
      userId: testUserId1,
      habitId: 'habit-reg-2',
      streak: 2,
      timezone: 'UTC',
    });

    assert.equal(result.sent, true);
    assert.equal(result.state, PANDA_STATES.CELEBRATING);
    assert.equal(sentList[0].data.pandaEmotion, 'celebrating');
  });

  test('H3. Milestone completion triggers excited (regression check)', async () => {
    mock.method(firebaseService, 'isFirebaseConfigured', () => true);
    mock.method(deviceTokenService, 'getDeviceTokensByUserId', async () => [{ token: 'fcm-token-1' }]);
    mock.method(pool, 'query', async (q) => {
      if (q.includes('INSERT INTO notification_deliveries')) return { rows: [{ id: 'deliv-exc' }] };
      if (q.includes('SELECT COUNT(h.id)::int AS planned')) return { rows: [{ planned: 3 }] };
      if (q.includes('SELECT COUNT(hc.id)::int AS completed')) return { rows: [{ completed: 1 }] };
      return { rows: [] };
    });

    const sentList = [];
    mock.method(notificationService, 'sendPushNotification', async (token, payload) => {
      sentList.push(payload);
      return { success: true };
    });

    const result = await handleHabitCompletionPandaNotification({
      userId: testUserId1,
      habitId: 'habit-reg-3',
      streak: 7, // 7-day milestone
      timezone: 'UTC',
    });

    assert.equal(result.sent, true);
    assert.equal(result.state, PANDA_STATES.EXCITED);
    assert.equal(sentList[0].data.pandaEmotion, 'excited');
  });

  // =========================================================================
  // Requirement I: FCM payload string types verification
  // =========================================================================
  test('I. All data payload values are strict strings for FCM compliance', async () => {
    mockUserHabitProgress({
      [testUserId1]: { planned: 5, completed: 2 },
    });

    const morningResult = await getPersonalizedContent(testUserId1, 'morning', testDate, 'UTC', 'en');
    for (const [key, val] of Object.entries(morningResult.data)) {
      assert.equal(typeof val, 'string', `Morning data.${key} must be string`);
    }

    const eveningResult = await getPersonalizedContent(testUserId1, 'evening', testDate, 'UTC', 'en');
    for (const [key, val] of Object.entries(eveningResult.data)) {
      assert.equal(typeof val, 'string', `Evening data.${key} must be string`);
    }
  });
});
