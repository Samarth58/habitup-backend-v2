const { pool } = require('./db');
const { TEMPLATE_POOLS } = require('./broadcastTemplates');
const { sendTopicPushNotification, isFirebaseConfigured } = require('./notificationService');

const ALL_USERS_TOPIC = 'all-users';
const BROADCAST_TIMEZONE = 'Asia/Kolkata';

/**
 * Extracts local date (YYYY-MM-DD) and local time (HH:mm)
 * for a given UTC Date and IANA timezone name.
 * Duplicated from notificationSchedulerService to avoid circular dependency.
 */
function getLocalDateTime(date, timeZone) {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const partMap = {};
    for (const part of parts) {
      partMap[part.type] = part.value;
    }
    let hour = partMap.hour;
    if (hour === '24') hour = '00';
    return {
      localDate: `${partMap.year}-${partMap.month}-${partMap.day}`,
      localTime: `${hour}:${partMap.minute}`,
    };
  } catch (err) {
    const utcDate = date.toISOString().slice(0, 10);
    const utcTime = date.toISOString().slice(11, 16);
    return { localDate: utcDate, localTime: utcTime };
  }
}

const BROADCAST_SLOTS = {
  '10:30': 'morning_blast',
  '15:30': 'afternoon_blast',
  '19:30': 'evening_blast',
};

/**
 * 32-bit FNV-1a hash algorithm for fast, uniform, deterministic hashing.
 * Dependency-free, stable across restarts and architectures.
 *
 * @param {string} str - Input string
 * @returns {number} 32-bit unsigned integer hash
 */
function fnv1a32(str) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * Computes previous calendar date in YYYY-MM-DD format.
 *
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @returns {string} Previous date 'YYYY-MM-DD'
 */
function getPreviousDateString(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

/**
 * Computes deterministic index for a given date and slotKey.
 * Applies a deterministic +1 collision shift if the index matches the previous day's index.
 *
 * @param {string} slotKey - 'morning_blast' | 'afternoon_blast' | 'evening_blast'
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @param {number} poolLength - Total templates in pool
 * @returns {number} Deterministic template index
 */
function computeDeterministicIndex(slotKey, dateStr, poolLength) {
  if (!poolLength || poolLength <= 0) return 0;

  const rawSeed = fnv1a32(`${dateStr}:${slotKey}`);
  let index = rawSeed % poolLength;

  // Collision prevention: avoid repeating same index as previous day in the same slot
  const prevDateStr = getPreviousDateString(dateStr);
  const prevSeed = fnv1a32(`${prevDateStr}:${slotKey}`);
  const prevIndex = prevSeed % poolLength;

  if (index === prevIndex && poolLength > 1) {
    index = (index + 1) % poolLength;
  }

  return index;
}

/**
 * Resolves the deterministic template for a slot and date.
 *
 * @param {string} slotKey - 'morning_blast' | 'afternoon_blast' | 'evening_blast'
 * @param {string|Date} dateOrStr - 'YYYY-MM-DD' or Date object
 * @returns {{ title: string, body: string, category: string, index: number, slotKey: string }}
 */
function getBroadcastForSlot(slotKey, dateOrStr) {
  const pool = TEMPLATE_POOLS[slotKey];
  if (!pool || pool.length === 0) {
    throw new Error(`Invalid or empty template pool for slot: ${slotKey}`);
  }

  const dateStr = typeof dateOrStr === 'string'
    ? dateOrStr.slice(0, 10)
    : dateOrStr.toISOString().slice(0, 10);

  const index = computeDeterministicIndex(slotKey, dateStr, pool.length);
  const template = pool[index];

  return {
    ...template,
    index,
    slotKey,
    date: dateStr,
  };
}

/**
 * Processes automated broadcast dispatches for the given timestamp.
 * Checks against the Asia/Kolkata timezone schedule (10:30, 15:30, 19:30).
 *
 * @param {Date} [currentTime=new Date()]
 * @param {string} [timeZone=BROADCAST_TIMEZONE]
 * @returns {Promise<{ attempted: boolean, slotKey: string|null, status: string }>}
 */
async function processAutomatedBroadcasts(currentTime = new Date(), timeZone = BROADCAST_TIMEZONE) {
  const { localDate, localTime } = getLocalDateTime(currentTime, timeZone);
  const slotKey = BROADCAST_SLOTS[localTime];

  if (!slotKey) {
    return { attempted: false, slotKey: null, status: 'no_slot_due' };
  }

  const template = getBroadcastForSlot(slotKey, localDate);

  // 1. Atomically claim slot in database via UNIQUE(slot_key, broadcast_date)
  let deliveryId = null;
  try {
    const insertRes = await pool.query(
      `INSERT INTO broadcast_deliveries (
        slot_key,
        broadcast_date,
        title,
        body,
        category,
        status,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, 'processing', NOW())
      ON CONFLICT (slot_key, broadcast_date)
      DO NOTHING
      RETURNING id`,
      [slotKey, localDate, template.title, template.body, template.category]
    );

    if (insertRes.rows.length === 0) {
      // Already claimed/sent for this slot and date
      return { attempted: false, slotKey, status: 'already_claimed' };
    }

    deliveryId = insertRes.rows[0].id;
  } catch (err) {
    console.error('[processAutomatedBroadcasts] DB claim error:', err.message);
    return { attempted: false, slotKey, status: 'db_error' };
  }

  // 2. Check Firebase configuration
  if (!isFirebaseConfigured()) {
    await pool.query(
      `UPDATE broadcast_deliveries
       SET status = 'failed', error_message = 'Firebase Admin SDK is not configured', sent_at = NOW()
       WHERE id = $1`,
      [deliveryId]
    );
    return { attempted: true, slotKey, status: 'firebase_unconfigured' };
  }

  // 3. Dispatch to FCM topic 'all-users'
  try {
    const fcmRes = await sendTopicPushNotification(ALL_USERS_TOPIC, {
      title: template.title,
      body: template.body,
      data: {
        type: 'engagement_broadcast',
        audience: ALL_USERS_TOPIC,
        category: template.category,
        slotKey,
      },
    });

    await pool.query(
      `UPDATE broadcast_deliveries
       SET status = 'sent', message_id = $1, sent_at = NOW()
       WHERE id = $2`,
      [fcmRes.messageId || null, deliveryId]
    );

    return { attempted: true, slotKey, status: 'sent' };
  } catch (fcmErr) {
    console.error('[processAutomatedBroadcasts] FCM dispatch failed:', fcmErr.message);
    await pool.query(
      `UPDATE broadcast_deliveries
       SET status = 'failed', error_message = $1, sent_at = NOW()
       WHERE id = $2`,
      [fcmErr.message || 'FCM dispatch error', deliveryId]
    );
    return { attempted: true, slotKey, status: 'failed' };
  }
}

module.exports = {
  ALL_USERS_TOPIC,
  BROADCAST_TIMEZONE,
  BROADCAST_SLOTS,
  fnv1a32,
  computeDeterministicIndex,
  getBroadcastForSlot,
  processAutomatedBroadcasts,
};
