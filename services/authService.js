const crypto = require('crypto');
const argon2 = require('argon2');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');

// Using Gmail as the active email sender until a company domain is verified with Resend (see resend integration in git history for reference) - Gmail has no recipient restriction and works for any real user's email address today
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

/**
 * Sends a password reset email containing the raw token.
 * Logs and swallows any send error so the caller is not affected.
 *
 * @param {string} toEmail  Recipient address (the user's registered email)
 * @param {string} rawToken Unhashed reset token
 */
async function sendPasswordResetEmail(toEmail, rawToken) {
  const mailOptions = {
    from: process.env.GMAIL_USER,
    to: toEmail,
    subject: 'Reset your HabitUp password',
    text:
      `You requested a password reset for your HabitUp account.\n\n` +
      `Use the token below to reset your password:\n\n` +
      `  ${rawToken}\n\n` +
      `This token expires in 15 minutes.\n\n` +
      `If you did not request a password reset, you can safely ignore this email.`,
  };

  try {
    const result = await transporter.sendMail(mailOptions);
    console.log('[sendPasswordResetEmail] Email sent successfully to:', toEmail, result.messageId);
  } catch (err) {
    console.error('[sendPasswordResetEmail] Failed to send reset email:', err);
  }
}


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

/**
 * Creates a password reset token for a user (15 min expiry) and emails the
 * raw token to the user's registered address. Returns without error whether
 * or not the user exists (prevents email enumeration).
 *
 * @param {string} email
 * @returns {Promise<void>}
 */
async function createPasswordResetToken(email) {
  const user = await findUserByEmail(email);
  if (!user) {
    return;
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = await argon2.hash(rawToken);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await pool.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [user.id, tokenHash, expiresAt]
  );

  await sendPasswordResetEmail(user.email, rawToken);
}

/**
 * Resets user password if token is valid, unexpired, and unused.
 * Updates user's password_hash, marks token as used, and revokes all active sessions.
 *
 * @param {string} rawToken
 * @param {string} newPassword
 * @returns {Promise<boolean>} True if successful, false otherwise.
 */
async function resetPassword(rawToken, newPassword) {
  const { rows } = await pool.query(
    `SELECT id, user_id, token_hash, expires_at, used_at
     FROM password_reset_tokens
     WHERE used_at IS NULL AND expires_at > NOW()`
  );

  let matchedToken = null;
  for (const row of rows) {
    if (await argon2.verify(row.token_hash, rawToken)) {
      matchedToken = row;
      break;
    }
  }

  if (!matchedToken) {
    return false;
  }

  const newPasswordHash = await argon2.hash(newPassword);

  await pool.query(
    `UPDATE users SET password_hash = $1 WHERE id = $2`,
    [newPasswordHash, matchedToken.user_id]
  );

  await pool.query(
    `UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1`,
    [matchedToken.id]
  );

  await revokeAllSessionsForUser(matchedToken.user_id);

  return true;
}

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  createSession,
  findActiveSessionByJti,
  revokeSession,
  revokeAllSessionsForUser,
  createPasswordResetToken,
  resetPassword,
};