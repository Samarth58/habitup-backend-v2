const { test, describe, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const {
  PANDA_STATES,
  PANDA_TEMPLATES,
  DEFAULT_STREAK_MILESTONES,
  isStreakMilestone,
  getPandaMessage,
  determinePandaState,
  createPandaNotificationPayload,
  handleHabitCompletionPandaNotification,
} = require('./pandaNotificationService');
const firebaseService = require('./firebaseService');
const notificationService = require('./notificationService');
const deviceTokenService = require('./deviceTokenService');
const personalizedNotificationService = require('./personalizedNotificationService');
const { pool } = require('./db');

describe('Panda Notification Service Unit Tests', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  // 1. Template copy checks
  test('Templates have exact predefined copy and HabitUp title without emojis', () => {
    assert.equal(PANDA_TEMPLATES[PANDA_STATES.HAPPY].title, 'HabitUp');
    assert.equal(PANDA_TEMPLATES[PANDA_STATES.HAPPY].body, 'Great job! You completed your habit. Keep going!');

    assert.equal(PANDA_TEMPLATES[PANDA_STATES.CELEBRATING].title, 'HabitUp');
    assert.equal(PANDA_TEMPLATES[PANDA_STATES.CELEBRATING].body, "Amazing! You've completed all your habits for today!");

    assert.equal(PANDA_TEMPLATES[PANDA_STATES.ENCOURAGING].title, 'HabitUp');
    assert.equal(PANDA_TEMPLATES[PANDA_STATES.ENCOURAGING].body, 'You still have a habit waiting for you. You can do it!');

    assert.equal(PANDA_TEMPLATES[PANDA_STATES.EXCITED].title, 'HabitUp');
    assert.equal(PANDA_TEMPLATES[PANDA_STATES.EXCITED].body, 'Amazing! You reached a new streak milestone!');
  });

  // 2. Milestone calculations
  test('isStreakMilestone correctly identifies default milestones', () => {
    assert.equal(isStreakMilestone(3), true);
    assert.equal(isStreakMilestone(7), true);
    assert.equal(isStreakMilestone(14), true);
    assert.equal(isStreakMilestone(21), true);
    assert.equal(isStreakMilestone(30), true);
    assert.equal(isStreakMilestone(50), true);
    assert.equal(isStreakMilestone(100), true);
    assert.equal(isStreakMilestone(365), true);

    assert.equal(isStreakMilestone(1), false);
    assert.equal(isStreakMilestone(2), false);
    assert.equal(isStreakMilestone(4), false);
    assert.equal(isStreakMilestone(0), false);
    assert.equal(isStreakMilestone(-5), false);
  });

  // 3. Priority and State Determination: Only one state selected
  test('State determination prioritization: milestone (excited) > all completed (celebrating) > habit completed (happy)', () => {
    // Condition 1: Milestone reached + all completed (both true) -> EXCITED takes priority
    const priority1 = determinePandaState({ isCompleted: true, remainingHabits: 0, streak: 7 });
    assert.equal(priority1, PANDA_STATES.EXCITED);

    // Condition 2: All completed (remaining=0), not milestone -> CELEBRATING
    const priority2 = determinePandaState({ isCompleted: true, remainingHabits: 0, streak: 2 });
    assert.equal(priority2, PANDA_STATES.CELEBRATING);

    // Condition 3: Normal completion (remaining=1), not milestone -> HAPPY
    const priority3 = determinePandaState({ isCompleted: true, remainingHabits: 1, streak: 2 });
    assert.equal(priority3, PANDA_STATES.HAPPY);

    // Condition 4: Incomplete habits check -> ENCOURAGING
    const priority4 = determinePandaState({ isCompleted: false, remainingHabits: 2 });
    assert.equal(priority4, PANDA_STATES.ENCOURAGING);
  });

  // 4. handleHabitCompletionPandaNotification: Normal completion -> happy
  test('1. Normal habit completion triggers happy notification', async () => {
    mock.method(firebaseService, 'isFirebaseConfigured', () => true);
    mock.method(deviceTokenService, 'getDeviceTokensByUserId', async () => [{ token: 'fcm-token-1' }]);
    mock.method(personalizedNotificationService, 'getHabitProgressForDate', async () => ({
      planned: 2,
      completed: 1,
      remaining: 1,
    }));
    const sendMock = mock.method(notificationService, 'sendPushNotification', async () => ({
      success: true,
      messageId: 'msg-1',
    }));

    const result = await handleHabitCompletionPandaNotification({
      userId: '123e4567-e89b-12d3-a456-426614174000',
      habitId: 'habit-1',
      streak: 1,
      timezone: 'UTC',
    });

    assert.equal(result.sent, true);
    assert.equal(result.state, PANDA_STATES.HAPPY);
    assert.equal(sendMock.mock.callCount(), 1);
    assert.equal(sendMock.mock.calls[0].arguments[1].body, 'Great job! You completed your habit. Keep going!');
  });

  // 5. handleHabitCompletionPandaNotification: Final habit completed -> celebrating
  test('2. Completing final remaining habit triggers celebrating notification with deduplication', async () => {
    mock.method(firebaseService, 'isFirebaseConfigured', () => true);
    mock.method(deviceTokenService, 'getDeviceTokensByUserId', async () => [{ token: 'fcm-token-1' }]);
    mock.method(personalizedNotificationService, 'getHabitProgressForDate', async () => ({
      planned: 2,
      completed: 2,
      remaining: 0,
    }));
    mock.method(pool, 'query', async (query) => {
      if (query.includes('INSERT INTO notification_deliveries')) {
        return { rows: [{ id: 'deliv-1' }] };
      }
      if (query.includes('UPDATE notification_deliveries')) {
        return { rows: [] };
      }
      return { rows: [] };
    });
    const sendMock = mock.method(notificationService, 'sendPushNotification', async () => ({
      success: true,
      messageId: 'msg-2',
    }));

    const result = await handleHabitCompletionPandaNotification({
      userId: '123e4567-e89b-12d3-a456-426614174000',
      habitId: 'habit-2',
      streak: 2,
      timezone: 'UTC',
    });

    assert.equal(result.sent, true);
    assert.equal(result.state, PANDA_STATES.CELEBRATING);
    assert.equal(sendMock.mock.callCount(), 1);
    assert.equal(
      sendMock.mock.calls[0].arguments[1].body,
      "Amazing! You've completed all your habits for today!"
    );
  });

  // 6. handleHabitCompletionPandaNotification: Streak milestone -> excited
  test('3. Streak milestone triggers excited notification', async () => {
    mock.method(firebaseService, 'isFirebaseConfigured', () => true);
    mock.method(deviceTokenService, 'getDeviceTokensByUserId', async () => [{ token: 'fcm-token-1' }]);
    mock.method(personalizedNotificationService, 'getHabitProgressForDate', async () => ({
      planned: 3,
      completed: 1,
      remaining: 2,
    }));
    mock.method(pool, 'query', async () => ({ rows: [{ id: 'deliv-2' }] }));
    const sendMock = mock.method(notificationService, 'sendPushNotification', async () => ({
      success: true,
      messageId: 'msg-3',
    }));

    const result = await handleHabitCompletionPandaNotification({
      userId: '123e4567-e89b-12d3-a456-426614174000',
      habitId: 'habit-1',
      streak: 7, // 7-day milestone
      timezone: 'UTC',
    });

    assert.equal(result.sent, true);
    assert.equal(result.state, PANDA_STATES.EXCITED);
    assert.equal(sendMock.mock.callCount(), 1);
    assert.equal(sendMock.mock.calls[0].arguments[1].body, 'Amazing! You reached a new streak milestone!');
  });

  // 7. handleHabitCompletionPandaNotification: No device token -> no push sent
  test('4. User without active device tokens does not trigger push', async () => {
    mock.method(firebaseService, 'isFirebaseConfigured', () => true);
    mock.method(deviceTokenService, 'getDeviceTokensByUserId', async () => []);
    const sendMock = mock.method(notificationService, 'sendPushNotification', async () => {});

    const result = await handleHabitCompletionPandaNotification({
      userId: '123e4567-e89b-12d3-a456-426614174000',
      habitId: 'habit-1',
      streak: 1,
      timezone: 'UTC',
    });

    assert.equal(result.sent, false);
    assert.equal(result.reason, 'no_device_tokens');
    assert.equal(sendMock.mock.callCount(), 0);
  });

  // 8. handleHabitCompletionPandaNotification: FCM failure handled safely
  test('5. FCM delivery error is handled safely without throwing', async () => {
    mock.method(firebaseService, 'isFirebaseConfigured', () => true);
    mock.method(deviceTokenService, 'getDeviceTokensByUserId', async () => [{ token: 'invalid-token' }]);
    mock.method(personalizedNotificationService, 'getHabitProgressForDate', async () => ({
      planned: 1,
      completed: 1,
      remaining: 0,
    }));
    mock.method(pool, 'query', async () => ({ rows: [{ id: 'deliv-fail' }] }));
    const deleteTokenMock = mock.method(deviceTokenService, 'deleteDeviceToken', async () => true);
    mock.method(notificationService, 'sendPushNotification', async () => {
      const err = new Error('Requested entity was not found.');
      err.code = 'messaging/registration-token-not-registered';
      throw err;
    });

    const result = await handleHabitCompletionPandaNotification({
      userId: '123e4567-e89b-12d3-a456-426614174000',
      habitId: 'habit-1',
      streak: 1,
      timezone: 'UTC',
    });

    assert.equal(result.sent, false);
    assert.equal(deleteTokenMock.mock.callCount(), 1, 'Auto-prunes unregistered token');
  });

  // 9. Duplicate protection test
  test('6. Duplicate celebrating notification on same day is prevented by delivery reservation', async () => {
    mock.method(firebaseService, 'isFirebaseConfigured', () => true);
    mock.method(deviceTokenService, 'getDeviceTokensByUserId', async () => [{ token: 'fcm-token-1' }]);
    mock.method(personalizedNotificationService, 'getHabitProgressForDate', async () => ({
      planned: 2,
      completed: 2,
      remaining: 0,
    }));
    // Simulate already claimed in notification_deliveries (rows: [])
    mock.method(pool, 'query', async (query) => {
      if (query.includes('INSERT INTO notification_deliveries')) {
        return { rows: [] }; // Conflict, 0 rows returned
      }
      return { rows: [] };
    });
    const sendMock = mock.method(notificationService, 'sendPushNotification', async () => ({ success: true }));

    const result = await handleHabitCompletionPandaNotification({
      userId: '123e4567-e89b-12d3-a456-426614174000',
      habitId: 'habit-2',
      streak: 2,
      timezone: 'UTC',
    });

    assert.equal(result.sent, false);
    assert.equal(result.reason, 'already_delivered_today');
    assert.equal(sendMock.mock.callCount(), 0, 'Does not send duplicate push');
  });
});
