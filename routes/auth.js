const { Router } = require('express');
const { register, login, refresh, logout, logoutAll } = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = Router();

router.post('/register',   register);
router.post('/login',      login);
router.post('/refresh',    refresh);
router.post('/logout',     logout);
router.post('/logout-all', requireAuth, logoutAll);

module.exports = router;
