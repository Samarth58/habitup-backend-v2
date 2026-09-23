const { getUserNotificationLanguage } = require('./userLanguageService');
const { getHabitsForUser, getHabitSchedule, getUserTimezone } = require('./habitService');
const { getHabitStats } = require('./statsService');

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Gathers a sanitized, privacy-safe context object for the authenticated user to pass to the AI Coach.
 *
 * Included:
 * - preferredLanguage
 * - timezone
 * - active habits (name, frequency/schedule, current streak, best streak, completion rate, monthly completions)
 *
 * Strictly excluded:
 * - password hashes, tokens, API keys, emails, user IDs in prompt, database internals, other users' data.
 *
 * @param {string} userId - Authenticated user UUID
 * @returns {Promise<object>} Controlled context object
 */
async function getAIUserContext(userId) {
  if (!userId) {
    return { preferredLanguage: 'en' };
  }

  try {
    const [preferredLanguage, timezone, activeHabits] = await Promise.all([
      getUserNotificationLanguage(userId),
      getUserTimezone(userId),
      getHabitsForUser(userId),
    ]);

    const sanitizedHabits = await Promise.all(
      activeHabits.map(async (habit) => {
        let scheduleDesc = habit.frequency_type;
        if (habit.frequency_type === 'scheduled') {
          const scheduleDays = await getHabitSchedule(habit.id);
          const dayLabels = scheduleDays.map((d) => DAY_NAMES[d] || d);
          scheduleDesc = dayLabels.length > 0 ? `Scheduled on ${dayLabels.join(', ')}` : 'Scheduled';
        }

        const stats = await getHabitStats(userId, habit.id, timezone, 'month');

        return {
          name: habit.name,
          frequency: scheduleDesc,
          currentStreak: stats?.current_streak ?? 0,
          bestStreak: stats?.best_streak ?? 0,
          completionRate: stats ? `${stats.completion_rate}%` : '0%',
          totalCompletionsThisMonth: stats?.total_completions ?? 0,
        };
      })
    );

    return {
      preferredLanguage,
      timezone,
      activeHabitCount: sanitizedHabits.length,
      habits: sanitizedHabits,
    };
  } catch (err) {
    console.error(`[aiContextService] Error building context for user ${userId}:`, err.message);
    // Graceful fallback so chat continues even if context gathering encounters an issue
    return {
      preferredLanguage: 'en',
    };
  }
}

module.exports = {
  getAIUserContext,
  DAY_NAMES,
};
