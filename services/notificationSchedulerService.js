const { pool } = require('./db');
const { getDeviceTokensByUserId, deleteDeviceToken } = require('./deviceTokenService');
const { sendPushNotification } = require('./notificationService');
const { getPersonalizedContent } = require('./personalizedNotificationService');

/**
 * Standard notification templates for morning, afternoon, and evening.
 */
const NOTIFICATION_TEMPLATES = {
  morning: {
    title: 'Good morning! 🌅',
    body: 'Start your day by completing your habits.',
  },
  afternoon: {
    title: 'HabitUp reminder',
    body: 'Take a moment to check your habits.',
  },
  evening: {
    title: 'Evening check-in 🌙',
    body: 'See how you did with your habits today.',
  },
};

/**
 * Extracts the user's local date (YYYY-MM-DD) and local time (HH:mm)
 * for a given UTC Date and IANA timezone name.
 * Handles daylight saving time and day transitions cleanly.
 *
 * @param {Date} date - UTC timestamp
 * @param {string} timeZone - IANA timezone identifier (e.g. 'Asia/Kolkata', 'America/New_York')
 * @returns {{ localDate: string, localTime: string }}
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

    const localDate = `${partMap.year}-${partMap.month}-${partMap.day}`;
    const localTime = `${hour}:${partMap.minute}`;

    return { localDate, localTime };
  } catch (err) {
    // If timezone is invalid or unsupported, fallback safely to UTC
    const utcDate = date.toISOString().slice(0, 10);
    const utcTime = date.toISOString().slice(11, 16);
    return { localDate: utcDate, localTime: utcTime };
  }
}

/**
 * Processes a single notification delivery for a user.
 * Atomically reserves the delivery slot via database constraint,
 * loads device tokens, sends FCM notifications, and updates delivery status.
 *
 * @param {string} userId
 * @param {'morning'|'afternoon'|'evening'} notificationType
 * @param {string} localDate
 * @param {string} localTime
 * @param {string} timezone
 * @param {object} summary - Mutable result summary counter
 */
async function processSingleNotification(userId, notificationType, localDate, localTime, timezone, summary) {
  let deliveryId = null;

  try {
    // Atomically claim delivery slot to prevent duplicate sends across concurrent workers or retries
    const insertRes = await pool.query(
      `INSERT INTO notification_deliveries (
        user_id,
        notification_type,
        scheduled_local_date,
        scheduled_local_time,
        timezone,
        status,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, 'processing', NOW())
      ON CONFLICT (user_id, notification_type, scheduled_local_date, scheduled_local_time)
      DO NOTHING
      RETURNING id`,
      [userId, notificationType, localDate, localTime, timezone]
    );

    if (insertRes.rows.length === 0) {
      // Already claimed or sent for this scheduled date/time slot
      if (summary) summary.alreadyDelivered++;
      return;
    }

    deliveryId = insertRes.rows[0].id;
  } catch (claimErr) {
    console.error('[notificationScheduler] Failed to claim delivery slot:', claimErr.message);
    return;
  }

  // Load device tokens
  let deviceTokens = [];
  try {
    deviceTokens = await getDeviceTokensByUserId(userId);
  } catch (tokenErr) {
    console.error(`[notificationScheduler] Error fetching tokens for user ${userId}:`, tokenErr.message);
    await pool.query(
      `UPDATE notification_deliveries
       SET status = 'failed', error_message = $1, sent_at = NOW()
       WHERE id = $2`,
      [tokenErr.message, deliveryId]
    );
    if (summary) summary.failed++;
    return;
  }

  if (!deviceTokens || deviceTokens.length === 0) {
    await pool.query(
      `UPDATE notification_deliveries
       SET status = 'skipped_no_token', error_message = 'No device tokens registered', sent_at = NOW()
       WHERE id = $1`,
      [deliveryId]
    );
    if (summary) summary.skippedNoToken++;
    return;
  }

  // Compute personalized notification content based on user's actual habit progress.
  // Falls back to a generic message automatically on any error, so one user's failure
  // cannot stop the scheduler.
  const { title, body, data } = await getPersonalizedContent(userId, notificationType, localDate, timezone);

  let anySent = false;
  let lastError = null;

  for (const dt of deviceTokens) {
    try {
      await sendPushNotification(dt.token, { title, body, data });
      anySent = true;
    } catch (sendErr) {
      lastError = sendErr.message || String(sendErr);
      console.error(`[notificationScheduler] Push dispatch failed for token on user ${userId}:`, lastError);

      // Auto-prune invalid or unregistered tokens so we don't repeatedly fail on stale test tokens
      if (
        sendErr.code === 'messaging/invalid-registration-token' ||
        sendErr.code === 'messaging/registration-token-not-registered' ||
        sendErr.code === 'messaging/invalid-argument' ||
        (sendErr.message && sendErr.message.includes('not a valid FCM registration token'))
      ) {
        try {
          await deleteDeviceToken(dt.token);
          console.log(`[notificationScheduler] Pruned invalid device token for user ${userId}`);
        } catch (pruneErr) {
          console.error(`[notificationScheduler] Failed to prune invalid token:`, pruneErr.message);
        }
      }
    }
  }

  if (anySent) {
    await pool.query(
      `UPDATE notification_deliveries
       SET status = 'sent', device_count = $1, sent_at = NOW()
       WHERE id = $2`,
      [deviceTokens.length, deliveryId]
    );
    if (summary) summary.sent++;
  } else {
    await pool.query(
      `UPDATE notification_deliveries
       SET status = 'failed', error_message = $1, sent_at = NOW()
       WHERE id = $2`,
      [lastError || 'Failed to dispatch to registered devices', deliveryId]
    );
    if (summary) summary.failed++;
  }
}

