const { Router } = require('express');
const { registerDeviceToken, sendTestNotification } = require('../controllers/notificationController');
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

/**
 * @swagger
 * /notifications/test:
 *   post:
 *     tags: [Notifications]
 *     summary: Send a test FCM push notification
 *     description: Sends a test push notification to a registered device token belonging to the authenticated user.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token:
 *                 type: string
 *                 description: Registered FCM device token
 *                 example: 'fMeL4x9Q...z8Y1'
 *     responses:
 *       200:
 *         description: Test notification dispatched successfully
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
 *                   example: 'Test notification sent successfully'
 *                 messageId:
 *                   type: string
 *                   example: 'projects/habitup-fcm/messages/1715629481234567'
 *       400:
 *         description: Missing token or invalid FCM registration token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401:
 *         description: Unauthorized or missing/invalid access token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Device token not found or not registered to the authenticated user
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       503:
 *         description: Firebase Admin SDK is not configured
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       500:
 *         description: Internal server error while dispatching notification
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/test', sendTestNotification);

module.exports = router;
