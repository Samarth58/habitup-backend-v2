const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

/**
 * Create a new habit for a user.
 * @param {string} userId
 * @param {{ name: string, description?: string, icon?: string, color?: string, frequency_type: string }} data
 * @returns {Promise<object>} The created habit row.
 */
async function createHabit(userId, { name, description = null, icon = null, color = null, frequency_type }) {
  const { rows } = await pool.query(
    `INSERT INTO habits (user_id, name, description, icon, color, frequency_type)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [userId, name, description, icon, color, frequency_type]
  );
  return rows[0];
}

/**
 * Fetch all active habits for a user (paused_at, archived_at, deleted_at all null).
 * @param {string} userId
 * @returns {Promise<Array<object>>}
 */
async function getHabitsForUser(userId) {
  const { rows } = await pool.query(
    `SELECT * FROM habits
     WHERE user_id = $1
       AND paused_at IS NULL
       AND archived_at IS NULL
       AND deleted_at IS NULL
     ORDER BY created_at DESC`,
    [userId]
  );
  return rows;
}

/**
 * Fetch a single habit by ID if it belongs to the specified user and is not deleted.
 * @param {string} userId
 * @param {string} habitId
 * @returns {Promise<object|null>}
 */
async function getHabitById(userId, habitId) {
  const { rows } = await pool.query(
    `SELECT * FROM habits
     WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
    [habitId, userId]
  );
  return rows[0] ?? null;
}

/**
 * Partially update a habit belonging to a user.
 * @param {string} userId
 * @param {string} habitId
 * @param {object} fields Key-value pairs to update.
 * @returns {Promise<object|null>} The updated habit row or null if not found.
 */
async function updateHabit(userId, habitId, fields) {
  const allowedFields = ['name', 'description', 'icon', 'color', 'frequency_type', 'paused_at', 'archived_at'];
  const setClauses = [];
  const queryParams = [habitId, userId];

  for (const [key, value] of Object.entries(fields)) {
    if (allowedFields.includes(key)) {
      queryParams.push(value);
      setClauses.push(`${key} = $${queryParams.length}`);
    }
  }

  if (setClauses.length === 0) {
    return getHabitById(userId, habitId);
  }

  setClauses.push('updated_at = NOW()');

  const query = `
    UPDATE habits
    SET ${setClauses.join(', ')}
    WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
    RETURNING *`;

  const { rows } = await pool.query(query, queryParams);
  return rows[0] ?? null;
}

/**
 * Soft delete a habit (sets deleted_at to NOW()) for a specified user.
 * @param {string} userId
 * @param {string} habitId
 * @returns {Promise<boolean>} True if habit was found and deleted, false otherwise.
 */
async function softDeleteHabit(userId, habitId) {
  const { rowCount } = await pool.query(
    `UPDATE habits
     SET deleted_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
    [habitId, userId]
  );
  return rowCount > 0;
}

/**
 * Replaces schedule entries for a given habit with the provided array of days (0-6).
 * Deletes existing schedule rows for that habit first, then inserts the new set.
 * @param {string} habitId
 * @param {Array<number>} daysOfWeek Array of integer days (0 = Sunday, 6 = Saturday)
 * @returns {Promise<Array<number>>} The saved schedule array.
 */
async function setHabitSchedule(habitId, daysOfWeek) {
  await pool.query('DELETE FROM habit_schedules WHERE habit_id = $1', [habitId]);

  if (!Array.isArray(daysOfWeek) || daysOfWeek.length === 0) {
    return [];
  }

  const uniqueDays = [...new Set(daysOfWeek.map((d) => Number(d)))].filter(
    (d) => Number.isInteger(d) && d >= 0 && d <= 6
  );

  if (uniqueDays.length === 0) {
    return [];
  }

  const valueStrings = uniqueDays.map((_, idx) => `($1, $${idx + 2})`).join(', ');
  await pool.query(
    `INSERT INTO habit_schedules (habit_id, day_of_week) VALUES ${valueStrings}`,
    [habitId, ...uniqueDays]
  );

  return uniqueDays.sort((a, b) => a - b);
}

/**
 * Returns an array of scheduled day_of_week integers for a habit.
 * @param {string} habitId
 * @returns {Promise<Array<number>>}
 */
async function getHabitSchedule(habitId) {
  const { rows } = await pool.query(
    `SELECT day_of_week FROM habit_schedules
     WHERE habit_id = $1
     ORDER BY day_of_week ASC`,
    [habitId]
  );
  return rows.map((r) => r.day_of_week);
}

module.exports = {
  createHabit,
  getHabitsForUser,
  getHabitById,
  updateHabit,
  softDeleteHabit,
  setHabitSchedule,
  getHabitSchedule,
};