/**
 * Runs one scheduler cycle for the given current time.
 * Evaluates all users with push_enabled = true and sends due notifications.
 *
 * @param {Date} [currentTime=new Date()]
 * @returns {Promise<{ processedUsers: number, dueNotifications: number, sent: number, skippedNoToken: number, alreadyDelivered: number, failed: number }>}
 */
async function processScheduledNotifications(currentTime = new Date()) {
  const summary = {
    processedUsers: 0,
    dueNotifications: 0,
    sent: 0,
    skippedNoToken: 0,
    alreadyDelivered: 0,
    failed: 0,
  };

  try {
    const { rows: userPrefs } = await pool.query(`
      SELECT user_id, push_enabled, morning_enabled, afternoon_enabled, evening_enabled,
             morning_time, afternoon_time, evening_time, timezone
      FROM notification_preferences
      WHERE push_enabled = true
    `);

    summary.processedUsers = userPrefs.length;

    for (const pref of userPrefs) {
      const tz = pref.timezone || 'UTC';
      const { localDate, localTime } = getLocalDateTime(currentTime, tz);

      const morningTime = typeof pref.morning_time === 'string' ? pref.morning_time.slice(0, 5) : '08:00';
      const afternoonTime = typeof pref.afternoon_time === 'string' ? pref.afternoon_time.slice(0, 5) : '13:00';
      const eveningTime = typeof pref.evening_time === 'string' ? pref.evening_time.slice(0, 5) : '20:00';

      const dueTypes = [];
      if (pref.morning_enabled && morningTime === localTime) {
        dueTypes.push('morning');
      }
      if (pref.afternoon_enabled && afternoonTime === localTime) {
        dueTypes.push('afternoon');
      }
      if (pref.evening_enabled && eveningTime === localTime) {
        dueTypes.push('evening');
      }

      for (const type of dueTypes) {
        summary.dueNotifications++;
        await processSingleNotification(pref.user_id, type, localDate, localTime, tz, summary);
      }
    }
  } catch (err) {
    console.error('[notificationScheduler] Scheduler cycle failure:', err.message);
  }

  return summary;
}

let schedulerInterval = null;

/**
 * Starts the periodic background notification scheduler.
 *
 * @param {number} [intervalMs=60000] - Interval between scheduler cycles in milliseconds
 * @returns {object|null} Timer handle
 */
function startScheduler(intervalMs = 60000) {
  if (schedulerInterval) {
    return schedulerInterval;
  }

  schedulerInterval = setInterval(() => {
    processScheduledNotifications().catch((err) => {
      console.error('[notificationScheduler] Background scheduler cycle error:', err.message);
    });
  }, intervalMs);

  if (schedulerInterval.unref) {
    schedulerInterval.unref();
  }

  return schedulerInterval;
}

/**
 * Stops the periodic background notification scheduler.
 */
function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}

module.exports = {
  getLocalDateTime,
  processScheduledNotifications,
  processSingleNotification,
  startScheduler,
  stopScheduler,
  NOTIFICATION_TEMPLATES,
};
