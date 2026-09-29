const { pool } = require('./db');
const { getUserNotificationLanguage } = require('./userLanguageService');
const translationService = require('./translationService');
const { DEFAULT_LANGUAGE, normalizeLanguage } = require('../constants/languages');

/**
 * Create a new habit for a user.
 * Stores the raw user input in original_name and the localized display text in name.
 * Automatically localizes habit name to user's preferred language if non-English.
 * @param {string} userId
 * @param {{ name: string, description?: string, icon?: string, color?: string, frequency_type: string }} data
 * @returns {Promise<object>} The created habit row.
 */
async function createHabit(userId, { name, description = null, icon = null, color = null, frequency_type }) {
  let habitName = name;

  if (userId && name && typeof name === 'string') {
    try {
      const userLang = await getUserNotificationLanguage(userId);
      if (userLang && userLang !== DEFAULT_LANGUAGE) {
        habitName = await translationService.localizeHabitText(name, userLang);
      }
    } catch (err) {
      console.warn(`[createHabit] Error resolving user language or localizing habit name:`, err.message);
      habitName = name;
    }
  }

  const { rows } = await pool.query(
    `INSERT INTO habits (user_id, name, description, icon, color, frequency_type, original_name)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [userId, habitName, description, icon, color, frequency_type, name]
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
 * When the name changes, original_name is replaced with the raw input and name is
 * re-localized from that input using the user's current preferred language.
 * @param {string} userId
 * @param {string} habitId
 * @param {object} fields Key-value pairs to update.
 * @returns {Promise<object|null>} The updated habit row or null if not found.
 */
async function updateHabit(userId, habitId, fields) {
  const allowedFields = ['description', 'icon', 'color', 'frequency_type', 'paused_at', 'archived_at'];
  const setClauses = [];
  const queryParams = [habitId, userId];

  if (Object.prototype.hasOwnProperty.call(fields, 'name')) {
    const current = await getHabitById(userId, habitId);
    if (!current) {
      return null;
    }

    const suppliedName = fields.name;
    const currentOriginalName = current.original_name ?? current.name;
    const nameChanged =
      String(suppliedName) !== String(current.name) &&
      String(suppliedName) !== String(currentOriginalName);

    if (nameChanged) {
      let localizedName = suppliedName;
      try {
        const userLang = await getUserNotificationLanguage(userId);
        if (userLang && userLang !== DEFAULT_LANGUAGE) {
          localizedName = await translationService.localizeHabitText(suppliedName, userLang);
        }
      } catch (err) {
        console.warn(`[updateHabit] Error localizing habit name:`, err.message);
        localizedName = suppliedName;
      }
      if (typeof localizedName !== 'string' || !localizedName.trim()) {
        localizedName = suppliedName;
      }

      queryParams.push(localizedName, suppliedName);
      setClauses.push(`name = $${queryParams.length - 1}, original_name = $${queryParams.length}`);
    }
  }

  for (const [key, value] of Object.entries(fields)) {
    if (key === 'name') continue;
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
 * Canonical completion date normalization function.
 * Converts valid completion dates (YYYY-MM-DD, ISO 8601 strings, Date objects)
 * into canonical 'YYYY-MM-DD' format.
 * Returns null if the input is invalid or cannot be parsed as a valid calendar date.
 *
 * @param {string|Date} rawDate
 * @returns {string|null} 'YYYY-MM-DD' or null
 */
function normalizeCompletionDate(rawDate) {
  if (!rawDate) return null;

  if (rawDate instanceof Date) {
    if (isNaN(rawDate.getTime())) return null;
    return rawDate.toISOString().slice(0, 10);
  }

  if (typeof rawDate !== 'string') return null;

  const trimmed = rawDate.trim();
  if (!trimmed) return null;

  // 1. Direct YYYY-MM-DD or leading YYYY-MM-DD (e.g. ISO 8601 "2026-09-29T00:00:00.000Z", "2026-09-29 00:00:00")
  const ymdMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10);
    const day = parseInt(ymdMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const d = new Date(Date.UTC(year, month - 1, day));
      if (d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day) {
        return `${ymdMatch[1]}-${ymdMatch[2]}-${ymdMatch[3]}`;
      }
    }
  }

  // 2. Fallback for other parseable date strings
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

/**
 * Inserts a completion row for habit_id + today in user's timezone.
 * Handles UNIQUE(habit_id, completion_date) constraint gracefully (undo-toggle safe).
 *
 * @param {string} userId
 * @param {string} habitId
 * @param {string} timezone IANA timezone string
 * @param {string} [customDateStr] Optional custom completion date (YYYY-MM-DD or ISO)
 * @returns {Promise<object>} The inserted or existing completion record.
 */
async function addCompletion(userId, habitId, timezone, customDateStr = null) {
  let todayStr = customDateStr ? normalizeCompletionDate(customDateStr) : null;
  if (!todayStr) {
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
 * @param {string} dateStr "YYYY-MM-DD" or ISO string
 * @param {object} [client=pool]
 * @returns {Promise<boolean>} True if removed, false if not found.
 */
async function removeCompletion(userId, habitId, dateStr, client = pool) {
  const normalizedDate = normalizeCompletionDate(dateStr) || dateStr;
  const query = `
    DELETE FROM habit_completions
    WHERE habit_id = $1 AND user_id = $2 AND completion_date = $3
    RETURNING id
  `;
  const { rowCount } = await client.query(query, [habitId, userId, normalizedDate]);
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
 * Returns all completion records for a habit belonging to a user, ordered newest first.
 *
 * @param {string} userId
 * @param {string} habitId
 * @returns {Promise<Array<object>>}
 */
async function getCompletionsForHabit(userId, habitId) {
  const query = `
    SELECT id, habit_id, user_id, to_char(completion_date, 'YYYY-MM-DD') AS completion_date, completed_at, created_at
    FROM habit_completions
    WHERE habit_id = $1 AND user_id = $2
    ORDER BY completion_date DESC
  `;
  const { rows } = await pool.query(query, [habitId, userId]);
  return rows;
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

/**
 * Sets paused_at = NOW() for a habit owned by the specified user (and not deleted).
 * @param {string} userId
 * @param {string} habitId
 * @returns {Promise<object|null>} The updated habit row or null if not found.
 */
async function pauseHabit(userId, habitId) {
  const { rows } = await pool.query(
    `UPDATE habits
     SET paused_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
     RETURNING *`,
    [habitId, userId]
  );
  return rows[0] ?? null;
}

/**
 * Sets paused_at = NULL for a habit owned by the specified user (and not deleted).
 * @param {string} userId
 * @param {string} habitId
 * @returns {Promise<object|null>} The updated habit row or null if not found.
 */
async function unpauseHabit(userId, habitId) {
  const { rows } = await pool.query(
    `UPDATE habits
     SET paused_at = NULL, updated_at = NOW()
     WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
     RETURNING *`,
    [habitId, userId]
  );
  return rows[0] ?? null;
}

/**
 * Sets archived_at = NOW() for a habit owned by the specified user (and not deleted).
 * @param {string} userId
 * @param {string} habitId
 * @returns {Promise<object|null>} The updated habit row or null if not found.
 */
async function archiveHabit(userId, habitId) {
  const { rows } = await pool.query(
    `UPDATE habits
     SET archived_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
     RETURNING *`,
    [habitId, userId]
  );
  return rows[0] ?? null;
}

/**
 * Sets archived_at = NULL for a habit owned by the specified user (and not deleted).
 * @param {string} userId
 * @param {string} habitId
 * @returns {Promise<object|null>} The updated habit row or null if not found.
 */
async function unarchiveHabit(userId, habitId) {
  const { rows } = await pool.query(
    `UPDATE habits
     SET archived_at = NULL, updated_at = NOW()
     WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
     RETURNING *`,
    [habitId, userId]
  );
  return rows[0] ?? null;
}

/**
 * Fetch all archived habits for a user (archived_at IS NOT NULL AND deleted_at IS NULL).
 * @param {string} userId
 * @returns {Promise<Array<object>>}
 */
async function getArchivedHabitsForUser(userId) {
  const { rows } = await pool.query(
    `SELECT * FROM habits
     WHERE user_id = $1
       AND archived_at IS NOT NULL
       AND deleted_at IS NULL
     ORDER BY created_at DESC`,
    [userId]
  );
  return rows;
}

/**
 * Re-localizes every active habit (not deleted, not archived) for a user to the
 * target language, always translating from original_name — never from the
 * currently localized name. Failures are isolated per habit so a translation
 * provider issue never corrupts stored names or fails the caller.
 *
 * Each UPDATE is guarded so an older translation pass cannot overwrite a habit
 * renamed concurrently or a newer preferred_language selection.
 *
 * @param {string} userId
 * @param {string} targetLanguage - Normalized 2-letter language code.
 * @returns {Promise<{ updated: number }>} Count of habits whose name changed.
 */
async function retranslateUserHabitNames(userId, targetLanguage) {
  const language = normalizeLanguage(targetLanguage);

  const { rows: habits } = await pool.query(
    `SELECT id, name, COALESCE(original_name, name) AS original_name
     FROM habits
     WHERE user_id = $1
       AND deleted_at IS NULL
       AND archived_at IS NULL`,
    [userId]
  );

  if (habits.length === 0) {
    return { updated: 0 };
  }

  const results = await Promise.allSettled(
    habits.map(async (habit) => {
      const source = habit.original_name;
      let localizedName;

      const isAsciiEnglish = /^[A-Za-z0-9\s.,!?'"()\-:;/_+]+$/.test(String(source).trim());
      if (language === DEFAULT_LANGUAGE && isAsciiEnglish) {
        localizedName = source;
      } else {
        try {
          localizedName = await translationService.localizeHabitText(source, language);
        } catch (err) {
          console.warn(
            `[retranslateUserHabitNames] Translation to "${language}" failed for habit ${habit.id}; preserving current name:`,
            err.message
          );
          return { id: habit.id, updated: false };
        }

        if (typeof localizedName !== 'string' || !localizedName.trim()) {
          console.warn(
            `[retranslateUserHabitNames] Empty translation to "${language}" for habit ${habit.id}; preserving current name`
          );
          return { id: habit.id, updated: false };
        }
      }

      if (localizedName === habit.name) {
        return { id: habit.id, updated: false };
      }

      const { rowCount } = await pool.query(
        `UPDATE habits
         SET name = $3, updated_at = NOW()
         WHERE id = $1
           AND user_id = $2
           AND deleted_at IS NULL
           AND archived_at IS NULL
           AND COALESCE(original_name, name) = $4
           AND EXISTS (
             SELECT 1 FROM users u
             WHERE u.id = $2 AND u.preferred_language = $5
           )`,
        [habit.id, userId, localizedName, source, language]
      );

      return { id: habit.id, updated: rowCount > 0 };
    })
  );

  for (const result of results) {
    if (result.status === 'rejected') {
      console.warn(
        `[retranslateUserHabitNames] Unexpected error retranslating a habit for user ${userId}:`,
        result.reason?.message ?? result.reason
      );
    }
  }

  const updated = results.filter(
    (result) => result.status === 'fulfilled' && result.value.updated
  ).length;

  return { updated };
}

module.exports = {
  createHabit,
  getHabitsForUser,
  getArchivedHabitsForUser,
  getHabitById,
  updateHabit,
  retranslateUserHabitNames,
  softDeleteHabit,
  pauseHabit,
  unpauseHabit,
  archiveHabit,
  unarchiveHabit,
  setHabitSchedule,
  getHabitSchedule,
  normalizeCompletionDate,
  addCompletion,
  removeCompletion,
  getCompletionDates,
  getCompletionsForHabit,
  getUserTimezone,
};


