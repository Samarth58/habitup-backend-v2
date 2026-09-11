require('dotenv').config();
const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  MORNING_TEMPLATES,
  AFTERNOON_TEMPLATES,
  EVENING_TEMPLATES,
  TEMPLATE_POOLS,
} = require('../services/broadcastTemplates');
const {
  fnv1a32,
  computeDeterministicIndex,
  getBroadcastForSlot,
  processAutomatedBroadcasts,
  BROADCAST_SLOTS,
  BROADCAST_TIMEZONE,
} = require('../services/broadcastScheduleService');
const { pool } = require('../services/db');
const firebaseService = require('../services/firebaseService');
const { CATEGORIES } = require('../controllers/broadcastController');

const originalFirebaseMessaging = firebaseService.getFirebaseMessaging;
const sentTopicMessages = [];
const messagingStub = {
  send: async (message) => {
    sentTopicMessages.push(message);
    return 'mock-topic-msg-id-123';
  },
};

after(async () => {
  firebaseService.getFirebaseMessaging = originalFirebaseMessaging;
  // Cleanup test deliveries created during tests
  try {
    await pool.query("DELETE FROM broadcast_deliveries WHERE slot_key LIKE '%test%' OR broadcast_date >= '2099-01-01'");
  } catch (err) {
    // ignore if table doesn't exist yet in test env
  }
});

describe('Automated Broadcast Copy & Template Pool Validity', () => {
  test('all 3 pools exist with exactly 14 templates each (42 total)', () => {
    assert.equal(MORNING_TEMPLATES.length, 14, 'Morning pool must have 14 templates');
    assert.equal(AFTERNOON_TEMPLATES.length, 14, 'Afternoon pool must have 14 templates');
    assert.equal(EVENING_TEMPLATES.length, 14, 'Evening pool must have 14 templates');
    assert.equal(Object.keys(TEMPLATE_POOLS).length, 3);
  });

  test('all templates have valid non-empty title, body, and recognized category', () => {
    for (const [poolName, templates] of Object.entries(TEMPLATE_POOLS)) {
      templates.forEach((t, i) => {
        assert.ok(t.title && typeof t.title === 'string' && t.title.trim().length > 0, `${poolName}[${i}] missing title`);
        assert.ok(t.title.length <= 120, `${poolName}[${i}] title exceeds 120 chars`);
        assert.ok(t.body && typeof t.body === 'string' && t.body.trim().length > 0, `${poolName}[${i}] missing body`);
        assert.ok(t.body.length <= 1000, `${poolName}[${i}] body exceeds 1000 chars`);
        assert.ok(CATEGORIES.has(t.category), `${poolName}[${i}] invalid category: ${t.category}`);
      });
    }
  });
});

describe('Deterministic Selection & Variation Engine', () => {
  test('same date + slot produces 100% identical template repeatedly', () => {
    const res1 = getBroadcastForSlot('morning_blast', '2026-09-11');
    const res2 = getBroadcastForSlot('morning_blast', '2026-09-11');
    const res3 = getBroadcastForSlot('morning_blast', '2026-09-11');

    assert.equal(res1.title, res2.title);
    assert.equal(res1.body, res2.body);
    assert.equal(res1.index, res2.index);
    assert.equal(res2.title, res3.title);
  });

  test('consecutive dates produce variety without same-index collision', () => {
    const dates = [
      '2026-09-11',
      '2026-09-12',
      '2026-09-13',
      '2026-09-14',
      '2026-09-15',
      '2026-09-16',
      '2026-09-17',
    ];

    for (const slotKey of ['morning_blast', 'afternoon_blast', 'evening_blast']) {
      for (let i = 1; i < dates.length; i++) {
        const prev = getBroadcastForSlot(slotKey, dates[i - 1]);
        const curr = getBroadcastForSlot(slotKey, dates[i]);
        assert.notEqual(
          curr.index,
          prev.index,
          `Slot ${slotKey} on ${dates[i]} should not match previous day ${dates[i - 1]}`
        );
      }
    }
  });

  test('slot separation: morning, afternoon, and evening pick from their own pools', () => {
    const date = '2026-09-15';
    const morning = getBroadcastForSlot('morning_blast', date);
    const afternoon = getBroadcastForSlot('afternoon_blast', date);
    const evening = getBroadcastForSlot('evening_blast', date);

    assert.ok(MORNING_TEMPLATES.some((t) => t.title === morning.title));
    assert.ok(AFTERNOON_TEMPLATES.some((t) => t.title === afternoon.title));
    assert.ok(EVENING_TEMPLATES.some((t) => t.title === evening.title));

    // The 3 daily notifications on any given date are distinct
    assert.notEqual(morning.title, afternoon.title);
    assert.notEqual(afternoon.title, evening.title);
    assert.notEqual(morning.title, evening.title);
  });

  test('weekly progression maintains deterministic distribution', () => {
    const week1 = getBroadcastForSlot('morning_blast', '2026-09-01');
    const week2 = getBroadcastForSlot('morning_blast', '2026-09-08');
    const week3 = getBroadcastForSlot('morning_blast', '2026-09-15');

    assert.ok(typeof week1.index === 'number');
    assert.ok(typeof week2.index === 'number');
    assert.ok(typeof week3.index === 'number');
  });
});

