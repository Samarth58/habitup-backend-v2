const { Router } = require('express');
const { registerDeviceToken } = require('../controllers/notificationController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = Router();

// Protect all notification routes with auth middleware
router.use(requireAuth);

/**
 * @swagger
 * /notifications/device-token:
 *   post:
 *     tags: [Notifications]
 *     summary: Register or update an FCM device token
 *     description: Associates an FCM device token with the currently authenticated user. If the token is already registered, its metadata and user association are updated idempotently.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, platform]
 *             properties:
 *               token:
 *                 type: string
 *                 description: Firebase Cloud Messaging device registration token
 *                 example: 'fMeL4x9Q...z8Y1'
 *               platform:
 *                 type: string
 *                 enum: [android, ios]
 *                 description: Device operating system platform
 *                 example: 'android'
 *               timezone:
 *                 type: string
 *                 description: Valid IANA timezone identifier (optional, defaults to UTC)
 *                 example: 'Asia/Kolkata'
 *     responses:
 *       200:
 *         description: Device token registered or updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 'Device token registered successfully'
 *       400:
 *         description: Missing or invalid token, platform, or timezone
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401:
 *         description: Unauthorized or missing/invalid access token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/device-token', registerDeviceToken);

module.exports = router;
