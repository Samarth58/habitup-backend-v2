/**
 * HabitUp Panda Notification Service
 *
 * Provides emotion-based notification states, predefined copy, and integration
 * with the HabitUp habit-completion flow.
 *
 * Supported states:
 * - happy: Individual habit completed
 * - celebrating: All today's planned habits completed
 * - encouraging: Habits remain incomplete during scheduled check
 * - excited: Streak milestone reached
 *
 * Note: Predefined text only (no AI generation, no emojis).
 */

const { pool } = require('./db');
const personalizedNotificationService = require('./personalizedNotificationService');
const deviceTokenService = require('./deviceTokenService');
const notificationService = require('./notificationService');
const firebaseService = require('./firebaseService');

const PANDA_STATES = Object.freeze({
  HAPPY: 'happy',
  CELEBRATING: 'celebrating',
  ENCOURAGING: 'encouraging',
  EXCITED: 'excited',
});

const DEFAULT_STREAK_MILESTONES = Object.freeze([3, 7, 14, 21, 30, 50, 100, 365]);

/**
 * Predefined static message templates for each panda emotion state.
 */
const PANDA_TEMPLATES = Object.freeze({
  [PANDA_STATES.HAPPY]: {
    title: 'HabitUp',
    body: 'Great job! You completed your habit. Keep going!',
  },
  [PANDA_STATES.CELEBRATING]: {
    title: 'HabitUp',
    body: "Amazing! You've completed all your habits for today!",
  },
  [PANDA_STATES.ENCOURAGING]: {
    title: 'HabitUp',
    body: 'You still have a habit waiting for you. You can do it!',
  },
  [PANDA_STATES.EXCITED]: {
    title: 'HabitUp',
    body: 'Amazing! You reached a new streak milestone!',
  },
});

/**
 * Derives current local date string (YYYY-MM-DD) for a given timezone.
 *
 * @param {string} [timezone='UTC'] - IANA timezone
 * @returns {string} Date string 'YYYY-MM-DD'
 */
function getLocalDateInTimezone(timezone = 'UTC') {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(new Date());
    const year = parts.find((p) => p.type === 'year').value;
    const month = parts.find((p) => p.type === 'month').value;
    const day = parts.find((p) => p.type === 'day').value;
    return `${year}-${month}-${day}`;
  } catch (err) {
    return new Date().toISOString().slice(0, 10);
  }
}

/**
 * Checks whether a given streak number qualifies as a milestone.
 *
 * @param {number} streak - Contiguous streak count
 * @param {number[]} [milestones=DEFAULT_STREAK_MILESTONES] - Custom milestone array
 * @returns {boolean} True if the streak is a recognized milestone
 */
function isStreakMilestone(streak, milestones = DEFAULT_STREAK_MILESTONES) {
  if (typeof streak !== 'number' || streak <= 0) {
    return false;
  }
  return milestones.includes(streak);
}

/**
 * Retrieves the static message template for a given panda state.
 *
 * @param {string} state - 'happy' | 'celebrating' | 'encouraging' | 'excited'
 * @returns {{ title: string, body: string }}
 */
function getPandaMessage(state) {
  const template = PANDA_TEMPLATES[state];
  if (!template) {
    throw new Error(`Unknown panda notification state: ${state}`);
  }
  return { ...template };
}

/**
 * Determines the single appropriate panda emotion state from habit context.
 *
 * Priority order:
 * 1. excited (if newly calculated streak is a milestone)
 * 2. celebrating (if all planned habits for today are completed)
 * 3. happy (individual habit completed)
 * 4. encouraging (habits remain incomplete during check)
 *
 * @param {object} params
 * @param {boolean} [params.isCompleted=false] - Whether a habit was just marked completed
 * @param {number} [params.remainingHabits] - Remaining habits count for today
 * @param {number} [params.streak] - Current streak count
 * @param {boolean} [params.isMilestone] - Explicit milestone override flag
 * @returns {string|null} The resolved panda state or null if no condition met
 */
function determinePandaState({ isCompleted = false, remainingHabits, streak, isMilestone } = {}) {
  if (isCompleted) {
    const milestoneReached = isMilestone !== undefined ? isMilestone : isStreakMilestone(streak);
    if (milestoneReached) {
      return PANDA_STATES.EXCITED;
    }

    if (typeof remainingHabits === 'number' && remainingHabits === 0) {
      return PANDA_STATES.CELEBRATING;
    }

    return PANDA_STATES.HAPPY;
  }

  if (typeof remainingHabits === 'number' && remainingHabits > 0) {
    return PANDA_STATES.ENCOURAGING;
  }

  return null;
}

/**
 * Builds the notification payload object ready for FCM dispatch.
 *
 * @param {string} state - Panda emotion state
 * @param {Record<string, string>} [customData={}] - Optional metadata to attach
 * @returns {{ title: string, body: string, data: Record<string, string> }}
 */
