const { Router } = require('express');
const {
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
} = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');
const { authLimiter, passwordResetLimiter, heartbeatLimiter } = require('../middleware/rateLimiter');

const router = Router();

/**
 * @swagger
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user account
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, timezone]
 *             properties:
 *               name:     { type: string, example: Samarth }
 *               email:    { type: string, format: email, example: samarth@example.com }
 *               password: { type: string, example: mySecretPass123 }
 *               timezone: { type: string, example: Asia/Kolkata }
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken: { type: string }
 *                 user:        { $ref: '#/components/schemas/User' }
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       409:
 *         description: Email already in use
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/register', authLimiter, register);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Log in and obtain access + refresh tokens
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:    { type: string, format: email, example: samarth@example.com }
 *               password: { type: string, example: mySecretPass123 }
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:  { type: string }
 *                 refreshToken: { type: string }
 *                 user:         { $ref: '#/components/schemas/User' }
 *       400:
 *         description: Missing email or password
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/login', authLimiter, login);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Rotate a refresh token and obtain a new access + refresh token pair
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200:
 *         description: Tokens rotated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:  { type: string }
 *                 refreshToken: { type: string }
 *       400:
 *         description: refreshToken missing
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401:
 *         description: Invalid, expired, or already revoked token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/refresh', refresh);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Revoke the current session's refresh token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200:
 *         description: Logged out (always returned, even if token was already invalid)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: Logged out. }
 *       400:
 *         description: refreshToken missing
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/logout', logout);

/**
 * @swagger
 * /auth/logout-all:
 *   post:
 *     tags: [Auth]
 *     summary: Revoke ALL active sessions for the authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All sessions revoked
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: All sessions revoked. }
 *       401:
 *         description: Missing or invalid access token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/logout-all', requireAuth, logoutAll);

/**
 * @swagger
 * /auth/session/heartbeat:
 *   post:
 *     tags: [Auth]
 *     summary: Record activity for the authenticated refresh session
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200: { description: Session activity recorded }
 *       400: { description: Invalid or missing refresh token }
 *       404: { description: Session missing or revoked }
 */
router.post('/session/heartbeat', requireAuth, heartbeatLimiter, heartbeat);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get the authenticated user's profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user: { $ref: '#/components/schemas/User' }
 *       401:
 *         description: Missing or invalid access token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/me', requireAuth, getMe);

/**
 * @swagger
 * /auth/reset-password/request:
 *   post:
 *     tags: [Auth]
 *     summary: Request a password reset email
 *     description: >
 *       Sends a password reset token to the user's registered email via Gmail SMTP.
 *       Always returns a generic message regardless of whether the email exists,
 *       to prevent email enumeration. Token expires in 15 minutes.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email, example: samarth@example.com }
 *     responses:
 *       200:
 *         description: Generic success message (always returned)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: If that email exists, a password reset link has been sent. }
 *       400:
 *         description: email field missing
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/reset-password/request', passwordResetLimiter, requestPasswordReset);

/**
 * @swagger
 * /auth/reset-password/confirm:
 *   post:
 *     tags: [Auth]
 *     summary: Confirm a password reset using the emailed token
 *     description: >
 *       Verifies the token, sets the new password, marks the token as used,
 *       and revokes all active sessions for the user.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, newPassword]
 *             properties:
 *               token:       { type: string, example: a3f9...64-char-hex }
 *               newPassword: { type: string, example: myNewSecurePass456 }
 *     responses:
 *       200:
 *         description: Password reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: Password has been reset successfully. }
 *       400:
 *         description: Missing fields, or token is invalid, expired, or already used
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/reset-password/confirm', confirmPasswordReset);

/**
 * @swagger
 * /auth/account:
 *   delete:
 *     tags: [Auth]
 *     summary: Delete user account
 *     description: >
 *       Soft-deletes the authenticated user's account, anonymizes their email,
 *       and revokes all active sessions. Requires password confirmation.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               password: { type: string, example: mySecretPass123 }
 *     responses:
 *       200:
 *         description: Account deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: Account deleted successfully. }
 *       400:
 *         description: password field missing
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401:
 *         description: Missing/invalid token or incorrect password
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.delete('/account', requireAuth, deleteAccount);

/**
 * @swagger
 * /auth/session/heartbeat:
 *   post:
 *     tags: [Auth]
 *     summary: Send session activity heartbeat
 *     description: Updates last_used_at timestamp on the active session identified by the refresh token.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200:
 *         description: Heartbeat recorded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, example: true }
 *                 message: { type: string, example: Session heartbeat recorded. }
 *       400:
 *         description: refreshToken missing or invalid
 *       401:
 *         description: Missing/invalid access token
 *       404:
 *         description: Session not found or revoked
 */
router.post('/session/heartbeat', requireAuth, heartbeatLimiter, heartbeat);

module.exports = router;