describe('Slot Triggering & Schedule Timing', () => {
  test('trigger times match 10:30, 15:30, and 19:30 exactly', () => {
    assert.equal(BROADCAST_SLOTS['10:30'], 'morning_blast');
    assert.equal(BROADCAST_SLOTS['15:30'], 'afternoon_blast');
    assert.equal(BROADCAST_SLOTS['19:30'], 'evening_blast');
    assert.equal(BROADCAST_TIMEZONE, 'Asia/Kolkata');
  });

  test('processAutomatedBroadcasts returns no_slot_due outside the 3 broadcast minutes', async () => {
    // 10:31 IST (not a trigger time)
    const offTime = new Date('2026-09-11T05:01:00.000Z'); // 10:31 AM IST
    const result = await processAutomatedBroadcasts(offTime, 'Asia/Kolkata');
    assert.equal(result.attempted, false);
    assert.equal(result.status, 'no_slot_due');
  });
});

describe('Database Deduplication & FCM Dispatch Integration', () => {
  test('atomically prevents duplicate sends for the same slot on the same date', async () => {
    firebaseService.getFirebaseMessaging = () => messagingStub;
    sentTopicMessages.length = 0;

    // Use a unique future test date
    const testDate = '2099-12-31';
    // 10:30 AM IST = 05:00:00 UTC
    const morningTime = new Date(`${testDate}T05:00:00.000Z`);

    // First run claims slot and sends
    const res1 = await processAutomatedBroadcasts(morningTime, 'Asia/Kolkata');
    assert.equal(res1.attempted, true);
    assert.equal(res1.slotKey, 'morning_blast');
    assert.equal(res1.status, 'sent');
    assert.equal(sentTopicMessages.length, 1);
    assert.equal(sentTopicMessages[0].topic, 'all-users');
    assert.equal(sentTopicMessages[0].data.type, 'engagement_broadcast');

    // Second run within the same minute or tick should be rejected by DB constraint
    const res2 = await processAutomatedBroadcasts(morningTime, 'Asia/Kolkata');
    assert.equal(res2.attempted, false);
    assert.equal(res2.status, 'already_claimed');
    // FCM must NOT have been called a second time
    assert.equal(sentTopicMessages.length, 1);

    // Verify DB record status is 'sent'
    const { rows } = await pool.query(
      'SELECT slot_key, broadcast_date, status, message_id FROM broadcast_deliveries WHERE broadcast_date = $1',
      [testDate]
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].status, 'sent');
    assert.equal(rows[0].message_id, 'mock-topic-msg-id-123');
  });

  test('FCM failure transitions status to failed and logs error without resending', async () => {
    firebaseService.getFirebaseMessaging = () => ({
      send: async () => {
        throw new Error('FCM network unreachable');
      },
    });

    const testDate = '2099-12-30';
    const afternoonTime = new Date(`${testDate}T10:00:00.000Z`); // 15:30 IST

    const res = await processAutomatedBroadcasts(afternoonTime, 'Asia/Kolkata');
    assert.equal(res.attempted, true);
    assert.equal(res.status, 'failed');

    const { rows } = await pool.query(
      'SELECT status, error_message FROM broadcast_deliveries WHERE broadcast_date = $1 AND slot_key = $2',
      [testDate, 'afternoon_blast']
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].status, 'failed');
    assert.match(rows[0].error_message, /FCM network unreachable/);
  });
});
