const {
  createReminder: createReminderService,
  getRemindersForHabit,
  updateReminder: updateReminderService,
  deleteReminder: deleteReminderService,
} = require('../services/reminderService');

/**
 * POST /habits/:habitId/reminders
 * Creates a reminder for a habit belonging to the authenticated user.
 */
async function createReminder(req, res) {
  const userId = req.userId;
  const habitId = req.params.habitId;
  const { time } = req.body;

  if (!time) {
    return res.status(400).json({ error: 'time is required.' });
  }

  try {
    const reminder = await createReminderService(userId, habitId, time);
    if (!reminder) {
      return res.status(404).json({ error: 'Habit not found.' });
    }
    return res.status(201).json({ reminder });
  } catch (err) {
    console.error('[createReminder]', err);
    return res.status(500).json({ error: 'Failed to create reminder.' });
  }
}

/**
 * GET /habits/:habitId/reminders
 * Returns all reminders for a habit belonging to the authenticated user.
 */
async function listReminders(req, res) {
  const userId = req.userId;
  const habitId = req.params.habitId;

  try {
    const reminders = await getRemindersForHabit(userId, habitId);
    if (reminders === null) {
      return res.status(404).json({ error: 'Habit not found.' });
    }
    return res.json({ reminders });
  } catch (err) {
    console.error('[listReminders]', err);
    return res.status(500).json({ error: 'Failed to fetch reminders.' });
  }
}

/**
 * PATCH /reminders/:id
 * Updates specific fields (time and/or enabled) of a reminder belonging to the authenticated user.
 */
async function updateReminder(req, res) {
  const userId = req.userId;
  const reminderId = req.params.id;
  const { time, enabled } = req.body;

  if (time === undefined && enabled === undefined) {
    return res.status(400).json({ error: 'At least one field (time or enabled) is required to update.' });
  }

  try {
    const reminder = await updateReminderService(userId, reminderId, { time, enabled });
    if (!reminder) {
      return res.status(404).json({ error: 'Reminder not found.' });
    }
    return res.json({ reminder });
  } catch (err) {
    console.error('[updateReminder]', err);
    return res.status(500).json({ error: 'Failed to update reminder.' });
  }
}

/**
 * DELETE /reminders/:id
 * Hard-deletes a reminder belonging to the authenticated user.
 */
async function deleteReminder(req, res) {
  const userId = req.userId;
  const reminderId = req.params.id;

  try {
    const deleted = await deleteReminderService(userId, reminderId);
    if (!deleted) {
      return res.status(404).json({ error: 'Reminder not found.' });
    }
    return res.json({ message: 'Reminder deleted successfully.' });
  } catch (err) {
    console.error('[deleteReminder]', err);
    return res.status(500).json({ error: 'Failed to delete reminder.' });
  }
}

module.exports = {
  createReminder,
  listReminders,
  updateReminder,
  deleteReminder,
};
