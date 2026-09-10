const { upsertDeviceToken, findDeviceTokenByUser } = require('../services/deviceTokenService');
const { sendPushNotification, isFirebaseConfigured } = require('../services/notificationService');

const ALLOWED_PLATFORMS = ['android', 'ios'];

/**
 * Validates whether a given string is a valid IANA timezone name.
 *
 * @param {string} tz
 * @returns {boolean}
 */
function isValidIanaTimezone(tz) {
  if (typeof tz !== 'string' || !tz.trim()) {
    return false;
  }
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz.trim() });
    return true;
  } catch {
    return false;
  }
}

/**
 * POST /notifications/device-token
 *
 * Registers or updates an FCM device token for the authenticated user.
 * Expects JSON body: { token, platform, timezone? }
 *
 * Authenticated user ID is obtained exclusively from req.userId.
 */
async function registerDeviceToken(req, res) {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  const { token, platform, timezone } = req.body || {};

  // Validate token
  if (!token || typeof token !== 'string' || !token.trim()) {
    return res.status(400).json({ error: 'token is required and must be a non-empty string.' });
  }

  // Validate platform
  if (!platform || typeof platform !== 'string') {
    return res.status(400).json({ error: "platform is required and must be 'android' or 'ios'." });
  }

  const normalizedPlatform = platform.trim().toLowerCase();
  if (!ALLOWED_PLATFORMS.includes(normalizedPlatform)) {
    return res.status(400).json({ error: "platform must be 'android' or 'ios'." });
  }

  // Validate timezone
  let resolvedTimezone = 'UTC';
  if (timezone !== undefined && timezone !== null) {
    if (typeof timezone !== 'string' || !isValidIanaTimezone(timezone)) {
      return res.status(400).json({ error: 'Invalid IANA timezone identifier.' });
    }
    resolvedTimezone = timezone.trim();
  }

  try {
    await upsertDeviceToken(userId, {
      token: token.trim(),
      platform: normalizedPlatform,
      timezone: resolvedTimezone,
    });

    return res.status(200).json({
      success: true,
      message: 'Device token registered successfully',
    });
  } catch (err) {
    console.error('[registerDeviceToken] Failed to register device token:', err.message);
    return res.status(500).json({ error: 'Failed to register device token.' });
  }
}

/**
 * POST /notifications/test
 *
 * Authenticated development test endpoint to send a test FCM push notification.
 * Verifies that the provided token belongs to the authenticated user.
 * Expects JSON body: { token }
 */
async function sendTestNotification(req, res) {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  const { token } = req.body || {};

  if (!token || typeof token !== 'string' || !token.trim()) {
    return res.status(400).json({ error: 'token is required and must be a non-empty string.' });
  }

  const trimmedToken = token.trim();

  try {
    // Verify token belongs to the authenticated user
    const existingToken = await findDeviceTokenByUser(userId, trimmedToken);
    if (!existingToken) {
      return res.status(404).json({
        error: 'Device token not found or not registered to your account.',
      });
    }

    // Check Firebase configuration
    if (!isFirebaseConfigured()) {
      return res.status(503).json({
        error: 'Firebase Admin SDK is not configured. Missing required environment variables.',
      });
    }

    // Send test notification with fixed safe payload
    const result = await sendPushNotification(trimmedToken, {
      title: 'HabitUp Test',
      body: 'FCM push notification is working!',
    });

    return res.status(200).json({
      success: true,
      message: 'Test notification sent successfully',
      messageId: result.messageId,
    });
  } catch (err) {
    console.error('[sendTestNotification] Error sending test notification:', err.code || err.message);

    // Map common Firebase errors to appropriate HTTP responses
    if (
      err.code === 'messaging/invalid-registration-token' ||
      err.code === 'messaging/registration-token-not-registered' ||
      err.code === 'messaging/invalid-argument'
    ) {
      return res.status(400).json({
        error: 'Invalid or unregistered FCM device token.',
      });
    }

    if (err.message && err.message.includes('Firebase Admin SDK is not configured')) {
      return res.status(503).json({
        error: 'Firebase Admin SDK is not configured.',
      });
    }

    return res.status(500).json({
      error: 'Failed to send test push notification.',
    });
  }
}

module.exports = {
  registerDeviceToken,
  sendTestNotification,
  isValidIanaTimezone,
};
