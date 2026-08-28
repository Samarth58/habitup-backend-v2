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

/**
 * Determines "today" using the user's timezone and inserts a habit completion row.
 * Handles UNIQUE(habit_id, completion_date) constraint gracefully (undo-toggle safe).
 *
 * @param {string} userId
 * @param {string} habitId
 * @param {string} timezone IANA timezone string
 * @returns {Promise<object>} The inserted or existing completion record.
 */
async function addCompletion(userId, habitId, timezone) {
  let todayStr;
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
    todayStr = `${year}-${month}-${day}`;
  } catch (err) {
    todayStr = new Date().toISOString().slice(0, 10);
  }

  const query = `
    INSERT INTO habit_completions (habit_id, user_id, completion_date)
    VALUES ($1, $2, $3)
    ON CONFLICT (habit_id, completion_date)
    DO UPDATE SET completion_date = EXCLUDED.completion_date
    RETURNING id, habit_id, user_id, to_char(completion_date, 'YYYY-MM-DD') AS completion_date, completed_at, created_at
  `;

  const { rows } = await pool.query(query, [habitId, userId, todayStr]);
  return rows[0];
}

/**
 * Deletes the completion row for habit_id + completion_date, scoped to user_id.
 *
 * @param {string} userId
 * @param {string} habitId
 * @param {string} dateStr "YYYY-MM-DD"
 * @returns {Promise<boolean>} True if removed, false if not found.
 */
async function removeCompletion(userId, habitId, dateStr) {
  const query = `
    DELETE FROM habit_completions
    WHERE habit_id = $1 AND user_id = $2 AND completion_date = $3
    RETURNING id
  `;
  const { rowCount } = await pool.query(query, [habitId, userId, dateStr]);
  return rowCount > 0;
}

/**
 * Returns an array of completion_date strings ("YYYY-MM-DD") for a habit belonging to a user.
 *
 * @param {string} userId
 * @param {string} habitId
 * @returns {Promise<Array<string>>}
 */
async function getCompletionDates(userId, habitId) {
  const query = `
    SELECT to_char(completion_date, 'YYYY-MM-DD') AS completion_date
    FROM habit_completions
    WHERE habit_id = $1 AND user_id = $2
    ORDER BY completion_date ASC
  `;
  const { rows } = await pool.query(query, [habitId, userId]);
  return rows.map((r) => r.completion_date);
}

/**
 * Helper to fetch user's timezone from DB if not present in request.
 *
 * @param {string} userId
 * @param {string} [reqTimezone]
 * @returns {Promise<string>}
 */
async function getUserTimezone(userId, reqTimezone) {
  if (reqTimezone) return reqTimezone;
  const { rows } = await pool.query('SELECT timezone FROM users WHERE id = $1', [userId]);
  return rows[0]?.timezone || 'UTC';
}

module.exports = {
  createHabit,
  getHabitsForUser,
  getHabitById,
  updateHabit,
  softDeleteHabit,
  setHabitSchedule,
  getHabitSchedule,
  addCompletion,
  removeCompletion,
  getCompletionDates,
  getUserTimezone,
};

