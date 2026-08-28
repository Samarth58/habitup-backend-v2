const argon2 = require('argon2');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ─── User functions ───────────────────────────────────────────────────────────

/**
 * Create a new user row.
 * @param {{ name: string, email: string, password: string, timezone: string }} param0
 * @returns {Promise<object>} The created user row (without password_hash).
 */
async function createUser({ name, email, password, timezone }) {
  const password_hash = await argon2.hash(password);
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash, timezone)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, email, timezone, created_at`,
    [name, email, password_hash, timezone]
  );
  return rows[0];
}

/**
 * Find a user by email, including the password_hash for verification.
 * @param {string} email
 * @returns {Promise<object|null>}
 */
async function findUserByEmail(email) {
  const { rows } = await pool.query(
    `SELECT id, name, email, password_hash, timezone, created_at
     FROM users
     WHERE email = $1`,
    [email]
  );
  return rows[0] ?? null;
}

// ─── Session functions ────────────────────────────────────────────────────────

/**
 * Insert a new session row.
 * device_id / device_name are optional.
 *
 * @param {string}      userId
 * @param {string}      refreshTokenHash  argon2 hash of the raw jti
 * @param {Date}        expiresAt
 * @param {string|null} deviceId
 * @param {string|null} deviceName
 * @returns {Promise<object>}
 */
async function createSession(userId, refreshTokenHash, expiresAt, deviceId = null, deviceName = null) {
  const { rows } = await pool.query(
    `INSERT INTO sessions (user_id, refresh_token_hash, device_id, device_name, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, user_id, device_id, device_name, expires_at, created_at`,
    [userId, refreshTokenHash, deviceId, deviceName, expiresAt]
  );
  return rows[0];
}

/**
 * Scan all unrevoked/unexpired sessions for a user and return the one whose
 * stored hash matches the provided plaintext jti.
 *
 * Because argon2 hashes are one-way we cannot query by jti directly.
 * In practice a user will have very few active sessions so this scan is cheap.
 *
 * @param {string} userId
 * @param {string} jti   plaintext jti extracted from the refresh JWT
 * @returns {Promise<object|null>} The matching session row, or null.
 */
async function findActiveSessionByJti(userId, jti) {
  const { rows } = await pool.query(
    `SELECT id, user_id, refresh_token_hash, device_id, device_name,
            expires_at, created_at, last_used_at
     FROM sessions
     WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()`,
    [userId]
  );
  for (const session of rows) {
    if (await argon2.verify(session.refresh_token_hash, jti)) {
      return session;
    }
  }
  return null;
}

/**
 * Soft-revoke a single session by id.
 * @param {string} sessionId
 */
async function revokeSession(sessionId) {
  await pool.query(
    `UPDATE sessions SET revoked_at = NOW() WHERE id = $1`,
    [sessionId]
  );
}

/**
 * Soft-revoke every active session for a user (logout-all).
 * @param {string} userId
 */
async function revokeAllSessionsForUser(userId) {
  await pool.query(
    `UPDATE sessions SET revoked_at = NOW()
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId]
  );
}

/**
 * Find a user profile by ID, excluding password_hash.
 * @param {string} userId
 * @returns {Promise<object|null>}
 */
async function findUserById(userId) {
  const { rows } = await pool.query(
    `SELECT id, name, email, timezone, created_at
     FROM users
     WHERE id = $1`,
    [userId]
  );
  return rows[0] ?? null;
}

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  createSession,
  findActiveSessionByJti,
  revokeSession,
  revokeAllSessionsForUser,
};