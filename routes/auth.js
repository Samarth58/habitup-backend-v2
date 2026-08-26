const { Router } = require('express');
const { register, login, refresh, logout, logoutAll } = require('../controllers/authController');

// TODO: replace this stub with your real JWT auth middleware when ready.
// logoutAll needs req.user.sub set by that middleware.
const requireAuth = (req, res, next) => {
  const header = req.headers.authorization ?? '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized.' });

  try {
    const jwt = require('jsonwebtoken');
    req.user  = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized.' });
  }
};

const router = Router();

router.post('/register',    register);
router.post('/login',       login);
router.post('/refresh',     refresh);
router.post('/logout',      logout);
router.post('/logout-all',  requireAuth, logoutAll);

module.exports = router;
