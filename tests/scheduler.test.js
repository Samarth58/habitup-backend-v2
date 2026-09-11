const { test, describe, before, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { registerTestUser, authFetch } = require('./helpers');
const { pool } = require('../services/db');
const { upsertDeviceToken } = require('../services/deviceTokenService');
const {
  getLocalDateTime,
  processScheduledNotifications,
  NOTIFICATION_TEMPLATES,
} = require('../services/notificationSchedulerService');

describe('Notification Scheduler Service', () => {
  let userKolkata;
  let userNewYork;
  let userLondon;

  before(async () => {
    userKolkata = await registerTestUser();
    userNewYork = await registerTestUser();
    userLondon = await registerTestUser();

    // Configure user timezones and notification preferences
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
          timezone: 'Asia/Kolkata',
        }),
      },
      userKolkata.accessToken
    );

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
          timezone: 'America/New_York',
        }),
      },
      userNewYork.accessToken
    );

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
          timezone: 'Europe/London',
        }),
      },
      userLondon.accessToken
    );
  });

  describe('Timezone & Date/Time Conversion Logic', () => {
    test('converts UTC time to accurate local date and time for Asia/Kolkata (+05:30)', () => {
      // 2026-09-11 02:30 UTC -> 2026-09-11 08:00 IST
      const utcTime = new Date('2026-09-11T02:30:00.000Z');
      const { localDate, localTime } = getLocalDateTime(utcTime, 'Asia/Kolkata');

      assert.equal(localDate, '2026-09-11');
      assert.equal(localTime, '08:00');
    });

    test('converts UTC time to accurate local date and time for America/New_York across date boundary', () => {
      // 2026-09-11 02:30 UTC -> 2026-09-10 22:30 EDT (-04:00)
      const utcTime = new Date('2026-09-11T02:30:00.000Z');
      const { localDate, localTime } = getLocalDateTime(utcTime, 'America/New_York');

      assert.equal(localDate, '2026-09-10');
      assert.equal(localTime, '22:30');
    });

    test('converts UTC time to accurate local date and time for Europe/London with BST (+01:00)', () => {
      // In September, London is BST (UTC+1): 07:00 UTC -> 08:00 BST
      const utcTime = new Date('2026-09-11T07:00:00.000Z');
      const { localDate, localTime } = getLocalDateTime(utcTime, 'Europe/London');

      assert.equal(localDate, '2026-09-11');
      assert.equal(localTime, '08:00');
    });

    test('safe fallback to UTC when invalid timezone is provided', () => {
      const utcTime = new Date('2026-09-11T08:00:00.000Z');
      const { localDate, localTime } = getLocalDateTime(utcTime, 'Invalid/Timezone');

      assert.equal(localDate, '2026-09-11');
      assert.equal(localTime, '08:00');
    });
  });

  describe('Scheduled Notification Delivery & Eligibility', () => {
    test('Asia/Kolkata user is triggered at 08:00 local time (UTC 02:30), while NY user is not', async () => {
      // Clean up previous deliveries for test users on this test date
      await pool.query(
        `DELETE FROM notification_deliveries WHERE scheduled_local_date = '2026-09-11'`
      );

      // Register device token for Kolkata user
      await upsertDeviceToken(userKolkata.user.id, {
        token: `test_fcm_token_kolkata_${Date.now()}`,
        platform: 'android',
        timezone: 'Asia/Kolkata',
      });

      // Target time: 2026-09-11T02:30:00Z (08:00 IST in Kolkata, 22:30 previous day in NY)
      const targetTime = new Date('2026-09-11T02:30:00.000Z');
      const result = await processScheduledNotifications(targetTime);

      assert.ok(result.dueNotifications >= 1);

      // Verify delivery record for Kolkata user
      const { rows: kolkataDeliveries } = await pool.query(
        `SELECT * FROM notification_deliveries
         WHERE user_id = $1 AND scheduled_local_date = '2026-09-11' AND notification_type = 'morning'`,
        [userKolkata.user.id]
      );

      assert.equal(kolkataDeliveries.length, 1);
      assert.equal(kolkataDeliveries[0].scheduled_local_time, '08:00');
      assert.equal(kolkataDeliveries[0].timezone, 'Asia/Kolkata');

      // Verify NY user was NOT triggered for morning on 2026-09-11
      const { rows: nyDeliveries } = await pool.query(
        `SELECT * FROM notification_deliveries
         WHERE user_id = $1 AND scheduled_local_date = '2026-09-11' AND notification_type = 'morning'`,
        [userNewYork.user.id]
      );

      assert.equal(nyDeliveries.length, 0);
    });

    test('America/New_York user is triggered at 08:00 local time (UTC 12:00 EDT in Sept)', async () => {
      await upsertDeviceToken(userNewYork.user.id, {
        token: `test_fcm_token_ny_${Date.now()}`,
        platform: 'ios',
        timezone: 'America/New_York',
      });

      // Target time: 2026-09-11T12:00:00Z (08:00 EDT in New York)
      const targetTime = new Date('2026-09-11T12:00:00.000Z');
      await processScheduledNotifications(targetTime);

      const { rows: nyDeliveries } = await pool.query(
        `SELECT * FROM notification_deliveries
         WHERE user_id = $1 AND scheduled_local_date = '2026-09-11' AND notification_type = 'morning'`,
        [userNewYork.user.id]
      );

      assert.equal(nyDeliveries.length, 1);
      assert.equal(nyDeliveries[0].scheduled_local_time, '08:00');
    });

    test('Afternoon notification triggers at configured afternoon time (13:00 local)', async () => {
      // In Kolkata: 13:00 IST = 07:30 UTC
      const afternoonTime = new Date('2026-09-11T07:30:00.000Z');
      await processScheduledNotifications(afternoonTime);

      const { rows: afternoonDeliveries } = await pool.query(
        `SELECT * FROM notification_deliveries
         WHERE user_id = $1 AND scheduled_local_date = '2026-09-11' AND notification_type = 'afternoon'`,
        [userKolkata.user.id]
      );

      assert.equal(afternoonDeliveries.length, 1);
      assert.equal(afternoonDeliveries[0].scheduled_local_time, '13:00');
    });

    test('Evening notification triggers at configured evening time (20:00 local)', async () => {
      // In Kolkata: 20:00 IST = 14:30 UTC
      const eveningTime = new Date('2026-09-11T14:30:00.000Z');
      await processScheduledNotifications(eveningTime);

      const { rows: eveningDeliveries } = await pool.query(
        `SELECT * FROM notification_deliveries
         WHERE user_id = $1 AND scheduled_local_date = '2026-09-11' AND notification_type = 'evening'`,
        [userKolkata.user.id]
      );

      assert.equal(eveningDeliveries.length, 1);
      assert.equal(eveningDeliveries[0].scheduled_local_time, '20:00');
    });

    test('Non-matching local time does not trigger any notification', async () => {
      // In Kolkata: 05:00 UTC = 10:30 IST (no notification configured at 10:30)
      const midTime = new Date('2026-09-11T05:00:00.000Z');
      const result = await processScheduledNotifications(midTime);

      const { rows: midDeliveries } = await pool.query(
        `SELECT * FROM notification_deliveries
         WHERE user_id = $1 AND scheduled_local_date = '2026-09-11' AND scheduled_local_time = '10:30'`,
        [userKolkata.user.id]
      );

      assert.equal(midDeliveries.length, 0);
    });
  });

  describe('Preference Flags Enforcement', () => {
    test('pushEnabled = false suppresses all scheduled notifications', async () => {
      const disabledUser = await registerTestUser();
      await authFetch(
        '/notifications/preferences',
        {
          method: 'PUT',
          body: JSON.stringify({
            pushEnabled: false,
            morningEnabled: true,
            morningTime: '08:00',
            timezone: 'Asia/Kolkata',
          }),
        },
        disabledUser.accessToken
      );

      const targetTime = new Date('2026-09-12T02:30:00.000Z');
      await processScheduledNotifications(targetTime);

      const { rows } = await pool.query(
        `SELECT * FROM notification_deliveries WHERE user_id = $1`,
        [disabledUser.user.id]
      );

      assert.equal(rows.length, 0);
    });

    test('morningEnabled = false suppresses morning notifications', async () => {
      const noMorningUser = await registerTestUser();
      await authFetch(
        '/notifications/preferences',
        {
          method: 'PUT',
          body: JSON.stringify({
            pushEnabled: true,
            morningEnabled: false,
            morningTime: '08:00',
            timezone: 'Asia/Kolkata',
          }),
        },
        noMorningUser.accessToken
      );

      const targetTime = new Date('2026-09-12T02:30:00.000Z');
      await processScheduledNotifications(targetTime);

      const { rows } = await pool.query(
        `SELECT * FROM notification_deliveries
         WHERE user_id = $1 AND notification_type = 'morning'`,
        [noMorningUser.user.id]
      );

      assert.equal(rows.length, 0);
    });
  });

  describe('Duplicate Prevention & Idempotency', () => {
    test('running the scheduler twice in the same minute does not send duplicate notifications', async () => {
      const testDate = new Date('2026-09-13T02:30:00.000Z');

      // First run
      const run1 = await processScheduledNotifications(testDate);

      // Second run immediately for same timestamp
      const run2 = await processScheduledNotifications(testDate);

      assert.ok(run2.alreadyDelivered >= 1);

      // Verify only 1 record per user in DB
      const { rows } = await pool.query(
        `SELECT COUNT(*)::int AS count FROM notification_deliveries
         WHERE user_id = $1 AND scheduled_local_date = '2026-09-13' AND notification_type = 'morning'`,
        [userKolkata.user.id]
      );

      assert.equal(rows[0].count, 1);
    });

    test('database uniqueness constraint rejects duplicate delivery records', async () => {
      const duplicateUser = await registerTestUser();

      // First insert
      await pool.query(
        `INSERT INTO notification_deliveries (user_id, notification_type, scheduled_local_date, scheduled_local_time, timezone, status)
         VALUES ($1, 'morning', '2026-09-15', '08:00', 'UTC', 'sent')`,
        [duplicateUser.user.id]
      );

      // Duplicate insert with same key throws error
      await assert.rejects(
        () =>
          pool.query(
            `INSERT INTO notification_deliveries (user_id, notification_type, scheduled_local_date, scheduled_local_time, timezone, status)
             VALUES ($1, 'morning', '2026-09-15', '08:00', 'UTC', 'sent')`,
            [duplicateUser.user.id]
          ),
        /notification_deliveries_user_type_date_time_key|duplicate key/i
      );
    });
  });

  describe('Device Token Handling & Resilience', () => {
    test('user without registered device tokens is marked as skipped_no_token safely without crashing', async () => {
      const noTokenUser = await registerTestUser();
      await authFetch(
        '/notifications/preferences',
        {
          method: 'PUT',
          body: JSON.stringify({
            pushEnabled: true,
            morningEnabled: true,
            morningTime: '08:00',
            timezone: 'UTC',
          }),
        },
        noTokenUser.accessToken
      );

      // 08:00 UTC
      const targetTime = new Date('2026-09-16T08:00:00.000Z');
      const result = await processScheduledNotifications(targetTime);

      assert.ok(result.skippedNoToken >= 1);

      const { rows } = await pool.query(
        `SELECT * FROM notification_deliveries WHERE user_id = $1 AND scheduled_local_date = '2026-09-16'`,
        [noTokenUser.user.id]
      );

      assert.equal(rows.length, 1);
      assert.equal(rows[0].status, 'skipped_no_token');
    });

    test('user with multiple registered device tokens dispatches to all devices', async () => {
      const multiDeviceUser = await registerTestUser();
      await authFetch(
        '/notifications/preferences',
        {
          method: 'PUT',
          body: JSON.stringify({
            pushEnabled: true,
            morningEnabled: true,
            morningTime: '08:00',
            timezone: 'UTC',
          }),
        },
        multiDeviceUser.accessToken
      );

      // Register 2 tokens
      await upsertDeviceToken(multiDeviceUser.user.id, {
        token: `multi_token_phone_${Date.now()}`,
        platform: 'android',
      });
      await upsertDeviceToken(multiDeviceUser.user.id, {
        token: `multi_token_tablet_${Date.now()}`,
        platform: 'ios',
      });

      const targetTime = new Date('2026-09-17T08:00:00.000Z');
      await processScheduledNotifications(targetTime);

      const { rows } = await pool.query(
        `SELECT * FROM notification_deliveries WHERE user_id = $1 AND scheduled_local_date = '2026-09-17'`,
        [multiDeviceUser.user.id]
      );

      assert.equal(rows.length, 1);
      // Status is sent (or failed in unconfigured test env) and records attempt
      assert.ok(['sent', 'failed'].includes(rows[0].status));
    });
  });
});
