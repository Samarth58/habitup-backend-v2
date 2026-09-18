const { pool } = require('./db');
const { getLocalizedNotification, translate } = require('./translationService');
const { getUserNotificationLanguage } = require('./userLanguageService');

/**
 * Generic fallback templates used when personalization cannot be computed.
 * Mirrors the templates previously hardcoded in notificationSchedulerService.
 */
const FALLBACK_TEMPLATES = {
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
 * Derives the ISO day of week (0=Sunday … 6=Saturday) from a local date string.
 * Uses UTC parsing of "YYYY-MM-DDT00:00:00Z" so that no server timezone offsets
 * interfere — the date string itself already represents the user's local day.
 *
 * @param {string} localDate "YYYY-MM-DD"
 * @returns {number} 0 (Sun) … 6 (Sat)
 */
function getDayOfWeekFromDateStr(localDate) {
  return new Date(`${localDate}T00:00:00Z`).getUTCDay();
}

/**
 * Queries how many habits are planned for a user on a specific local date, and
 * how many of those have been completed.
 *
 * A habit counts as "planned" when:
 *   - It is active (paused_at IS NULL, archived_at IS NULL, deleted_at IS NULL)
 *   - AND its frequency_type is 'daily'
 *   - OR its frequency_type is 'scheduled' AND it has a habit_schedule row whose
 *     day_of_week matches the weekday of localDate.
 *
 * @param {string} userId
 * @param {string} localDate "YYYY-MM-DD"
 * @returns {Promise<{ planned: number, completed: number, remaining: number }>}
 */
async function getHabitProgressForDate(userId, localDate) {
  const dayOfWeek = getDayOfWeekFromDateStr(localDate);

  // Query 1: count active habits planned for this day
  const plannedResult = await pool.query(
    `SELECT COUNT(h.id)::int AS planned
     FROM habits h
     WHERE h.user_id = $1
       AND h.paused_at IS NULL
       AND h.archived_at IS NULL
       AND h.deleted_at IS NULL
       AND (
         h.frequency_type = 'daily'
         OR (
           h.frequency_type = 'scheduled'
           AND EXISTS (
             SELECT 1 FROM habit_schedules hs
             WHERE hs.habit_id = h.id AND hs.day_of_week = $2
           )
         )
       )`,
    [userId, dayOfWeek]
  );

  const planned = plannedResult.rows[0]?.planned ?? 0;

  if (planned === 0) {
    return { planned: 0, completed: 0, remaining: 0 };
  }

  // Query 2: count completions for today, restricted to active planned habits
  const completedResult = await pool.query(
    `SELECT COUNT(hc.id)::int AS completed
     FROM habit_completions hc
     JOIN habits h ON h.id = hc.habit_id
     WHERE hc.user_id = $1
       AND hc.completion_date = $2
       AND h.paused_at IS NULL
       AND h.archived_at IS NULL
       AND h.deleted_at IS NULL
       AND (
         h.frequency_type = 'daily'
         OR (
           h.frequency_type = 'scheduled'
           AND EXISTS (
             SELECT 1 FROM habit_schedules hs
             WHERE hs.habit_id = h.id AND hs.day_of_week = $3
           )
         )
       )`,
    [userId, localDate, dayOfWeek]
  );

  const completed = completedResult.rows[0]?.completed ?? 0;
  const remaining = Math.max(0, planned - completed);

  return { planned, completed, remaining };
}

/**
 * Builds the notification title and body for a morning notification.
 *
 * @param {number} planned
 * @param {string} [lang='en']
 * @returns {{ title: string, body: string }}
 */
function buildMorningContent(planned, lang = 'en') {
  if (planned === 0) {
    return getLocalizedNotification('personalized_morning_zero', lang);
  }

  if (planned === 1) {
    return getLocalizedNotification('personalized_morning_one', lang, { count: 1 });
  }

  return getLocalizedNotification('personalized_morning_multiple', lang, { count: planned });
}

/**
 * Builds the notification title and body for an afternoon notification.
 *
 * @param {number} planned
 * @param {number} completed
 * @param {string} [lang='en']
 * @returns {{ title: string, body: string }}
 */
function buildAfternoonContent(planned, completed, lang = 'en') {
  if (planned === 0) {
    return getLocalizedNotification('personalized_afternoon_zero', lang);
  }

  if (completed >= planned) {
    if (planned === 1) {
      return getLocalizedNotification('personalized_afternoon_all_one', lang, { count: 1 });
    }
    return getLocalizedNotification('personalized_afternoon_all_multiple', lang, { count: planned });
  }

  if (completed === 0) {
    if (planned === 1) {
      return getLocalizedNotification('personalized_afternoon_none_one', lang, { count: 1 });
    }
    return getLocalizedNotification('personalized_afternoon_none_multiple', lang, { count: planned });
  }

  return getLocalizedNotification('personalized_afternoon_partial', lang, {
    completed,
    total: planned,
  });
}

/**
 * Builds the notification title and body for an evening notification.
 *
 * @param {number} planned
 * @param {number} completed
 * @param {number} remaining
 * @param {string} [lang='en']
 * @returns {{ title: string, body: string }}
 */
function buildEveningContent(planned, completed, remaining, lang = 'en') {
  if (planned === 0) {
    return getLocalizedNotification('personalized_evening_zero', lang);
  }

  if (remaining === 0) {
    if (planned === 1) {
      return getLocalizedNotification('personalized_evening_all_one', lang, { count: 1 });
    }
    return getLocalizedNotification('personalized_evening_all_multiple', lang, { count: planned });
  }

  if (remaining === 1) {
    return getLocalizedNotification('personalized_evening_one_left', lang, { count: 1 });
  }

  return getLocalizedNotification('personalized_evening_multiple_left', lang, { count: remaining });
}

/**
 * Computes personalized notification content for a user based on their actual
 * habit progress for the given local date and their preferred language.
 *
 * Returns a notification object `{ title, body, data }` ready for FCM dispatch.
 * Does NOT send FCM; that remains the responsibility of notificationSchedulerService.
 *
 * On any error, logs safely and returns the generic fallback template in the user's
 * preferred language (or English).
 *
 * @param {string} userId
 * @param {'morning'|'afternoon'|'evening'} notificationType
 * @param {string} localDate "YYYY-MM-DD" — the user's local calendar date for this notification
 * @param {string} [timezone='UTC'] — IANA timezone
 * @param {string} [preferredLanguage] — Optional pre-fetched language code
 * @returns {Promise<{ title: string, body: string, data: Record<string,string> }>}
 */
async function getPersonalizedContent(userId, notificationType, localDate, timezone = 'UTC', preferredLanguage = null) {
  let userLang = preferredLanguage;
  if (!userLang && userId) {
    userLang = await getUserNotificationLanguage(userId);
  }
  userLang = userLang || 'en';

  try {
    const { planned, completed, remaining } = await getHabitProgressForDate(userId, localDate);

    let title;
    let body;

    if (notificationType === 'morning') {
      ({ title, body } = buildMorningContent(planned, userLang));
    } else if (notificationType === 'afternoon') {
      ({ title, body } = buildAfternoonContent(planned, completed, userLang));
    } else if (notificationType === 'evening') {
      ({ title, body } = buildEveningContent(planned, completed, remaining, userLang));
    } else {
      throw new Error(`Unknown notification type: ${notificationType}`);
    }

    const data = {
      type: 'habit_progress',
      notificationType,
      localDate,
      plannedCount: String(planned),
      completedCount: String(completed),
      remainingCount: String(remaining),
    };

    return { title, body, data };
  } catch (err) {
    console.error(
      `[personalizedNotification] Failed to compute personalized content for user ${userId} (${notificationType}):`,
      err.message
    );

    const title = translate(`${notificationType}_reminder_title`, userLang) || FALLBACK_TEMPLATES[notificationType]?.title || 'HabitUp Reminder';
    const body = translate(`${notificationType}_reminder_body`, userLang) || FALLBACK_TEMPLATES[notificationType]?.body || 'Check in on your habits today.';

    return { title, body, data: undefined };
  }
}

module.exports = {
  getPersonalizedContent,
  getHabitProgressForDate,
  getDayOfWeekFromDateStr,
  buildMorningContent,
  buildAfternoonContent,
  buildEveningContent,
  FALLBACK_TEMPLATES,
};
