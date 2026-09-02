const crypto = require('crypto');
const jwt    = require('jsonwebtoken');
const argon2 = require('argon2');
const {
  createUser,
  findUserByEmail,
  findUserById,
  createSession,
  findActiveSessionByJti,
  revokeSession,
  revokeAllSessionsForUser,
  createPasswordResetToken,
  resetPassword,
  deleteUserAccount,
  updateSessionLastUsedAt,
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
    require('../services/activityService').logActivity(user.id, 'REGISTER', {}, req);
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
    require('../services/activityService').logActivity(user.id, 'LOGIN', {}, req).catch((err) => console.error('[login activity]', err));

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

    const user = await findUserById(userId);
    if (!user) {
      return res.status(401).json({ error: 'Session not found or already revoked.' });
    }

    const newAccessToken               = signAccessToken(userId, user.email);
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
      require('../services/activityService').logActivity(userId, 'LOGOUT', { session_id: session.id }, req).catch((err) => console.error('[logout activity]', err));
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
  const userId = req.userId || req.user?.sub;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  try {
    await revokeAllSessionsForUser(userId);
    require('../services/activityService').logActivity(userId, 'LOGOUT_ALL', {}, req).catch((err) => console.error('[logout-all activity]', err));
    return res.json({ message: 'All sessions revoked.' });
  } catch (err) {
    console.error('[logout-all]', err);
    return res.status(500).json({ error: 'Logout failed.' });
  }
}

/**
 * GET /auth/me
 * Header: Authorization: Bearer <accessToken>
 *
 * Returns the authenticated user's profile (id, name, email, timezone, created_at).
 * Uses req.userId. Never returns password_hash.
 */
async function getMe(req, res) {
  const userId = req.userId;

  try {
    const user = await findUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    return res.json({ user });
  } catch (err) {
    console.error('[getMe]', err);
    return res.status(500).json({ error: 'Failed to fetch user profile.' });
  }
}

/**
 * POST /auth/reset-password/request
 * Body: { email }
 *
 * Always returns a generic message to prevent email enumeration.
 * A password reset email is sent via Gmail SMTP to the user's registered address.
 */
async function requestPasswordReset(req, res) {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'email is required.' });
  }

  try {
    const resetUserId = await createPasswordResetToken(email);
    if (resetUserId) {
      require('../services/activityService').logActivity(resetUserId, 'PASSWORD_RESET_REQUESTED', {}, req).catch((err) => console.error('[reset request activity]', err));
    }

    return res.json({
      message: 'If that email exists, a password reset link has been sent.',
    });
  } catch (err) {
    console.error('[requestPasswordReset]', err);
    return res.status(500).json({ error: 'Failed to request password reset.' });
  }
}

/**
 * POST /auth/reset-password/confirm
 * Body: { token, newPassword }
 *
 * Confirms password reset using valid token and sets new password.
 */
async function confirmPasswordReset(req, res) {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ error: 'token and newPassword are required.' });
  }

  try {
    const success = await resetPassword(token, newPassword);
    if (!success) {
      return res.status(400).json({ error: 'Invalid, expired, or already used reset token.' });
    }

    require('../services/activityService').logActivity(null, 'PASSWORD_RESET_COMPLETED', {}, req).catch((err) => console.error('[reset complete activity]', err));

    return res.json({ message: 'Password has been reset successfully.' });
  } catch (err) {
    console.error('[confirmPasswordReset]', err);
    return res.status(500).json({ error: 'Failed to reset password.' });
  }
}

/**
 * DELETE /auth/account
 * Header: Authorization: Bearer <accessToken>
 * Body: { password }
 *
 * Permanently soft-deletes the authenticated user's account, anonymizes
 * email, and revokes all active sessions. Requires password confirmation.
 */
async function deleteAccount(req, res) {
  const userId = req.userId;
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'password is required.' });
  }

  try {
    const success = await deleteUserAccount(userId, password);
    if (!success) {
      return res.status(401).json({ error: 'Incorrect password.' });
    }

    require('../services/activityService').logActivity(userId, 'ACCOUNT_DELETED', {}, req).catch((err) => console.error('[delete activity]', err));

    return res.json({ message: 'Account deleted successfully.' });
  } catch (err) {
    console.error('[deleteAccount]', err);
    return res.status(500).json({ error: 'Failed to delete account.' });
  }
}

async function heartbeat(req, res) {
  const { refreshToken } = req.body || {};
  if (!refreshToken) return res.status(400).json({ error: 'refreshToken is required.' });

  let payload;
  try {
    payload = jwt.verify(refreshToken, REFRESH_SECRET);
  } catch {
    return res.status(400).json({ error: 'Invalid or expired refresh token.' });
  }

  if (payload.sub !== req.userId || !payload.jti) {
    return res.status(400).json({ error: 'Refresh token does not belong to the authenticated user.' });
  }

  try {
    const session = await findActiveSessionByJti(req.userId, payload.jti);
    if (!session) return res.status(404).json({ error: 'Session not found or revoked.' });
    await updateSessionLastUsedAt(session.id, req.userId);
    return res.json({ ok: true, message: 'Session heartbeat recorded.' });
  } catch (err) {
    console.error('[heartbeat]', err);
    return res.status(500).json({ error: 'Failed to update session heartbeat.' });
  }
}

module.exports = {
  register,
  login,
  refresh,
  logout,
  logoutAll,
  getMe,
  requestPasswordReset,
  confirmPasswordReset,
  deleteAccount,
  heartbeat,
};


