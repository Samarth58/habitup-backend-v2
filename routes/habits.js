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
} = require('../controllers/habitController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = Router();

// Protect all habit endpoints with auth middleware
router.use(requireAuth);

router.post('/', createHabit);
router.get('/', listHabits);
router.get('/archived', listArchivedHabits);
router.get('/:id', getHabit);
router.patch('/:id', updateHabit);
router.delete('/:id', deleteHabit);

router.patch('/:id/pause', pauseHabit);
router.patch('/:id/unpause', unpauseHabit);
router.patch('/:id/archive', archiveHabit);
router.patch('/:id/unarchive', unarchiveHabit);

router.post('/:id/completions', addHabitCompletion);
router.delete('/:id/completions/:date', removeHabitCompletion);

module.exports = router;
