const { pool } = require('../services/db');
const {
  validateUsername,
  checkUsernameAvailable,
  getUserPublicProfile,
} = require('../services/usernameService');
const { handleUserRegistration } = require('./authController');

/**
 * POST /users/register or registerWithUsername
 * Registers a user with unique username, email, password.
 */
async function registerWithUsername(req, res) {
  try {
    const result = await handleUserRegistration(req.body, req);
    return res.status(201).json(result);
  } catch (err) {
    if (err.status === 400) {
      return res.status(400).json({ error: err.message });
    }
    if (err.status === 409) {
      return res.status(409).json({ error: err.message });
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
