const {
  createHabit: createHabitService,
  getHabitsForUser,
  getHabitById,
  updateHabit: updateHabitService,
  softDeleteHabit,
  setHabitSchedule,
  getHabitSchedule,
} = require('../services/habitService');

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
    return res.status(201).json({ habit: { ...habit, schedule } });
  } catch (err) {
    console.error('[createHabit]', err);
    return res.status(500).json({ error: 'Failed to create habit.' });
  }
}

/**
 * GET /habits
 * Returns all active habits for the authenticated user along with their schedules.
 */
async function listHabits(req, res) {
  const userId = req.userId;

  try {
    const habits = await getHabitsForUser(userId);
    const habitsWithSchedule = await Promise.all(
      habits.map(async (habit) => {
        const schedule = await getHabitSchedule(habit.id);
        return { ...habit, schedule };
      })
    );
    return res.json({ habits: habitsWithSchedule });
  } catch (err) {
    console.error('[listHabits]', err);
    return res.status(500).json({ error: 'Failed to fetch habits.' });
  }
}

/**
 * GET /habits/:id
 * Returns a specific habit belonging to the authenticated user along with its schedule.
 */
async function getHabit(req, res) {
  const userId = req.userId;
  const habitId = req.params.id;

  try {
    const habit = await getHabitById(userId, habitId);
    if (!habit) {
      return res.status(404).json({ error: 'Habit not found.' });
    }
    const schedule = await getHabitSchedule(habit.id);
    return res.json({ habit: { ...habit, schedule } });
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

    const schedule = await getHabitSchedule(habitId);
    return res.json({ habit: { ...habit, schedule } });
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

module.exports = {
  createHabit,
  listHabits,
  getHabit,
  updateHabit,
  deleteHabit,
};
