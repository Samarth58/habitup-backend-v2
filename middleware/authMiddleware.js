const jwt = require('jsonwebtoken');

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;

/**
 * Express middleware that enforces a valid JWT access token.
 *
 * Expects:  Authorization: Bearer <token>
 * On success: sets req.userId = decoded.sub, calls next()
 * On failure: responds 401 with a descriptive error message
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization ?? '';

  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header missing or malformed.' });
  }

  const token = header.slice(7);

  try {
    const decoded  = jwt.verify(token, ACCESS_SECRET);
    req.userId     = decoded.sub;   // primary identifier used by route handlers
    req.user       = decoded;       // full payload available if needed (sub, email, iat, exp)
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Access token has expired.' });
    }
    return res.status(401).json({ error: 'Invalid access token.' });
  }
}

module.exports = { requireAuth };
