const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

/**
 * Inserts a new reminder for a habit, verifying habit ownership first.
 *
 * @param {string} userId
 * @param {string} habitId
 * @param {string} time "HH:MM:SS" or "HH:MM"
 * @returns {Promise<object|null>} The created reminder object, or null if habit not found/owned.
 */
async function createReminder(userId, habitId, time) {
  // Verify habit exists, belongs to user, and is not deleted
  const { rows: habitRows } = await pool.query(
    `SELECT id FROM habits WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
    [habitId, userId]
  );

  if (habitRows.length === 0) {
    return null;
  }

  const { rows } = await pool.query(
    `INSERT INTO reminders (user_id, habit_id, time)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [userId, habitId, time]
  );

  return rows[0];
}

/**
 * Returns all reminders for a given habit owned by the user.
 *
 * @param {string} userId
 * @param {string} habitId
 * @returns {Promise<Array<object>|null>} Array of reminders or null if habit not found/owned.
 */
async function getRemindersForHabit(userId, habitId) {
  // Verify habit ownership
  const { rows: habitRows } = await pool.query(
    `SELECT id FROM habits WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
    [habitId, userId]
  );

  if (habitRows.length === 0) {
    return null;
  }

  const { rows } = await pool.query(
    `SELECT * FROM reminders
     WHERE habit_id = $1 AND user_id = $2
     ORDER BY time ASC`,
    [habitId, userId]
  );

  return rows;
}

/**
 * Partially updates a reminder (time and/or enabled), scoped to user_id.
 *
 * @param {string} userId
 * @param {string} reminderId
 * @param {{ time?: string, enabled?: boolean }} fields
 * @returns {Promise<object|null>} Updated reminder row or null if not found/owned.
 */
async function updateReminder(userId, reminderId, fields) {
  const allowedFields = ['time', 'enabled'];
  const setClauses = [];
  const queryParams = [reminderId, userId];

  for (const [key, value] of Object.entries(fields)) {
    if (allowedFields.includes(key) && value !== undefined) {
      queryParams.push(value);
      setClauses.push(`${key} = $${queryParams.length}`);
    }
  }

  if (setClauses.length === 0) {
    // Return existing if no allowed fields passed
    const { rows } = await pool.query(
      `SELECT * FROM reminders WHERE id = $1 AND user_id = $2`,
      [reminderId, userId]
    );
    return rows[0] ?? null;
  }

  setClauses.push('updated_at = NOW()');

  const query = `
    UPDATE reminders
    SET ${setClauses.join(', ')}
    WHERE id = $1 AND user_id = $2
    RETURNING *`;

  const { rows } = await pool.query(query, queryParams);
  return rows[0] ?? null;
}

/**
 * Hard-deletes a reminder, scoped to user_id.
 *
 * @param {string} userId
 * @param {string} reminderId
 * @returns {Promise<boolean>} True if found and deleted, false otherwise.
 */
async function deleteReminder(userId, reminderId) {
  const { rowCount } = await pool.query(
    `DELETE FROM reminders
     WHERE id = $1 AND user_id = $2`,
    [reminderId, userId]
  );
  return rowCount > 0;
}

module.exports = {
  createReminder,
  getRemindersForHabit,
  updateReminder,
  deleteReminder,
};
