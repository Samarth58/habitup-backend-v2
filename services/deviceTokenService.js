const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

/**
 * Inserts or updates an FCM device token for a user.
 * If the token already exists in the database (even under another user),
 * it updates the user_id, platform, timezone, and updated_at timestamp.
 *
 * @param {string} userId - User UUID
 * @param {object} params
 * @param {string} params.token - FCM device token string
 * @param {string} params.platform - 'android' or 'ios'
 * @param {string} [params.timezone='UTC'] - IANA timezone identifier
 * @returns {Promise<object>} The inserted or updated device_tokens row
 */
async function upsertDeviceToken(userId, { token, platform, timezone = 'UTC' }) {
  const query = `
    INSERT INTO device_tokens (user_id, token, platform, timezone, created_at, updated_at)
    VALUES ($1, $2, $3, $4, NOW(), NOW())
    ON CONFLICT (token)
    DO UPDATE SET
      user_id = EXCLUDED.user_id,
      platform = EXCLUDED.platform,
      timezone = EXCLUDED.timezone,
      updated_at = NOW()
    RETURNING *;
  `;

  const { rows } = await pool.query(query, [userId, token, platform, timezone]);
  return rows[0];
}

/**
 * Retrieves all registered device tokens for a given user.
 *
 * @param {string} userId - User UUID
 * @returns {Promise<Array<object>>} List of device token records
 */
async function getDeviceTokensByUserId(userId) {
  const query = `
    SELECT id, user_id, token, platform, timezone, created_at, updated_at
    FROM device_tokens
    WHERE user_id = $1
    ORDER BY updated_at DESC;
  `;

  const { rows } = await pool.query(query, [userId]);
  return rows;
}

/**
 * Deletes a specific device token (e.g. on logout or invalid token).
 *
 * @param {string} token - FCM device token string
 * @returns {Promise<boolean>} True if deleted, false if not found
 */
async function deleteDeviceToken(token) {
  const query = `
    DELETE FROM device_tokens
    WHERE token = $1;
  `;

  const { rowCount } = await pool.query(query, [token]);
  return rowCount > 0;
}

module.exports = {
  upsertDeviceToken,
  getDeviceTokensByUserId,
  deleteDeviceToken,
};
