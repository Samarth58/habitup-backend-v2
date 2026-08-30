const { Router } = require('express');
const {
  createHabit,
  listHabits,
  listArchivedHabits,
  getHabit,
  updateHabit,
  deleteHabit,
  pauseHabit,
  unpauseHabit,
  archiveHabit,
  unarchiveHabit,
  addHabitCompletion,
  removeHabitCompletion,
  getHabitStatsHandler,
  getUserStatsHandler,
} = require('../controllers/habitController');
const {
  createReminder,
  listReminders,
} = require('../controllers/reminderController');
const { requireAuth } = require('../middleware/authMiddleware');
const { validateUuid } = require('../middleware/validateUuid');

const router = Router();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateUuid(paramName) {
  return (req, res, next) => {
    const value = req.params[paramName];

    if (!value || !UUID_PATTERN.test(value)) {
      return res.status(400).json({ error: `Invalid ${paramName} UUID.` });
    }

    next();
  };
}

// Protect all habit endpoints with auth middleware
router.use(requireAuth);

/**
 * @swagger
 * /habits:
 *   post:
 *     tags: [Habits]
 *     summary: Create a new habit
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, frequency_type]
 *             properties:
 *               name:           { type: string, example: Morning Run }
 *               description:    { type: string, example: Run 5km every morning, nullable: true }
 *               icon:           { type: string, example: 🏃, nullable: true }
 *               color:          { type: string, example: '#FF5733', nullable: true }
 *               frequency_type: { type: string, enum: [daily, scheduled] }
 *               days:
 *                 type: array
 *                 description: Day-of-week indices (0=Sun … 6=Sat). Required when frequency_type is "scheduled".
 *                 items: { type: integer, minimum: 0, maximum: 6 }
 *                 example: [1, 3, 5]
 *     responses:
 *       201:
 *         description: Habit created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 habit: { $ref: '#/components/schemas/Habit' }
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/', createHabit);

/**
 * @swagger
 * /habits:
 *   get:
 *     tags: [Habits]
 *     summary: List all active habits for the authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of active habits with schedule and streak
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 habits:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Habit' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/', listHabits);

/**
 * @swagger
 * /habits/archived:
 *   get:
 *     tags: [Habits]
 *     summary: List all archived habits for the authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of archived habits with schedule and streak
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 habits:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Habit' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/archived', listArchivedHabits);

/**
 * @swagger
 * /habits/stats:
 *   get:
 *     tags: [Stats]
 *     summary: Get aggregated stats across all active habits for the authenticated user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [month, year]
 *           default: month
 *         description: Time period for statistics
 *     responses:
 *       200:
 *         description: User-level stats
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/UserStats' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/stats', getUserStatsHandler);

/**
 * @swagger
 * /habits/{id}/stats:
 *   get:
 *     tags: [Stats]
 *     summary: Get statistics for a specific habit
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Habit ID
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [month, year]
 *           default: month
 *         description: Time period for statistics
 *     responses:
 *       200:
 *         description: Per-habit stats
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/HabitStats' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Habit not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/:id/stats', validateUuid('id'), getHabitStatsHandler);

/**
 * @swagger
 * /habits/{id}:
 *   get:
 *     tags: [Habits]
 *     summary: Get a single habit by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Habit ID
 *     responses:
 *       200:
 *         description: Habit with schedule and streak
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 habit: { $ref: '#/components/schemas/Habit' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Habit not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/:id', validateUuid('id'), getHabit);

/**
 * @swagger
 * /habits/{id}:
 *   patch:
 *     tags: [Habits]
 *     summary: Update a habit's fields and/or schedule
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Habit ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:           { type: string, example: Evening Run }
 *               description:    { type: string, nullable: true }
 *               icon:           { type: string, nullable: true }
 *               color:          { type: string, nullable: true }
 *               frequency_type: { type: string, enum: [daily, scheduled] }
 *               days:
 *                 type: array
 *                 items: { type: integer, minimum: 0, maximum: 6 }
 *                 example: [0, 2, 4]
 *     responses:
 *       200:
 *         description: Updated habit
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 habit: { $ref: '#/components/schemas/Habit' }
 *       400:
 *         description: No updatable fields provided
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Habit not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch('/:id', validateUuid('id'), updateHabit);

/**
 * @swagger
 * /habits/{id}:
 *   delete:
 *     tags: [Habits]
 *     summary: Soft-delete a habit
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Habit ID
 *     responses:
 *       200:
 *         description: Habit deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: Habit deleted successfully. }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Habit not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.delete('/:id', validateUuid('id'), deleteHabit);

/**
 * @swagger
 * /habits/{id}/pause:
 *   patch:
 *     tags: [Habits]
 *     summary: Pause a habit (sets paused_at timestamp)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Habit ID
 *     responses:
 *       200:
 *         description: Paused habit
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 habit: { $ref: '#/components/schemas/Habit' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Habit not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch('/:id/pause', validateUuid('id'), pauseHabit);

/**
 * @swagger
 * /habits/{id}/unpause:
 *   patch:
 *     tags: [Habits]
 *     summary: Unpause a habit (clears paused_at timestamp)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Habit ID
 *     responses:
 *       200:
 *         description: Unpaused habit
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 habit: { $ref: '#/components/schemas/Habit' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Habit not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch('/:id/unpause', validateUuid('id'), unpauseHabit);

/**
 * @swagger
 * /habits/{id}/archive:
 *   patch:
 *     tags: [Habits]
 *     summary: Archive a habit (sets archived_at timestamp)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Habit ID
 *     responses:
 *       200:
 *         description: Archived habit
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 habit: { $ref: '#/components/schemas/Habit' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Habit not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch('/:id/archive', validateUuid('id'), archiveHabit);

/**
 * @swagger
 * /habits/{id}/unarchive:
 *   patch:
 *     tags: [Habits]
 *     summary: Unarchive a habit (clears archived_at timestamp)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Habit ID
 *     responses:
 *       200:
 *         description: Unarchived habit
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 habit: { $ref: '#/components/schemas/Habit' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Habit not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch('/:id/unarchive', validateUuid('id'), unarchiveHabit);

/**
 * @swagger
 * /habits/{id}/completions:
 *   post:
 *     tags: [Habits]
 *     summary: Mark a habit as completed for today (in the user's timezone)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Habit ID
 *     responses:
 *       201:
 *         description: Completion recorded with updated streak
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 completion:
 *                   type: object
 *                   properties:
 *                     id:           { type: string, format: uuid }
 *                     habit_id:     { type: string, format: uuid }
 *                     user_id:      { type: string, format: uuid }
 *                     completed_on: { type: string, format: date, example: '2026-08-29' }
 *                 streak: { type: integer, example: 8 }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Habit not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/:id/completions', validateUuid('id'), addHabitCompletion);

/**
 * @swagger
 * /habits/{id}/completions/{date}:
 *   delete:
 *     tags: [Habits]
 *     summary: Remove a completion for a specific date
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Habit ID
 *       - in: path
 *         name: date
 *         required: true
 *         schema: { type: string, format: date, example: '2026-08-29' }
 *         description: Date of the completion to remove (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Completion removed with updated streak
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: Completion removed. }
 *                 streak:  { type: integer, example: 6 }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Habit or completion not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.delete('/:id/completions/:date', validateUuid('id'), removeHabitCompletion);

/**
 * @swagger
 * /habits/{habitId}/reminders:
 *   post:
 *     tags: [Reminders]
 *     summary: Create a reminder for a habit
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: habitId
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Habit ID to attach the reminder to
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [time]
 *             properties:
 *               time: { type: string, example: '07:30', description: 'HH:MM in 24-hour format' }
 *     responses:
 *       201:
 *         description: Reminder created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 reminder: { $ref: '#/components/schemas/Reminder' }
 *       400:
 *         description: time field missing
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Habit not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/:habitId/reminders', validateUuid('habitId'), createReminder);

/**
 * @swagger
 * /habits/{habitId}/reminders:
 *   get:
 *     tags: [Reminders]
 *     summary: List all reminders for a habit
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: habitId
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Habit ID
 *     responses:
 *       200:
 *         description: Array of reminders
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 reminders:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Reminder' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Habit not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/:habitId/reminders', validateUuid('habitId'), listReminders);

module.exports = router;

