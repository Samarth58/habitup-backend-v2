const { Router } = require('express');
const {
  createHabit,
  listHabits,
  getHabit,
  updateHabit,
  deleteHabit,
} = require('../controllers/habitController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = Router();

// Protect all habit endpoints with auth middleware
router.use(requireAuth);

router.post('/', createHabit);
router.get('/', listHabits);
router.get('/:id', getHabit);
router.patch('/:id', updateHabit);
router.delete('/:id', deleteHabit);

module.exports = router;
