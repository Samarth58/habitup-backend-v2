const { Router } = require('express');
const {
  createReminder,
  listReminders,
  updateReminder,
  deleteReminder,
} = require('../controllers/reminderController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = Router();

// Protect all reminder endpoints with auth middleware
router.use(requireAuth);

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
router.post('/habits/:habitId/reminders', createReminder);

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
router.get('/habits/:habitId/reminders', listReminders);

/**
 * @swagger
 * /reminders/{id}:
 *   patch:
 *     tags: [Reminders]
 *     summary: Update a reminder's time and/or enabled state
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Reminder ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               time:    { type: string, example: '08:00', description: 'HH:MM in 24-hour format' }
 *               enabled: { type: boolean, example: false }
 *     responses:
 *       200:
 *         description: Updated reminder
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 reminder: { $ref: '#/components/schemas/Reminder' }
 *       400:
 *         description: No fields to update provided
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Reminder not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch('/:id', updateReminder);

/**
 * @swagger
 * /reminders/{id}:
 *   delete:
 *     tags: [Reminders]
 *     summary: Delete a reminder
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Reminder ID
 *     responses:
 *       200:
 *         description: Reminder deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: Reminder deleted successfully. }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Reminder not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.delete('/:id', deleteReminder);

module.exports = router;
