const { Router } = require('express');
const { register, login, refresh, logout, logoutAll, getMe } = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = Router();

router.post('/register',   register);
router.post('/login',      login);
router.post('/refresh',    refresh);
router.post('/logout',     logout);
router.post('/logout-all', requireAuth, logoutAll);
router.get('/me',          requireAuth, getMe);

module.exports = router;
