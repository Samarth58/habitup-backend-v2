const crypto = require('crypto');
const jwt    = require('jsonwebtoken');
const argon2 = require('argon2');
const {
  createUser,
  findUserByEmail,
  createSession,
  findActiveSessionByJti,
  revokeSession,
  revokeAllSessionsForUser,
} = require('../services/authService');

const ACCESS_SECRET     = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET    = process.env.JWT_REFRESH_SECRET;
const REFRESH_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// ─── Token helpers ────────────────────────────────────────────────────────────

/** Signs a 15-min access token. */
function signAccessToken(userId, email) {
  return jwt.sign({ sub: userId, email }, ACCESS_SECRET, { expiresIn: '15m' });
}

/**
 * Generates 64 bytes of random entropy (jti), wraps it in a signed 30-day JWT.
 * The raw jti is what gets hashed and stored — the JWT is what the client holds.
 *
 * @returns {{ token: string, jti: string }}
 */
function signRefreshToken(userId) {
  const jti   = crypto.randomBytes(64).toString('hex');
  const token = jwt.sign({ sub: userId, jti }, REFRESH_SECRET, { expiresIn: '30d' });
  return { token, jti };
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

/**
 * POST /auth/register
 * Body: { name, email, password, timezone }
 *
 * Returns an access token only. The user must log in to get a refresh token.
 * This keeps registration distinct from session creation (easier to add
 * email-verification later without sessions accumulating pre-verification).
 */
async function register(req, res) {
  const { name, email, password, timezone } = req.body;

  if (!name || !email || !password || !timezone) {
    return res.status(400).json({ error: 'name, email, password, and timezone are required.' });
  }

  try {
    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'Email already in use.' });
    }

    const user        = await createUser({ name, email, password, timezone });
    const accessToken = signAccessToken(user.id, user.email);

    return res.status(201).json({ accessToken, user });
  } catch (err) {
    console.error('[register]', err);
    return res.status(500).json({ error: 'Registration failed.' });
  }
}

/**
 * POST /auth/login
 * Body: { email, password }
 *
 * Returns { accessToken, refreshToken, user }.
 * The refresh token's jti is hashed with argon2 before being stored in sessions.
 */
async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required.' });
  }

  try {
    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const valid = await argon2.verify(user.password_hash, password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const accessToken              = signAccessToken(user.id, user.email);
    const { token: refreshToken, jti } = signRefreshToken(user.id);

    // Hash the jti (never store plaintext) and persist the session
    const refreshTokenHash = await argon2.hash(jti);
    const expiresAt        = new Date(Date.now() + REFRESH_EXPIRY_MS);
    await createSession(user.id, refreshTokenHash, expiresAt);

    const { password_hash, ...safeUser } = user;
    return res.json({ accessToken, refreshToken, user: safeUser });
  } catch (err) {
    console.error('[login]', err);
    return res.status(500).json({ error: 'Login failed.' });
  }
}

/**
 * POST /auth/refresh
 * Body: { refreshToken }
 *
 * 1. Verifies JWT signature & expiry.
 * 2. Extracts jti and scans the user's active sessions to find a hash match.
 * 3. Revokes the old session (rotation — prevents replay).
 * 4. Issues a fresh access token + refresh token and creates a new session.
 *
 * Returns { accessToken, refreshToken }.
 */
async function refresh(req, res) {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: 'refreshToken is required.' });
  }

  let payload;
  try {
    payload = jwt.verify(refreshToken, REFRESH_SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired refresh token.' });
  }

  const { sub: userId, jti } = payload;

  try {
    const session = await findActiveSessionByJti(userId, jti);
    if (!session) {
      return res.status(401).json({ error: 'Session not found or already revoked.' });
    }

    // Rotate: revoke the matched session, create a fresh one
    await revokeSession(session.id);

    const newAccessToken               = signAccessToken(userId);
    const { token: newRefreshToken, jti: newJti } = signRefreshToken(userId);
    const newHash    = await argon2.hash(newJti);
    const expiresAt  = new Date(Date.now() + REFRESH_EXPIRY_MS);
    await createSession(userId, newHash, expiresAt);

    return res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (err) {
    console.error('[refresh]', err);
    return res.status(500).json({ error: 'Token refresh failed.' });
  }
}

/**
 * POST /auth/logout
 * Body: { refreshToken }
 *
 * Revokes the single session tied to the provided refresh token.
 * Always returns 200 — even if the token is already invalid — so the client
 * can safely call this without worrying about race conditions.
 */
async function logout(req, res) {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: 'refreshToken is required.' });
  }

  let payload;
  try {
    payload = jwt.verify(refreshToken, REFRESH_SECRET);
  } catch {
    // Expired or tampered — nothing to revoke, treat as already logged out
    return res.json({ message: 'Logged out.' });
  }

  const { sub: userId, jti } = payload;

  try {
    const session = await findActiveSessionByJti(userId, jti);
    if (session) {
      await revokeSession(session.id);
    }
    return res.json({ message: 'Logged out.' });
  } catch (err) {
    console.error('[logout]', err);
    return res.status(500).json({ error: 'Logout failed.' });
  }
}

/**
 * POST /auth/logout-all
 * Header: Authorization: Bearer <accessToken>
 *
 * Revokes every active session for the authenticated user.
 * Requires auth middleware that sets req.user = { sub, email }.
 */
async function logoutAll(req, res) {
  const userId = req.user?.sub;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  try {
    await revokeAllSessionsForUser(userId);
    return res.json({ message: 'All sessions revoked.' });
  } catch (err) {
    console.error('[logout-all]', err);
    return res.status(500).json({ error: 'Logout failed.' });
  }
}

module.exports = { register, login, refresh, logout, logoutAll };
