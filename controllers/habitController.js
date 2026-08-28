const {
  createHabit: createHabitService,
  getHabitsForUser,
  getHabitById,
  updateHabit: updateHabitService,
  softDeleteHabit,
  setHabitSchedule,
  getHabitSchedule,
  addCompletion,
  removeCompletion,
  getCompletionDates,
  getUserTimezone,
} = require('../services/habitService');
const { calculateStreak } = require('../services/streakService');

/**
 * POST /habits
 * Creates a new habit for the authenticated user.
 * Accepts optional `days` array if `frequency_type` is 'scheduled'.
 */
async function createHabit(req, res) {
  const userId = req.userId;
  const { name, description, icon, color, frequency_type, days } = req.body;

  if (!name || !frequency_type) {
    return res.status(400).json({ error: 'name and frequency_type are required.' });
  }

  try {
    const habit = await createHabitService(userId, {
      name,
      description,
      icon,
      color,
      frequency_type,
    });

    if (frequency_type === 'scheduled' && Array.isArray(days)) {
      await setHabitSchedule(habit.id, days);
    }

    const schedule = await getHabitSchedule(habit.id);
    return res.status(201).json({ habit: { ...habit, schedule, streak: 0 } });
  } catch (err) {
    console.error('[createHabit]', err);
    return res.status(500).json({ error: 'Failed to create habit.' });
  }
}

/**
 * GET /habits
 * Returns all active habits for the authenticated user along with their schedules & streaks.
 */
async function listHabits(req, res) {
  const userId = req.userId;

  try {
    const timezone = await getUserTimezone(userId, req.user?.timezone);
    const habits = await getHabitsForUser(userId);
    const habitsWithDetails = await Promise.all(
      habits.map(async (habit) => {
        const schedule = await getHabitSchedule(habit.id);
        const completionDates = await getCompletionDates(userId, habit.id);
        const streak = calculateStreak(habit.frequency_type, schedule, completionDates, timezone);
        return { ...habit, schedule, streak };
      })
    );
    return res.json({ habits: habitsWithDetails });
  } catch (err) {
    console.error('[listHabits]', err);
    return res.status(500).json({ error: 'Failed to fetch habits.' });
  }
}

/**
 * GET /habits/:id
 * Returns a specific habit belonging to the authenticated user along with its schedule & streak.
 */
async function getHabit(req, res) {
  const userId = req.userId;
  const habitId = req.params.id;

  try {
    const habit = await getHabitById(userId, habitId);
    if (!habit) {
      return res.status(404).json({ error: 'Habit not found.' });
    }

    const timezone = await getUserTimezone(userId, req.user?.timezone);
    const schedule = await getHabitSchedule(habit.id);
    const completionDates = await getCompletionDates(userId, habit.id);
    const streak = calculateStreak(habit.frequency_type, schedule, completionDates, timezone);

    return res.json({ habit: { ...habit, schedule, streak } });
  } catch (err) {
    console.error('[getHabit]', err);
    return res.status(500).json({ error: 'Failed to fetch habit.' });
  }
}

/**
 * PATCH /habits/:id
 * Updates specific fields and/or schedule days of a habit belonging to the authenticated user.
 */
async function updateHabit(req, res) {
  const userId = req.userId;
  const habitId = req.params.id;
  const { days, ...fields } = req.body;

  if (Object.keys(fields).length === 0 && !Array.isArray(days)) {
    return res.status(400).json({ error: 'At least one field or days array to update is required.' });
  }

  try {
    let habit = await getHabitById(userId, habitId);
    if (!habit) {
      return res.status(404).json({ error: 'Habit not found.' });
    }

    if (Object.keys(fields).length > 0) {
      habit = await updateHabitService(userId, habitId, fields);
    }

    if (Array.isArray(days)) {
      await setHabitSchedule(habitId, days);
    }

    const timezone = await getUserTimezone(userId, req.user?.timezone);
    const schedule = await getHabitSchedule(habitId);
    const completionDates = await getCompletionDates(userId, habitId);
    const streak = calculateStreak(habit.frequency_type, schedule, completionDates, timezone);

    return res.json({ habit: { ...habit, schedule, streak } });
  } catch (err) {
    console.error('[updateHabit]', err);
    return res.status(500).json({ error: 'Failed to update habit.' });
  }
}

/**
 * DELETE /habits/:id
 * Soft-deletes a habit belonging to the authenticated user.
 */
async function deleteHabit(req, res) {
  const userId = req.userId;
  const habitId = req.params.id;

  try {
    const deleted = await softDeleteHabit(userId, habitId);
    if (!deleted) {
      return res.status(404).json({ error: 'Habit not found.' });
    }
    return res.json({ message: 'Habit deleted successfully.' });
  } catch (err) {
    console.error('[deleteHabit]', err);
    return res.status(500).json({ error: 'Failed to delete habit.' });
  }
}

/**
 * POST /habits/:id/completions
 * Records completion for today in user's timezone and returns the completion record & updated streak.
 */
async function addHabitCompletion(req, res) {
  const userId = req.userId;
  const habitId = req.params.id;

  try {
    const habit = await getHabitById(userId, habitId);
    if (!habit) {
      return res.status(404).json({ error: 'Habit not found.' });
    }

    const timezone = await getUserTimezone(userId, req.user?.timezone);
    const completion = await addCompletion(userId, habitId, timezone);
    const schedule = await getHabitSchedule(habitId);
    const completionDates = await getCompletionDates(userId, habitId);
    const streak = calculateStreak(habit.frequency_type, schedule, completionDates, timezone);

    return res.status(201).json({ completion, streak });
  } catch (err) {
    console.error('[addHabitCompletion]', err);
    return res.status(500).json({ error: 'Failed to record completion.' });
  }
}

/**
 * DELETE /habits/:id/completions/:date
 * Removes completion for a specified date and returns the updated streak.
 */
async function removeHabitCompletion(req, res) {
  const userId = req.userId;
  const habitId = req.params.id;
  const dateStr = req.params.date;

  try {
    const habit = await getHabitById(userId, habitId);
    if (!habit) {
      return res.status(404).json({ error: 'Habit not found.' });
    }

    const timezone = await getUserTimezone(userId, req.user?.timezone);
    const removed = await removeCompletion(userId, habitId, dateStr);
    if (!removed) {
      return res.status(404).json({ error: 'Completion not found.' });
    }

    const schedule = await getHabitSchedule(habitId);
    const completionDates = await getCompletionDates(userId, habitId);
    const streak = calculateStreak(habit.frequency_type, schedule, completionDates, timezone);

    return res.json({ message: 'Completion removed.', streak });
  } catch (err) {
    console.error('[removeHabitCompletion]', err);
    return res.status(500).json({ error: 'Failed to remove completion.' });
  }
}

module.exports = {
  createHabit,
  listHabits,
  getHabit,
  updateHabit,
  deleteHabit,
  addHabitCompletion,
  removeHabitCompletion,
};
