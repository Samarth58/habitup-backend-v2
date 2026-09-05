const crypto = require('crypto');
const argon2 = require('argon2');
const { Pool } = require('pg');
const { Resend } = require('resend');
const nodemailer = require('nodemailer');

// Email Provider Clients:
// 1. Brevo HTTP API: Unrestricted recipient delivery without requiring a custom domain (uses HTTPS port 443).
const brevoApiKey = process.env.BREVO_API_KEY;
const brevoSenderEmail = process.env.BREVO_SENDER_EMAIL || process.env.GMAIL_USER || 'samarthahg2004@gmail.com';
const brevoSenderName = process.env.BREVO_SENDER_NAME || 'HabitUp';

// 2. Resend HTTP API: Primary when a custom verified domain or account owner address is used.
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// 3. Gmail SMTP: Local development fallback.
const gmailTransporter = (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD)
  ? nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    })
  : null;

/**
 * Sends a password reset email containing the raw token.
 * Tries providers in priority order:
 *   1. Brevo HTTP API (Works in cloud production to any recipient without domain verification)
 *   2. Resend HTTP API (Works in cloud production for verified domains / account email)
 *   3. Gmail SMTP (Local development only)
 * Logs and swallows any send error so the caller is not affected.
 *
 * @param {string} toEmail  Recipient address (the user's registered email)
 * @param {string} rawToken Unhashed reset token
 */
async function sendPasswordResetEmail(toEmail, rawToken) {
  const subject = 'Reset your HabitUp password';
  const text =
    `You requested a password reset for your HabitUp account.\n\n` +
    `Use the token below to reset your password:\n\n` +
    `  ${rawToken}\n\n` +
    `This token expires in 15 minutes.\n\n` +
    `If you did not request a password reset, you can safely ignore this email.`;

  // 1. Try Brevo HTTP API (Recommended for arbitrary recipients without custom domain)
  if (brevoApiKey) {
    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': brevoApiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender: {
            name: brevoSenderName,
            email: brevoSenderEmail,
          },
          to: [{ email: toEmail }],
          subject,
          textContent: text,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        console.log('[sendPasswordResetEmail] Email dispatched via Brevo to:', toEmail, data.messageId || data);
        return;
      } else {
        console.error('[sendPasswordResetEmail] Brevo API returned error:', data);
      }
    } catch (err) {
      console.error('[sendPasswordResetEmail] Failed to send reset email via Brevo:', err);
    }
  }

  // 2. Try Resend HTTP API
  if (resend) {
    try {
      const fromEmail = process.env.RESEND_FROM_EMAIL || 'HabitUp <onboarding@resend.dev>';
      const result = await resend.emails.send({
        from: fromEmail,
        to: toEmail,
        subject,
        text,
      });

      if (result.error) {
        console.error('[sendPasswordResetEmail] Resend error:', result.error);
      } else {
        console.log('[sendPasswordResetEmail] Email dispatched via Resend to:', toEmail, result.data?.id || result);
        return;
      }
    } catch (err) {
      console.error('[sendPasswordResetEmail] Failed to send reset email via Resend:', err);
    }
  }

  // 3. Fallback: Try Gmail SMTP (Local dev only)
  if (gmailTransporter) {
    try {
      const result = await gmailTransporter.sendMail({
        from: process.env.GMAIL_USER,
        to: toEmail,
        subject,
        text,
      });
      console.log('[sendPasswordResetEmail] Email dispatched via Gmail SMTP to:', toEmail, result.messageId);
      return;
    } catch (err) {
      console.error('[sendPasswordResetEmail] Failed to send reset email via Gmail SMTP:', err);
    }
  }

  console.warn('[sendPasswordResetEmail] No email provider configured or all providers failed.');
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
     RETURNING id, name, email, role, timezone, created_at`,
    [name, email, password_hash, timezone]
  );
  const user = rows[0];

  try {
    const { logActivity } = require('./activityService');
    logActivity(user.id, 'REGISTER', {}).catch((err) =>
      console.error('[authService] Failed to log REGISTER:', err)
    );
  } catch (err) {
    console.error('[authService] logActivity require failed:', err);
  }

  return user;
}

/**
 * Find a user by email, including the password_hash for verification.
 * @param {string} email
 * @returns {Promise<object|null>}
 */
async function findUserByEmail(email) {
  const { rows } = await pool.query(
    `SELECT id, name, email, role, password_hash, timezone, created_at
     FROM users
     WHERE email = $1 AND deleted_at IS NULL`,
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
    `SELECT id, name, email, role, timezone, created_at
     FROM users
     WHERE id = $1 AND deleted_at IS NULL`,
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
 * @returns {Promise<string|null>} Returns userId if user exists, or null.
 */
async function createPasswordResetToken(email) {
  const user = await findUserByEmail(email);
  if (!user) {
    return null;
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
  return user.id;
}

async function updateSessionLastUsedAt(sessionId, userId) {
  const { rowCount } = await pool.query(
    `UPDATE sessions SET last_used_at = NOW()
     WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL AND expires_at > NOW()`,
    [sessionId, userId]
  );
  return rowCount > 0;
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

  try {
    const { logActivity } = require('./activityService');
    await logActivity(matchedToken.user_id, 'PASSWORD_RESET_COMPLETED', {});
  } catch (err) {
    console.error('[authService] Failed to log PASSWORD_RESET_COMPLETED:', err);
  }

  return true;
}

/**
 * Deletes a user account after re-verifying password.
 * Soft-deletes the user, scrambles/anonymizes email to free the unique constraint,
 * and revokes all active sessions.
 *
 * @param {string} userId
 * @param {string} password
 * @returns {Promise<boolean>} True on success, false if password doesn't match or user not found.
 */
async function deleteUserAccount(userId, password) {
  const { rows } = await pool.query(
    `SELECT id, email, password_hash
     FROM users
     WHERE id = $1 AND deleted_at IS NULL`,
    [userId]
  );

  const user = rows[0];
  if (!user) {
    return false;
  }

  const valid = await argon2.verify(user.password_hash, password);
  if (!valid) {
    return false;
  }

  try {
    const { logActivity } = require('./activityService');
    await logActivity(userId, 'ACCOUNT_DELETED', {});
  } catch (err) {
    console.error('[authService] Failed to log ACCOUNT_DELETED:', err);
  }

  const anonymizedEmail = `${user.email}_deleted_${Date.now()}`;

  await pool.query(
    `UPDATE users
     SET deleted_at = NOW(),
         email = $1,
         updated_at = NOW()
     WHERE id = $2`,
    [anonymizedEmail, userId]
  );

  await revokeAllSessionsForUser(userId);

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
  deleteUserAccount,
  updateSessionLastUsedAt,
};