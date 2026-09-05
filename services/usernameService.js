const { Pool } = require('pg');
const { calculateStreak } = require('./streakService');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

/**
 * Validates username length and format.
 * - Length: 3-30 characters
 * - Format: Alphanumeric (a-z, A-Z, 0-9) and underscore (_) only.
 *
 * @param {string} username
 * @returns {{ valid: boolean }}
 * @throws {Error} Descriptive error on validation failure.
 */
function validateUsername(username) {
  if (typeof username !== 'string' || username.length < 3 || username.length > 30) {
    const error = new Error('Username must be 3-30 characters');
    error.status = 400;
    throw error;
  }

  const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
  if (!usernameRegex.test(username)) {
    const error = new Error('Username can only contain letters, numbers, and underscore');
    error.status = 400;
    throw error;
  }

  return { valid: true };
}

/**
 * Checks if a username is available (case-insensitive).
 *
 * @param {string} username
 * @returns {Promise<boolean>} True if available, false if taken.
 */
async function checkUsernameAvailable(username) {
  if (!username || typeof username !== 'string') {
    return false;
  }

  const { rows } = await pool.query(
    `SELECT id FROM users WHERE LOWER(username) = LOWER($1) AND deleted_at IS NULL`,
    [username.trim()]
  );

  return rows.length === 0;
}

/**
 * Retrieves a user by case-insensitive username.
 *
 * @param {string} username
 * @returns {Promise<object|null>}
 */
async function getUserByUsername(username) {
  if (!username || typeof username !== 'string') {
    return null;
  }

  const { rows } = await pool.query(
    `SELECT id, email, username, created_at, timezone
     FROM users
     WHERE LOWER(username) = LOWER($1) AND deleted_at IS NULL`,
    [username.trim()]
  );

  return rows[0] ?? null;
}

/**
 * Retrieves public profile statistics for a user by username.
 * Does NOT expose email or sensitive information.
 *
 * @param {string} username
 * @returns {Promise<object|null>}
 */
async function getUserPublicProfile(username) {
  const user = await getUserByUsername(username);
  if (!user) {
    return null;
  }

  // Count total active habits
  const { rows: habitCountRows } = await pool.query(
    `SELECT COUNT(*)::int AS total_habits
     FROM habits
     WHERE user_id = $1 AND deleted_at IS NULL`,
    [user.id]
  );
  const totalHabits = habitCountRows[0]?.total_habits ?? 0;

  // Calculate current streak across user habits
  const { rows: habits } = await pool.query(
    `SELECT id, frequency_type
     FROM habits
     WHERE user_id = $1 AND deleted_at IS NULL AND paused_at IS NULL`,
    [user.id]
  );

  let currentStreak = 0;
  for (const habit of habits) {
    const { rows: schedRows } = await pool.query(
      `SELECT day_of_week FROM habit_schedules WHERE habit_id = $1`,
      [habit.id]
    );
    const schedule = schedRows.map((r) => r.day_of_week);

    const { rows: compRows } = await pool.query(
      `SELECT to_char(completion_date, 'YYYY-MM-DD') AS cd
       FROM habit_completions
       WHERE habit_id = $1 AND user_id = $2`,
      [habit.id, user.id]
    );
    const completionDates = compRows.map((r) => r.cd);

    const streak = calculateStreak(habit.frequency_type, schedule, completionDates, user.timezone || 'UTC');
    if (streak > currentStreak) {
      currentStreak = streak;
    }
  }

  return {
    id: user.id,
    username: user.username,
    total_habits: totalHabits,
    current_streak: currentStreak,
    created_at: user.created_at,
  };
}

module.exports = {
  validateUsername,
  checkUsernameAvailable,
  getUserByUsername,
  getUserPublicProfile,
};
