const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const argon2 = require('argon2');
const { Pool } = require('pg');
const {
  validateUsername,
  checkUsernameAvailable,
  getUserPublicProfile,
} = require('../services/usernameService');
const {
  createUser,
  findUserByEmail,
  createSession,
} = require('../services/authService');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const REFRESH_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function signAccessToken(userId, email) {
  return jwt.sign({ sub: userId, email }, ACCESS_SECRET, { expiresIn: '15m' });
}

function signRefreshToken(userId) {
  const jti = crypto.randomBytes(64).toString('hex');
  const token = jwt.sign({ sub: userId, jti }, REFRESH_SECRET, { expiresIn: '30d' });
  return { token, jti };
}

/**
 * POST /users/register or registerWithUsername
 * Registers a user with unique username, email, password.
 */
async function registerWithUsername(req, res) {
  const { email, password, username, name, timezone } = req.body;

  if (!email || !password || !username) {
    return res.status(400).json({ error: 'email, password, and username are required.' });
  }

  try {
    // 1. Validate username format & length
    validateUsername(username);

    // 2. Check username availability
    const available = await checkUsernameAvailable(username);
    if (!available) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    // 3. Check email availability
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'Email already in use.' });
    }

    // 4. Create user (stored as lowercase username)
    const displayName = name || username;
    const userTimezone = timezone || 'UTC';
    const user = await createUser({
      name: displayName,
      email,
      username,
      password,
      timezone: userTimezone,
    });

    // 5. Generate tokens and session
    const accessToken = signAccessToken(user.id, user.email);
    const { token: refreshToken, jti } = signRefreshToken(user.id);
    const refreshTokenHash = await argon2.hash(jti);
    const expiresAt = new Date(Date.now() + REFRESH_EXPIRY_MS);
    await createSession(user.id, refreshTokenHash, expiresAt);

    return res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
      },
      access_token: accessToken,
      refresh_token: refreshToken,
      accessToken,
      refreshToken,
    });
  } catch (err) {
    if (err.status === 400) {
      return res.status(400).json({ error: err.message });
    }
    console.error('[registerWithUsername]', err);
    return res.status(500).json({ error: 'Registration failed.' });
  }
}

/**
 * GET /users/search?query=...
 * Searches users by username prefix (min 3 chars).
 */
async function searchUsers(req, res) {
  const query = req.query.query;

  if (!query || typeof query !== 'string' || query.trim().length < 3) {
    return res.status(400).json({ error: 'Minimum 3 characters' });
  }

  try {
    const cleanQuery = query.trim().toLowerCase();
    const { rows } = await pool.query(
      `SELECT id, username
       FROM users
       WHERE LOWER(username) LIKE $1 || '%' AND deleted_at IS NULL
       ORDER BY username ASC
       LIMIT 20`,
      [cleanQuery]
    );

    return res.status(200).json({
      results: rows.map((r) => ({ id: r.id, username: r.username })),
    });
  } catch (err) {
    console.error('[searchUsers]', err);
    return res.status(500).json({ error: 'Failed to search users.' });
  }
}

/**
 * GET /users/@:username or GET /users/username/:username
 * Fetches public profile stats by username.
 */
async function getUserProfile(req, res) {
  const rawUsername = req.params.username || req.params.id || '';
  const username = rawUsername.replace(/^@/, '').trim();

  if (!username) {
    return res.status(404).json({ error: 'User not found' });
  }

  try {
    const profile = await getUserPublicProfile(username);
    if (!profile) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json(profile);
  } catch (err) {
    console.error('[getUserProfile]', err);
    return res.status(500).json({ error: 'Failed to fetch user profile.' });
  }
}

/**
 * GET /auth/me or GET /users/me or getAuthUserProfile
 * Fetches authenticated user's profile with username.
 */
async function getAuthUserProfile(req, res) {
  const userId = req.userId || req.user?.sub;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, email, username, created_at
       FROM users
       WHERE id = $1 AND deleted_at IS NULL`,
      [userId]
    );

    const user = rows[0];
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    return res.status(200).json({ user });
  } catch (err) {
    console.error('[getAuthUserProfile]', err);
    return res.status(500).json({ error: 'Failed to fetch authenticated user profile.' });
  }
}

module.exports = {
  registerWithUsername,
  searchUsers,
  getUserProfile,
  getAuthUserProfile,
};
