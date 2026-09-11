const { test, describe, before, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { registerTestUser, authFetch } = require('./helpers');
const { pool } = require('../services/db');
const { upsertDeviceToken } = require('../services/deviceTokenService');
const {
  getPersonalizedContent,
  getHabitProgressForDate,
  getDayOfWeekFromDateStr,
  buildMorningContent,
  buildAfternoonContent,
  buildEveningContent,
} = require('../services/personalizedNotificationService');
const { processScheduledNotifications } = require('../services/notificationSchedulerService');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a habit for a user via the API and returns the habit object.
 */
async function createHabit(accessToken, data) {
  const res = await authFetch('/habits', { method: 'POST', body: JSON.stringify(data) }, accessToken);
  const body = await res.json();
  assert.ok(res.status === 201, `createHabit failed (${res.status}): ${JSON.stringify(body)}`);
  return body.habit;
}

/**
 * Inserts a habit_completion row directly into the DB for a specific date string.
 * Used to simulate completions on past/future dates that the API doesn't support.
 */
async function insertCompletion(userId, habitId, dateStr) {
  await pool.query(
    `INSERT INTO habit_completions (habit_id, user_id, completion_date)
     VALUES ($1, $2, $3)
     ON CONFLICT (habit_id, completion_date) DO NOTHING`,
    [habitId, userId, dateStr]
  );
}

/**
 * Removes a habit_completion row for a specific date.
 */
async function deleteCompletion(userId, habitId, dateStr) {
  await pool.query(
    `DELETE FROM habit_completions WHERE habit_id = $1 AND user_id = $2 AND completion_date = $3`,
    [habitId, userId, dateStr]
  );
}

// ---------------------------------------------------------------------------
// Pure unit tests — message template builders (no DB required)
// ---------------------------------------------------------------------------

describe('Personalized Notification — Template Builders (unit)', () => {
  describe('buildMorningContent', () => {
    test('0 planned habits returns a rest-day message, not "0 habits"', () => {
      const { title, body } = buildMorningContent(0);
      assert.equal(title, 'Good morning! 🌅');
      assert.match(body, /no habits/i);
      assert.doesNotMatch(body, /0 habit/i);
    });

    test('1 planned habit uses singular and encouraging message', () => {
      const { title, body } = buildMorningContent(1);
      assert.equal(title, 'Good morning! 🌅');
      assert.match(body, /1 habit/i);
    });

    test('4 planned habits uses plural count in body', () => {
      const { title, body } = buildMorningContent(4);
      assert.equal(title, 'Good morning! 🌅');
      assert.match(body, /4 habits/);
    });
  });

  describe('buildAfternoonContent', () => {
    test('0 planned habits returns a rest-day message', () => {
      const { title, body } = buildAfternoonContent(0, 0);
      assert.doesNotMatch(body, /0 habit/i);
      assert.match(body, /no habits/i);
    });

    test('0 of 4 completed returns a "waiting" start prompt', () => {
      const { body } = buildAfternoonContent(4, 0);
      assert.match(body, /4 habit/i);
      assert.match(body, /start with one/i);
    });

    test('2 of 4 completed returns partial progress message', () => {
      const { body } = buildAfternoonContent(4, 2);
      assert.match(body, /2 of 4/);
      assert.match(body, /keep going/i);
    });

    test('all 4 of 4 completed returns celebration message', () => {
      const { body } = buildAfternoonContent(4, 4);
      assert.match(body, /all 4 habit/i);
    });

    test('completed >= planned (edge: completed = 5, planned = 4) does not crash', () => {
      const { body } = buildAfternoonContent(4, 5);
      assert.match(body, /all 4 habit/i);
    });
  });

  describe('buildEveningContent', () => {
    test('0 planned habits returns a rest message', () => {
      const { body } = buildEveningContent(0, 0, 0);
      assert.doesNotMatch(body, /0 habit/i);
      assert.match(body, /no habits/i);
    });

    test('all completed (remaining = 0) returns celebration message', () => {
      const { body } = buildEveningContent(4, 4, 0);
      assert.match(body, /all 4 habit/i);
    });

    test('1 remaining returns "almost there" message', () => {
      const { body } = buildEveningContent(4, 3, 1);
      assert.match(body, /1 habit left/i);
      assert.match(body, /almost there/i);
    });

    test('3 remaining returns "still time" message with correct count', () => {
      const { body } = buildEveningContent(4, 1, 3);
      assert.match(body, /3 habits left/i);
    });
  });

  describe('getDayOfWeekFromDateStr', () => {
    test('2026-09-13 is a Sunday (0)', () => {
      // 2026-09-13 is confirmed Sunday
      assert.equal(getDayOfWeekFromDateStr('2026-09-13'), 0);
    });

    test('2026-09-14 is a Monday (1)', () => {
      assert.equal(getDayOfWeekFromDateStr('2026-09-14'), 1);
    });

    test('2026-09-11 is a Friday (5)', () => {
      // 2026-09-11 is Friday
      assert.equal(getDayOfWeekFromDateStr('2026-09-11'), 5);
    });
  });
});

// ---------------------------------------------------------------------------
// Integration tests — DB queries and scheduler interaction
// ---------------------------------------------------------------------------

describe('Personalized Notification — Integration', () => {
  let user;

  // We pin a specific test date to make DB assertions deterministic.
  // All tests use the same date string; individual tests clean up their own data.
  const TEST_DATE = '2026-09-21'; // Monday (1)
  const TEST_DATE_DOW = 1; // Monday

  before(async () => {
    user = await registerTestUser();
    // Set notification preferences with a timezone so the scheduler can find this user
    await authFetch(
      '/notifications/preferences',
      {
        method: 'PUT',
        body: JSON.stringify({
          pushEnabled: true,
          morningEnabled: true,
          morningTime: '08:00',
          afternoonEnabled: true,
          afternoonTime: '13:00',
          eveningEnabled: true,
          eveningTime: '20:00',
          timezone: 'UTC',
        }),
      },
      user.accessToken
    );
  });

  // ------ getHabitProgressForDate ------

  describe('getHabitProgressForDate — schedule filtering', () => {
    test('habit scheduled for today (Monday) is counted as planned', async () => {
      // Schedule habit for Monday (1) = TEST_DATE_DOW
      const habit = await createHabit(user.accessToken, {
        name: `Monday Habit ${Date.now()}`,
        frequency_type: 'scheduled',
        days: [TEST_DATE_DOW], // Monday
      });

      const { planned } = await getHabitProgressForDate(user.user.id, TEST_DATE);
      assert.ok(planned >= 1, `Expected at least 1 planned, got ${planned}`);

      // Cleanup
      await authFetch(`/habits/${habit.id}`, { method: 'DELETE' }, user.accessToken);
    });

    test('habit scheduled ONLY for Tuesday is NOT counted on Monday (TEST_DATE)', async () => {
      const tuesdayDow = 2;
      // Confirm TEST_DATE is NOT Tuesday
      assert.notEqual(TEST_DATE_DOW, tuesdayDow);

      const { planned: before } = await getHabitProgressForDate(user.user.id, TEST_DATE);

      const habit = await createHabit(user.accessToken, {
        name: `Tuesday-Only Habit ${Date.now()}`,
        frequency_type: 'scheduled',
        days: [tuesdayDow], // Tuesday only
      });

      const { planned: after } = await getHabitProgressForDate(user.user.id, TEST_DATE);
      assert.equal(after, before, 'Tuesday-only habit must not add to Monday planned count');

      // Cleanup
      await authFetch(`/habits/${habit.id}`, { method: 'DELETE' }, user.accessToken);
    });

    test('daily habit always counts regardless of day', async () => {
      const { planned: before } = await getHabitProgressForDate(user.user.id, TEST_DATE);

      const habit = await createHabit(user.accessToken, {
        name: `Daily Habit ${Date.now()}`,
        frequency_type: 'daily',
      });

      const { planned: after } = await getHabitProgressForDate(user.user.id, TEST_DATE);
      assert.equal(after, before + 1);

      // Cleanup
      await authFetch(`/habits/${habit.id}`, { method: 'DELETE' }, user.accessToken);
    });

    test('paused habit is excluded from planned count', async () => {
      const habit = await createHabit(user.accessToken, {
        name: `Paused Habit ${Date.now()}`,
        frequency_type: 'daily',
      });

      const { planned: before } = await getHabitProgressForDate(user.user.id, TEST_DATE);

      // Pause the habit
      await authFetch(`/habits/${habit.id}/pause`, { method: 'PATCH' }, user.accessToken);

      const { planned: after } = await getHabitProgressForDate(user.user.id, TEST_DATE);
      assert.equal(after, before - 1, 'Paused habit should not count as planned');

      // Cleanup (unpause then delete)
      await authFetch(`/habits/${habit.id}/unpause`, { method: 'PATCH' }, user.accessToken);
      await authFetch(`/habits/${habit.id}`, { method: 'DELETE' }, user.accessToken);
    });

    test('archived habit is excluded from planned count', async () => {
      const habit = await createHabit(user.accessToken, {
        name: `Archived Habit ${Date.now()}`,
        frequency_type: 'daily',
      });

      const { planned: before } = await getHabitProgressForDate(user.user.id, TEST_DATE);

      await authFetch(`/habits/${habit.id}/archive`, { method: 'PATCH' }, user.accessToken);

      const { planned: after } = await getHabitProgressForDate(user.user.id, TEST_DATE);
      assert.equal(after, before - 1, 'Archived habit should not count as planned');

      // Cleanup
      await authFetch(`/habits/${habit.id}/unarchive`, { method: 'PATCH' }, user.accessToken);
      await authFetch(`/habits/${habit.id}`, { method: 'DELETE' }, user.accessToken);
    });

    test('soft-deleted habit is excluded from planned count', async () => {
      const habit = await createHabit(user.accessToken, {
        name: `To-Delete Habit ${Date.now()}`,
        frequency_type: 'daily',
      });

      const { planned: before } = await getHabitProgressForDate(user.user.id, TEST_DATE);

      await authFetch(`/habits/${habit.id}`, { method: 'DELETE' }, user.accessToken);

      const { planned: after } = await getHabitProgressForDate(user.user.id, TEST_DATE);
      assert.equal(after, before - 1, 'Deleted habit should not count as planned');
    });
  });

  describe('getHabitProgressForDate — completion counting', () => {
    test('completed habit for TEST_DATE is counted in completed', async () => {
      const habit = await createHabit(user.accessToken, {
        name: `Completion Test ${Date.now()}`,
        frequency_type: 'daily',
      });

      const { completed: before } = await getHabitProgressForDate(user.user.id, TEST_DATE);

      await insertCompletion(user.user.id, habit.id, TEST_DATE);

      const { completed: after } = await getHabitProgressForDate(user.user.id, TEST_DATE);
      assert.equal(after, before + 1);

      // Cleanup
      await deleteCompletion(user.user.id, habit.id, TEST_DATE);
      await authFetch(`/habits/${habit.id}`, { method: 'DELETE' }, user.accessToken);
    });

    test('remaining = planned - completed, never negative', async () => {
      const { planned, completed, remaining } = await getHabitProgressForDate(user.user.id, TEST_DATE);
      assert.equal(remaining, Math.max(0, planned - completed));
      assert.ok(remaining >= 0);
    });

    test('completion on a DIFFERENT date does not count for TEST_DATE', async () => {
      const habit = await createHabit(user.accessToken, {
        name: `Wrong Date Habit ${Date.now()}`,
        frequency_type: 'daily',
      });

      const { completed: before } = await getHabitProgressForDate(user.user.id, TEST_DATE);

      // Insert completion for a different date
      await insertCompletion(user.user.id, habit.id, '2026-09-22');

      const { completed: after } = await getHabitProgressForDate(user.user.id, TEST_DATE);
      assert.equal(after, before, 'Completion on different date must not affect TEST_DATE count');

      // Cleanup
      await deleteCompletion(user.user.id, habit.id, '2026-09-22');
      await authFetch(`/habits/${habit.id}`, { method: 'DELETE' }, user.accessToken);
    });
  });

  // ------ getPersonalizedContent — morning ------

  describe('getPersonalizedContent — morning', () => {
    test('0 planned: returns non-zero-habits message', async () => {
      // Use a user with no habits at all
      const freshUser = await registerTestUser();
      const result = await getPersonalizedContent(freshUser.user.id, 'morning', TEST_DATE, 'UTC');
      assert.ok(result.title);
      assert.ok(result.body);
      assert.doesNotMatch(result.body, /0 habit/i);
    });

    test('1 planned: returns singular-habit message', async () => {
      const freshUser = await registerTestUser();
      await createHabit(freshUser.accessToken, {
        name: `Solo Morning Habit ${Date.now()}`,
        frequency_type: 'daily',
      });

      const result = await getPersonalizedContent(freshUser.user.id, 'morning', TEST_DATE, 'UTC');
      assert.match(result.body, /1 habit/i);
    });

    test('multiple planned: returns count in body', async () => {
      const freshUser = await registerTestUser();
      await createHabit(freshUser.accessToken, { name: `M1 ${Date.now()}`, frequency_type: 'daily' });
      await createHabit(freshUser.accessToken, { name: `M2 ${Date.now()}`, frequency_type: 'daily' });
      await createHabit(freshUser.accessToken, { name: `M3 ${Date.now()}`, frequency_type: 'daily' });

      const result = await getPersonalizedContent(freshUser.user.id, 'morning', TEST_DATE, 'UTC');
      assert.match(result.body, /3 habits/);
    });
  });

  // ------ getPersonalizedContent — afternoon ------

  describe('getPersonalizedContent — afternoon', () => {
    test('0 completed of N: returns waiting/start message', async () => {
      const freshUser = await registerTestUser();
      await createHabit(freshUser.accessToken, { name: `Afternoon 0 ${Date.now()}`, frequency_type: 'daily' });

      const result = await getPersonalizedContent(freshUser.user.id, 'afternoon', TEST_DATE, 'UTC');
      // 0 completed, 1 planned
      assert.match(result.body, /start with one/i);
    });

    test('partial completion: returns progress message', async () => {
      const freshUser = await registerTestUser();
      const h1 = await createHabit(freshUser.accessToken, { name: `AP1 ${Date.now()}`, frequency_type: 'daily' });
      await createHabit(freshUser.accessToken, { name: `AP2 ${Date.now()}`, frequency_type: 'daily' });

      await insertCompletion(freshUser.user.id, h1.id, TEST_DATE);

      const result = await getPersonalizedContent(freshUser.user.id, 'afternoon', TEST_DATE, 'UTC');
      assert.match(result.body, /1 of 2/);

      // Cleanup
      await deleteCompletion(freshUser.user.id, h1.id, TEST_DATE);
    });

    test('all completed: returns celebration message', async () => {
      const freshUser = await registerTestUser();
      const h = await createHabit(freshUser.accessToken, { name: `AllDone ${Date.now()}`, frequency_type: 'daily' });

      await insertCompletion(freshUser.user.id, h.id, TEST_DATE);

      const result = await getPersonalizedContent(freshUser.user.id, 'afternoon', TEST_DATE, 'UTC');
      assert.match(result.body, /all 1 habit/i);

      // Cleanup
      await deleteCompletion(freshUser.user.id, h.id, TEST_DATE);
    });
  });

  // ------ getPersonalizedContent — evening ------

  describe('getPersonalizedContent — evening', () => {
    test('all completed: returns celebration', async () => {
      const freshUser = await registerTestUser();
      const h = await createHabit(freshUser.accessToken, { name: `Eve Done ${Date.now()}`, frequency_type: 'daily' });

      await insertCompletion(freshUser.user.id, h.id, TEST_DATE);

      const result = await getPersonalizedContent(freshUser.user.id, 'evening', TEST_DATE, 'UTC');
      assert.match(result.body, /all 1 habit/i);

      // Cleanup
      await deleteCompletion(freshUser.user.id, h.id, TEST_DATE);
    });

    test('remaining habits: returns "still time" or "almost there" message', async () => {
      const freshUser = await registerTestUser();
      await createHabit(freshUser.accessToken, { name: `Eve Remain 1 ${Date.now()}`, frequency_type: 'daily' });
      await createHabit(freshUser.accessToken, { name: `Eve Remain 2 ${Date.now()}`, frequency_type: 'daily' });

      // 0 completed, 2 remaining
      const result = await getPersonalizedContent(freshUser.user.id, 'evening', TEST_DATE, 'UTC');
      assert.match(result.body, /2 habits left/i);
    });

    test('0 planned habits: returns rest message without count', async () => {
      const freshUser = await registerTestUser();
      const result = await getPersonalizedContent(freshUser.user.id, 'evening', TEST_DATE, 'UTC');
      assert.doesNotMatch(result.body, /0 habit/i);
    });
  });

  // ------ data payload ------

  describe('getPersonalizedContent — data payload', () => {
    test('returned data contains string-valued habit_progress fields', async () => {
      const freshUser = await registerTestUser();
      const result = await getPersonalizedContent(freshUser.user.id, 'morning', TEST_DATE, 'UTC');

      assert.equal(result.data.type, 'habit_progress');
      assert.equal(result.data.notificationType, 'morning');
      assert.equal(result.data.localDate, TEST_DATE);
      assert.equal(typeof result.data.plannedCount, 'string');
      assert.equal(typeof result.data.completedCount, 'string');
      assert.equal(typeof result.data.remainingCount, 'string');
    });
  });

  // ------ timezone consistency ------

  describe('Timezone — localDate consistency with scheduler', () => {
    test('UTC user: getPersonalizedContent uses the scheduler-provided localDate', async () => {
      // The scheduler computes localDate and passes it in; we pass the same date here.
      // This test verifies that the service uses the supplied localDate, not its own clock.
      const freshUser = await registerTestUser();
      const habit = await createHabit(freshUser.accessToken, {
        name: `TZ Test ${Date.now()}`,
        frequency_type: 'daily',
      });

      // Insert completion for a specific date
      await insertCompletion(freshUser.user.id, habit.id, '2026-09-21');

      const result = await getPersonalizedContent(freshUser.user.id, 'morning', '2026-09-21', 'UTC');
      // The habit exists and is completed; planned >= 1
      assert.ok(Number(result.data.plannedCount) >= 1);

      // Now ask for a DIFFERENT date — should not see that completion
      const result2 = await getPersonalizedContent(freshUser.user.id, 'afternoon', '2026-09-20', 'UTC');
      // 2026-09-20 is a Sunday; habit is daily so still planned, but completion is on 09-21
      assert.equal(result2.data.completedCount, '0');

      // Cleanup
      await deleteCompletion(freshUser.user.id, habit.id, '2026-09-21');
    });
  });

  // ------ error resilience ------

  describe('Error resilience', () => {
    test('getPersonalizedContent with invalid userId returns fallback without throwing', async () => {
      // Non-existent userId: DB queries return 0 counts, not an error
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const result = await getPersonalizedContent(fakeId, 'morning', TEST_DATE, 'UTC');
      // Should either return a fallback or a "0 planned" morning message — must not throw
      assert.ok(result.title);
      assert.ok(result.body);
    });
  });

  // ------ Scheduler integration ------

  describe('Scheduler integration — personalized content delivered', () => {
    test('notification_deliveries record is created when scheduler fires for a due notification', async () => {
      // Use UTC user with morning notification at 08:00 UTC
      const freshUser = await registerTestUser();
      await authFetch(
        '/notifications/preferences',
        {
          method: 'PUT',
          body: JSON.stringify({
            pushEnabled: true,
            morningEnabled: true,
            morningTime: '08:00',
            afternoonEnabled: false,
            eveningEnabled: false,
            timezone: 'UTC',
          }),
        },
        freshUser.accessToken
      );

      // Clean any existing delivery for this date
      await pool.query(
        `DELETE FROM notification_deliveries
         WHERE user_id = $1 AND scheduled_local_date = '2026-09-23'`,
        [freshUser.user.id]
      );

      // Trigger scheduler at 08:00 UTC on 2026-09-23
      const targetTime = new Date('2026-09-23T08:00:00.000Z');
      const result = await processScheduledNotifications(targetTime);

      assert.ok(result.processedUsers >= 1);

      const { rows } = await pool.query(
        `SELECT * FROM notification_deliveries
         WHERE user_id = $1 AND scheduled_local_date = '2026-09-23' AND notification_type = 'morning'`,
        [freshUser.user.id]
      );

      assert.equal(rows.length, 1);
      // Status is 'skipped_no_token' (no device token) or 'sent'/'failed' (if token exists)
      assert.ok(
        ['skipped_no_token', 'sent', 'failed'].includes(rows[0].status),
        `Unexpected status: ${rows[0].status}`
      );
    });

    test('duplicate delivery protection: running scheduler twice for same slot does not duplicate record', async () => {
      const freshUser = await registerTestUser();
      await authFetch(
        '/notifications/preferences',
        {
          method: 'PUT',
          body: JSON.stringify({
            pushEnabled: true,
            morningEnabled: true,
            morningTime: '08:00',
            afternoonEnabled: false,
            eveningEnabled: false,
            timezone: 'UTC',
          }),
        },
        freshUser.accessToken
      );

      const targetTime = new Date('2026-09-24T08:00:00.000Z');

      await pool.query(
        `DELETE FROM notification_deliveries
         WHERE user_id = $1 AND scheduled_local_date = '2026-09-24'`,
        [freshUser.user.id]
      );

      const run1 = await processScheduledNotifications(targetTime);
      const run2 = await processScheduledNotifications(targetTime);

      // Second run should mark this slot as already delivered
      assert.ok(run2.alreadyDelivered >= 1);

      const { rows } = await pool.query(
        `SELECT COUNT(*)::int AS count FROM notification_deliveries
         WHERE user_id = $1 AND scheduled_local_date = '2026-09-24' AND notification_type = 'morning'`,
        [freshUser.user.id]
      );

      assert.equal(rows[0].count, 1, 'Only one delivery record must exist for this slot');
    });
  });
});
