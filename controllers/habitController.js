const {
  createHabit: createHabitService,
  getHabitsForUser,
  getHabitById,
  updateHabit: updateHabitService,
  softDeleteHabit,
} = require('../services/habitService');

/**
 * POST /habits
 * Creates a new habit for the authenticated user.
 */
async function createHabit(req, res) {
  const userId = req.userId;
  const { name, description, icon, color, frequency_type } = req.body;

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
    return res.status(201).json({ habit });
  } catch (err) {
    console.error('[createHabit]', err);
    return res.status(500).json({ error: 'Failed to create habit.' });
  }
}

/**
 * GET /habits
 * Returns all active habits for the authenticated user.
 */
async function listHabits(req, res) {
  const userId = req.userId;

  try {
    const habits = await getHabitsForUser(userId);
    return res.json({ habits });
  } catch (err) {
    console.error('[listHabits]', err);
    return res.status(500).json({ error: 'Failed to fetch habits.' });
  }
}

/**
 * GET /habits/:id
 * Returns a specific habit belonging to the authenticated user.
 */
async function getHabit(req, res) {
  const userId = req.userId;
  const habitId = req.params.id;

  try {
    const habit = await getHabitById(userId, habitId);
    if (!habit) {
      return res.status(404).json({ error: 'Habit not found.' });
    }
    return res.json({ habit });
  } catch (err) {
    console.error('[getHabit]', err);
    return res.status(500).json({ error: 'Failed to fetch habit.' });
  }
}

/**
 * PATCH /habits/:id
 * Updates specific fields of a habit belonging to the authenticated user.
 */
async function updateHabit(req, res) {
  const userId = req.userId;
  const habitId = req.params.id;
  const fields = req.body;

  if (!fields || Object.keys(fields).length === 0) {
    return res.status(400).json({ error: 'At least one field to update is required.' });
  }

  try {
    const habit = await updateHabitService(userId, habitId, fields);
    if (!habit) {
      return res.status(404).json({ error: 'Habit not found.' });
    }
    return res.json({ habit });
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
