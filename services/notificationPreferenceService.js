const { pool } = require('./db');

/**
 * Formats a raw database row into an API-friendly preferences object.
 *
 * @param {object} row - Database row from notification_preferences table
 * @returns {object} Formatted preferences
 */
function formatPreferences(row) {
  if (!row) return null;
  return {
    pushEnabled: row.push_enabled,
    morningEnabled: row.morning_enabled,
    afternoonEnabled: row.afternoon_enabled,
    eveningEnabled: row.evening_enabled,
    morningTime: typeof row.morning_time === 'string' ? row.morning_time.slice(0, 5) : '08:00',
    afternoonTime: typeof row.afternoon_time === 'string' ? row.afternoon_time.slice(0, 5) : '13:00',
    eveningTime: typeof row.evening_time === 'string' ? row.evening_time.slice(0, 5) : '20:00',
    timezone: row.timezone || 'UTC',
    updatedAt: row.updated_at,
  };
}

/**
 * Retrieves the notification preferences for a user.
 * If no row exists yet, inserts and returns a default preferences record.
 *
 * @param {string} userId - User UUID
 * @returns {Promise<object>} Formatted preferences object
 */
async function getNotificationPreferences(userId) {
  const insertOrFetchQuery = `
    INSERT INTO notification_preferences (user_id)
    VALUES ($1)
    ON CONFLICT (user_id)
    DO UPDATE SET updated_at = notification_preferences.updated_at
    RETURNING *;
  `;

  const { rows } = await pool.query(insertOrFetchQuery, [userId]);
  return formatPreferences(rows[0]);
}

/**
 * Updates or creates notification preferences for a user.
 * Supports partial updates while maintaining defaults for new records.
 *
 * @param {string} userId - User UUID
 * @param {object} updates - Partial or full preference fields
 * @param {boolean} [updates.push_enabled]
 * @param {boolean} [updates.morning_enabled]
 * @param {boolean} [updates.afternoon_enabled]
 * @param {boolean} [updates.evening_enabled]
 * @param {string} [updates.morning_time]
 * @param {string} [updates.afternoon_time]
 * @param {string} [updates.evening_time]
 * @param {string} [updates.timezone]
 * @returns {Promise<object>} Updated and formatted preferences object
 */
async function updateNotificationPreferences(userId, updates = {}) {
  const {
    push_enabled = null,
    morning_enabled = null,
    afternoon_enabled = null,
    evening_enabled = null,
    morning_time = null,
    afternoon_time = null,
    evening_time = null,
    timezone = null,
  } = updates;

  const query = `
    INSERT INTO notification_preferences (
      user_id,
      push_enabled,
      morning_enabled,
      afternoon_enabled,
      evening_enabled,
      morning_time,
      afternoon_time,
      evening_time,
      timezone,
      updated_at
    )
    VALUES (
      $1,
      COALESCE($2, TRUE),
      COALESCE($3, TRUE),
      COALESCE($4, TRUE),
      COALESCE($5, TRUE),
      COALESCE($6, '08:00:00'::time),
      COALESCE($7, '13:00:00'::time),
      COALESCE($8, '20:00:00'::time),
      COALESCE($9, 'UTC'),
      NOW()
    )
    ON CONFLICT (user_id)
    DO UPDATE SET
      push_enabled = COALESCE($2, notification_preferences.push_enabled),
      morning_enabled = COALESCE($3, notification_preferences.morning_enabled),
      afternoon_enabled = COALESCE($4, notification_preferences.afternoon_enabled),
      evening_enabled = COALESCE($5, notification_preferences.evening_enabled),
      morning_time = COALESCE($6, notification_preferences.morning_time),
      afternoon_time = COALESCE($7, notification_preferences.afternoon_time),
      evening_time = COALESCE($8, notification_preferences.evening_time),
      timezone = COALESCE($9, notification_preferences.timezone),
      updated_at = NOW()
    RETURNING *;
  `;

  const { rows } = await pool.query(query, [
    userId,
    push_enabled,
    morning_enabled,
    afternoon_enabled,
    evening_enabled,
    morning_time,
    afternoon_time,
    evening_time,
    timezone,
  ]);

  return formatPreferences(rows[0]);
}

module.exports = {
  getNotificationPreferences,
  updateNotificationPreferences,
  formatPreferences,
};