function createPandaNotificationPayload(state, customData = {}) {
  const message = getPandaMessage(state);

  const data = {
    type: 'panda_notification',
    pandaEmotion: state,
  };

  if (customData && typeof customData === 'object') {
    for (const [key, val] of Object.entries(customData)) {
      if (val !== undefined && val !== null) {
        data[key] = String(val);
      }
    }
  }

  return {
    title: message.title,
    body: message.body,
    data,
  };
}

/**
 * Orchestrates sending a panda notification following a successful habit completion.
 *
 * Non-blocking and failure-safe: errors are caught and logged so habit completion
 * is never disrupted or rolled back.
 *
 * @param {object} params
 * @param {string} params.userId - User UUID
 * @param {string} params.habitId - Completed habit UUID
 * @param {number} params.streak - Newly calculated streak
 * @param {string} [params.timezone='UTC'] - User's IANA timezone
 * @returns {Promise<{ sent: boolean, state?: string, reason?: string }>}
 */
async function handleHabitCompletionPandaNotification({ userId, habitId, streak, timezone = 'UTC' }) {
  if (!userId) {
    return { sent: false, reason: 'missing_user_id' };
  }

  if (!firebaseService.isFirebaseConfigured()) {
    return { sent: false, reason: 'firebase_not_configured' };
  }

  try {
    // 1. Check for active device tokens before performing progress calculations
    const deviceTokens = await deviceTokenService.getDeviceTokensByUserId(userId);
    if (!deviceTokens || deviceTokens.length === 0) {
      return { sent: false, reason: 'no_device_tokens' };
    }

    const localDate = getLocalDateInTimezone(timezone);

    // 2. Query today's progress to check if all habits are completed
    const progress = await personalizedNotificationService.getHabitProgressForDate(userId, localDate);

    // 3. Determine single panda state according to strict priority
    const pandaState = determinePandaState({
      isCompleted: true,
      remainingHabits: progress.remaining,
      streak,
    });

    if (!pandaState) {
      return { sent: false, reason: 'no_matching_state' };
    }

    let deliveryId = null;

    // 4. Duplicate protection: deduplicate 'celebrating' and 'excited' per user per day via notification_deliveries
    if (pandaState === PANDA_STATES.CELEBRATING || pandaState === PANDA_STATES.EXCITED) {
      const deliveryType = `panda_${pandaState}`;
      const deliveryTime = '00:00';

      try {
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
          [userId, deliveryType, localDate, deliveryTime, timezone]
        );

        if (insertRes.rows.length === 0) {
          // Already sent this milestone or celebrating notification today; skip duplicate push
          return { sent: false, state: pandaState, reason: 'already_delivered_today' };
        }

        deliveryId = insertRes.rows[0].id;
      } catch (claimErr) {
        console.warn('[pandaNotification] Duplicate claim check error (continuing):', claimErr.message);
      }
    }

    // 5. Construct notification payload
    const payload = createPandaNotificationPayload(pandaState, {
      habitId,
      streak: String(streak || 0),
    });

    // 6. Dispatch push to all active user device tokens
    let anySent = false;
    let lastError = null;

    for (const dt of deviceTokens) {
      try {
        await notificationService.sendPushNotification(dt.token, payload);
        anySent = true;
      } catch (sendErr) {
        lastError = sendErr.message || String(sendErr);
        console.error(`[pandaNotification] Push dispatch failed for user ${userId}:`, lastError);

        // Auto-prune dead/invalid registration tokens
        if (
          sendErr.code === 'messaging/invalid-registration-token' ||
          sendErr.code === 'messaging/registration-token-not-registered' ||
          sendErr.code === 'messaging/invalid-argument' ||
          (sendErr.message && (
            sendErr.message.includes('not a valid FCM registration token') ||
            sendErr.message.includes('NotRegistered') ||
            sendErr.message.includes('SenderId mismatch') ||
            sendErr.message.includes('not registered')
          ))
        ) {
          try {
            await deviceTokenService.deleteDeviceToken(dt.token);
          } catch (_) {}
        }
      }
    }

    // 7. Update delivery record status if one was created
    if (deliveryId) {
      await pool.query(
        `UPDATE notification_deliveries
         SET status = $1, device_count = $2, error_message = $3, sent_at = NOW()
         WHERE id = $4`,
        [anySent ? 'sent' : 'failed', deviceTokens.length, anySent ? null : lastError, deliveryId]
      ).catch(() => {});
    }

    return { sent: anySent, state: pandaState };
  } catch (err) {
    console.error(`[pandaNotification] Error handling panda notification for user ${userId}:`, err.message || err);
    return { sent: false, error: err.message };
  }
}

module.exports = {
  PANDA_STATES,
  DEFAULT_STREAK_MILESTONES,
  PANDA_TEMPLATES,
  getLocalDateInTimezone,
  isStreakMilestone,
  getPandaMessage,
  determinePandaState,
  createPandaNotificationPayload,
  handleHabitCompletionPandaNotification,
};
