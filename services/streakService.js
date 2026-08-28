/**
 * Helper to get the previous calendar date in "YYYY-MM-DD" format.
 * @param {string} dateStr "YYYY-MM-DD"
 * @returns {string} "YYYY-MM-DD"
 */
function getPreviousDateStr(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Returns integer day of week where 0 = Monday ... 6 = Sunday for a "YYYY-MM-DD" date string.
 * @param {string} dateStr "YYYY-MM-DD"
 * @returns {number} 0 (Mon) to 6 (Sun)
 */
function getDayOfWeek(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const utcDay = d.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  return (utcDay + 6) % 7;     // 0 = Monday, 1 = Tuesday, ..., 6 = Sunday
}

/**
 * Gets current date string "YYYY-MM-DD" in specified IANA timezone.
 * @param {string} tz IANA timezone string (e.g. "Asia/Kolkata")
 * @returns {string} "YYYY-MM-DD"
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
 * Calculates current streak for a habit.
 *
 * @param {"daily" | "scheduled"} frequencyType
 * @param {Array<number>} scheduleDays Array of integers 0-6 (0=Monday...6=Sunday)
 * @param {Array<string>} completionDates Array of date strings "YYYY-MM-DD"
 * @param {string} timezone IANA timezone string
 * @param {string} [today] Optional date string "YYYY-MM-DD" override for testing
 * @returns {number} Current streak count (>= 0)
 */
function calculateStreak(frequencyType, scheduleDays = [], completionDates = [], timezone = 'UTC', today = null) {
  const targetToday = today || getTodayInTimezone(timezone);
  const completedSet = new Set(completionDates || []);

  if (frequencyType === 'daily') {
    let streak = 0;
    let curr = targetToday;

    // If today is not completed yet, start checking from yesterday (today isn't a miss until day is over)
    if (!completedSet.has(curr)) {
      curr = getPreviousDateStr(curr);
    }

    let iterations = 0;
    while (iterations < 10000) {
      if (completedSet.has(curr)) {
        streak++;
        curr = getPreviousDateStr(curr);
      } else {
        break;
      }
      iterations++;
    }

    return streak;
  }

  if (frequencyType === 'scheduled') {
    if (!Array.isArray(scheduleDays) || scheduleDays.length === 0) {
      return 0;
    }

    const scheduledSet = new Set(scheduleDays.map(Number));
    let streak = 0;
    let curr = targetToday;

    let iterations = 0;
    while (iterations < 10000) {
      const dayOfWeek = getDayOfWeek(curr);

      if (scheduledSet.has(dayOfWeek)) {
        if (completedSet.has(curr)) {
          streak++;
        } else {
          // If curr is today and not completed yet, it's not a miss yet; skip breaking.
          if (curr !== targetToday) {
            // Past scheduled date missed => breaks streak.
            break;
          }
        }
      }

      curr = getPreviousDateStr(curr);
      iterations++;
    }

    return streak;
  }

  return 0;
}

module.exports = {
  calculateStreak,
};
