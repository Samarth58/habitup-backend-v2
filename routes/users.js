const { Router } = require('express');
const {
  registerWithUsername,
  searchUsers,
  getUserProfile,
  getAuthUserProfile,
  getUserLanguage,
  updateUserLanguagePreference,
} = require('../controllers/usernameController');
const { requireAuth } = require('../middleware/authMiddleware');
const { searchLimiter, authLimiter } = require('../middleware/rateLimiter');

const router = Router();

/**
 * @swagger
 * /users/preferences/language:
 *   get:
 *     tags: [Users]
 *     summary: Get authenticated user's preferred language
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User's preferred language code
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 language:
 *                   type: string
 *                   enum: [en, hi, te, ta, kn, ml, bn, mr, gu]
 *                   example: en
 *       401:
 *         description: Unauthorized
 *   put:
 *     tags: [Users]
 *     summary: Update authenticated user's preferred language
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [language]
 *             properties:
 *               language:
 *                 type: string
 *                 enum: [en, hi, te, ta, kn, ml, bn, mr, gu]
 *                 example: kn
 *     responses:
 *       200:
 *         description: Preferred language updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 language:
 *                   type: string
 *                   example: kn
 *       400:
 *         description: Unsupported or missing language
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Unsupported language
 *                 supportedLanguages:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: [en, hi, te, ta, kn, ml, bn, mr, gu]
 *       401:
 *         description: Unauthorized
 */
router.get('/preferences/language', requireAuth, getUserLanguage);
router.put('/preferences/language', requireAuth, updateUserLanguagePreference);

/**
 * @swagger
 * /users/register:
 *   post:
 *     tags: [Users]
 *     summary: Register a new user with unique username handle
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, username, password]
 *             properties:
 *               name:     { type: string, example: John Doe }
 *               email:    { type: string, format: email, example: john@example.com }
 *               username: { type: string, example: john_doe }
 *               password: { type: string, example: mySecretPass123 }
 *               timezone: { type: string, example: UTC }
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:       { type: string, format: uuid }
 *                     email:    { type: string, format: email }
 *                     username: { type: string }
 *                 access_token:  { type: string }
 *                 refresh_token: { type: string }
 *       400:
 *         description: Validation error or missing fields
 *       409:
 *         description: Username or email already taken
 */
router.post('/register', authLimiter, registerWithUsername);

/**
 * @swagger
 * /users/search:
 *   get:
 *     tags: [Users]
 *     summary: Search users by username prefix
 *     parameters:
 *       - in: query
 *         name: query
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 3
 *         description: Username prefix to search (minimum 3 characters)
 *     responses:
 *       200:
 *         description: Matching users list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:       { type: string, format: uuid }
 *                       username: { type: string }
 *       400:
 *         description: Query too short (less than 3 characters)
 *       429:
 *         description: Rate limit exceeded
 */
router.get('/search', searchLimiter, searchUsers);

/**
 * @swagger
 * /users/profile:
 *   get:
 *     tags: [Users]
 *     summary: Get authenticated user's profile with username
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Authenticated user profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:         { type: string, format: uuid }
 *                     email:      { type: string, format: email }
 *                     username:   { type: string }
 *                     created_at: { type: string, format: date-time }
 *       401:
 *         description: Unauthorized
 */
router.get('/profile', requireAuth, getAuthUserProfile);

/**
 * @swagger
 * /users/@{username}:
 *   get:
 *     tags: [Users]
 *     summary: Get public user profile stats by username handle
 *     parameters:
 *       - in: path
 *         name: username
 *         required: true
 *         schema:
 *           type: string
 *         description: Username handle (with or without @ prefix)
 *     responses:
 *       200:
 *         description: Public user profile stats
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:             { type: string, format: uuid }
 *                 username:       { type: string }
 *                 total_habits:   { type: integer, example: 5 }
 *                 current_streak: { type: integer, example: 12 }
 *                 created_at:     { type: string, format: date-time }
 *       404:
 *         description: User not found
 */
router.get('/@:username', getUserProfile);
router.get('/username/:username', getUserProfile);

module.exports = router;
