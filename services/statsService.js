const { Pool } = require('pg');
const { calculateStreak } = require('./streakService');
const { getHabitById, getHabitSchedule, getCompletionDates, getHabitsForUser } = require('./habitService');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

/**
 * Returns integer day of week where 0 = Monday ... 6 = Sunday for a "YYYY-MM-DD" date string.
 */
function getDayOfWeek(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const utcDay = d.getUTCDay();
  return (utcDay + 6) % 7;
}

/**
 * Helper to get next calendar date string "YYYY-MM-DD".
 */
function getNextDateStr(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Gets current date string "YYYY-MM-DD" in specified IANA timezone.
 */
function getTodayInTimezone(tz = 'UTC') {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
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
 * Scans full completion history and returns the maximum consecutive streak ever achieved.
 *
 * @param {"daily" | "scheduled"} frequencyType
 * @param {Array<number>} scheduleDays Array of integers 0-6 (0=Monday...6=Sunday)
 * @param {Array<string>} completionDates Array of date strings "YYYY-MM-DD"
 * @param {string} [timezone] IANA timezone string
 * @returns {number} Best streak count (>= 0)
 */
function calculateBestStreak(frequencyType, scheduleDays = [], completionDates = [], timezone = 'UTC') {
  if (!completionDates || completionDates.length === 0) {
    return 0;
  }

  const sorted = [...new Set(completionDates)].sort();
  const completedSet = new Set(sorted);
  const firstDate = sorted[0];
  const lastDate = sorted[sorted.length - 1];

  if (frequencyType === 'daily') {
    let maxStreak = 0;
    let currentStreak = 0;
    let curr = firstDate;

    while (curr <= lastDate) {
      if (completedSet.has(curr)) {
        currentStreak++;
        if (currentStreak > maxStreak) {
          maxStreak = currentStreak;
        }
      } else {
        currentStreak = 0;
      }
      curr = getNextDateStr(curr);
    }

    return maxStreak;
  }

  if (frequencyType === 'scheduled') {
    if (!Array.isArray(scheduleDays) || scheduleDays.length === 0) {
      return 0;
    }

    const scheduledSet = new Set(scheduleDays.map(Number));
    let maxStreak = 0;
    let currentStreak = 0;
    let curr = firstDate;

    while (curr <= lastDate) {
      const dow = getDayOfWeek(curr);
      if (scheduledSet.has(dow)) {
        if (completedSet.has(curr)) {
          currentStreak++;
          if (currentStreak > maxStreak) {
            maxStreak = currentStreak;
          }
        } else {
          currentStreak = 0;
        }
      }
      curr = getNextDateStr(curr);
    }

    return maxStreak;
  }

  return 0;
}

/**
 * Calculates completion rate percentage (0-100 rounded) within a date range [periodStart, periodEnd].
 * Range is capped at today so future days are not counted as misses.
 *
 * @param {"daily" | "scheduled"} frequencyType
 * @param {Array<number>} scheduleDays
 * @param {Array<string>} completionDates
 * @param {string} timezone
 * @param {string} periodStart "YYYY-MM-DD"
 * @param {string} periodEnd "YYYY-MM-DD"
 * @param {string} [todayOverride] Optional today override for testing
 * @returns {number} Percentage 0-100 (rounded)
 */
function calculateCompletionRate(
  frequencyType,
  scheduleDays = [],
  completionDates = [],
  timezone = 'UTC',
  periodStart,
  periodEnd,
  todayOverride = null
) {
  const today = todayOverride || getTodayInTimezone(timezone);
  const effectiveEnd = periodEnd < today ? periodEnd : today;

  if (periodStart > effectiveEnd) {
    return 0;
  }

  const completedSet = new Set(completionDates || []);
  const scheduledSet = new Set((scheduleDays || []).map(Number));

  let totalDays = 0;
  let completedCount = 0;
  let curr = periodStart;

  while (curr <= effectiveEnd) {
    if (frequencyType === 'daily') {
      totalDays++;
      if (completedSet.has(curr)) {
        completedCount++;
      }
    } else if (frequencyType === 'scheduled') {
      const dow = getDayOfWeek(curr);
      if (scheduledSet.has(dow)) {
        totalDays++;
        if (completedSet.has(curr)) {
          completedCount++;
        }
      }
    }
    curr = getNextDateStr(curr);
  }

  if (totalDays === 0) {
    return 0;
  }

  return Math.round((completedCount / totalDays) * 100);
}

/**
 * Calculates statistics for a single habit owned by the user.
 *
 * @param {string} userId
 * @param {string} habitId
 * @param {string} timezone
 * @param {"month" | "year"} period
 * @returns {Promise<object|null>}
 */
async function getHabitStats(userId, habitId, timezone = 'UTC', period = 'month') {
  const habit = await getHabitById(userId, habitId);
  if (!habit) {
    return null;
  }

  const today = getTodayInTimezone(timezone);
  const year = today.slice(0, 4);
  const month = today.slice(5, 7);

  let periodStart;
  let periodEnd;

  if (period === 'year') {
    periodStart = `${year}-01-01`;
    periodEnd = `${year}-12-31`;
  } else {
    // default to 'month'
    periodStart = `${year}-${month}-01`;
    const lastDayNum = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
    periodEnd = `${year}-${month}-${String(lastDayNum).padStart(2, '0')}`;
  }

  const schedule = await getHabitSchedule(habitId);
  const completionDates = await getCompletionDates(userId, habitId);

  const currentStreak = calculateStreak(habit.frequency_type, schedule, completionDates, timezone, today);
  const bestStreak = calculateBestStreak(habit.frequency_type, schedule, completionDates, timezone);
  const completionRate = calculateCompletionRate(
    habit.frequency_type,
    schedule,
    completionDates,
    timezone,
    periodStart,
    periodEnd,
    today
  );

  return {
    current_streak: currentStreak,
    best_streak: bestStreak,
    total_completions: completionDates.length,
    completion_rate: completionRate,
    period,
  };
}

/**
 * Aggregates statistics across all of a user's active (non-deleted, non-archived) habits.
 *
 * @param {string} userId
 * @param {string} timezone
 * @param {"month" | "year"} period
 * @returns {Promise<object>}
 */
async function getUserOverallStats(userId, timezone = 'UTC', period = 'month') {
  const habits = await getHabitsForUser(userId);

  if (habits.length === 0) {
    return {
      overall_completion_rate: 0,
      total_completions: 0,
      habits: [],
    };
  }

  const rawStatsList = await Promise.all(
    habits.map(async (habit) => {
      const stats = await getHabitStats(userId, habit.id, timezone, period);
      if (!stats) return null;
      return {
        id: habit.id,
        name: habit.name,
        current_streak: stats.current_streak,
        best_streak: stats.best_streak,
        completion_rate: stats.completion_rate,
        total_completions: stats.total_completions,
      };
    })
  );

  const habitStatsList = rawStatsList.filter(Boolean);

  if (habitStatsList.length === 0) {
    return {
      overall_completion_rate: 0,
      total_completions: 0,
      habits: [],
    };
  }

  const sumCompletions = habitStatsList.reduce((acc, h) => acc + h.total_completions, 0);
  const sumRates = habitStatsList.reduce((acc, h) => acc + h.completion_rate, 0);
  const overallRate = Math.round(sumRates / habitStatsList.length);

  const formattedHabits = habitStatsList.map(({ total_completions, ...rest }) => rest);

  return {
    overall_completion_rate: overallRate,
    total_completions: sumCompletions,
    habits: formattedHabits,
  };
}

module.exports = {
  calculateBestStreak,
  calculateCompletionRate,
  getHabitStats,
  getUserOverallStats,
};
