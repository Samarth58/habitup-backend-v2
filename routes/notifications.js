const { Router } = require('express');
const {
  registerDeviceToken,
  sendTestNotification,
  getPreferences,
  updatePreferences,
} = require('../controllers/notificationController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = Router();

// Protect all notification routes with auth middleware
router.use(requireAuth);

/**
 * @swagger
 * /notifications/preferences:
 *   get:
 *     tags: [Notifications]
 *     summary: Get user notification preferences
 *     description: Returns the notification preferences for the authenticated user. If the user does not have preferences set, default preferences are created and returned.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Notification preferences retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 preferences:
 *                   $ref: '#/components/schemas/NotificationPreferences'
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
 *   put:
 *     tags: [Notifications]
 *     summary: Update user notification preferences
 *     description: Updates full or partial notification preferences for the authenticated user.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               pushEnabled:
 *                 type: boolean
 *                 description: Enable or disable all push notifications
 *                 example: true
 *               morningEnabled:
 *                 type: boolean
 *                 description: Enable or disable morning reminder notifications
 *                 example: true
 *               afternoonEnabled:
 *                 type: boolean
 *                 description: Enable or disable afternoon reminder notifications
 *                 example: false
 *               eveningEnabled:
 *                 type: boolean
 *                 description: Enable or disable evening reminder notifications
 *                 example: true
 *               morningTime:
 *                 type: string
 *                 description: Preferred morning reminder time in 24-hour HH:mm format
 *                 example: '08:00'
 *               afternoonTime:
 *                 type: string
 *                 description: Preferred afternoon reminder time in 24-hour HH:mm format
 *                 example: '13:00'
 *               eveningTime:
 *                 type: string
 *                 description: Preferred evening reminder time in 24-hour HH:mm format
 *                 example: '20:00'
 *               timezone:
 *                 type: string
 *                 description: Valid IANA timezone identifier (e.g. Asia/Kolkata, America/New_York, Europe/London, UTC)
 *                 example: 'Asia/Kolkata'
 *     responses:
 *       200:
 *         description: Notification preferences updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 preferences:
 *                   $ref: '#/components/schemas/NotificationPreferences'
 *       400:
 *         description: Invalid field types or invalid time format
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
router.get('/preferences', getPreferences);
router.put('/preferences', updatePreferences);

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

