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

router.post('/habits/:habitId/reminders', createReminder);
router.get('/habits/:habitId/reminders', listReminders);
router.patch('/reminders/:id', updateReminder);
router.delete('/reminders/:id', deleteReminder);

module.exports = router;
