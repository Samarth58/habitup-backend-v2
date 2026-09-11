const { upsertDeviceToken, findDeviceTokenByUser } = require('../services/deviceTokenService');
const { sendPushNotification, isFirebaseConfigured } = require('../services/notificationService');
const {
  getNotificationPreferences,
  updateNotificationPreferences,
} = require('../services/notificationPreferenceService');

const ALLOWED_PLATFORMS = ['android', 'ios'];
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

/**
 * Validates whether a given string is a valid IANA timezone identifier.
 * Accepts IANA area/location names (e.g. 'Asia/Kolkata', 'America/New_York') and 'UTC' / 'GMT'.
 * Rejects abbreviations (e.g. 'IST', 'EST') and fixed offsets (e.g. '+05:30', 'UTC+05:30').
 *
 * @param {string} tz
 * @returns {boolean}
 */
function isValidIanaTimezone(tz) {
  if (typeof tz !== 'string' || !tz.trim()) {
    return false;
  }
  const trimmed = tz.trim();

  // Reject fixed offsets (e.g. +05:30, -04:00, +0530, UTC+05:30, GMT+5:30)
  if (/^[+-]\d/.test(trimmed) || /^(?:UTC|GMT)[+-]/i.test(trimmed)) {
    return false;
  }

  // Valid IANA names must be UTC, GMT, or contain a slash (e.g. Continent/City)
  if (trimmed.toUpperCase() !== 'UTC' && trimmed.toUpperCase() !== 'GMT' && !trimmed.includes('/')) {
    return false;
  }

  try {
    Intl.DateTimeFormat(undefined, { timeZone: trimmed });
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

/**
 * GET /notifications/preferences
 *
 * Retrieves the authenticated user's notification preferences.
 * If the user does not have a preferences row yet, creates/returns sensible defaults.
 */
async function getPreferences(req, res) {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  try {
    const preferences = await getNotificationPreferences(userId);
    return res.status(200).json({
      preferences,
      ...preferences,
    });
  } catch (err) {
    console.error('[getPreferences] Failed to fetch notification preferences:', err);
    return res.status(500).json({ error: 'Failed to fetch notification preferences.' });
  }
}

/**
 * PUT /notifications/preferences
 *
 * Updates notification preferences for the authenticated user.
 * Supports full or partial updates, strictly validates booleans, 24-hour times, and IANA timezone.
 */
async function updatePreferences(req, res) {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  const body = req.body || {};
  const updates = {};

  // Extract boolean fields (supporting both camelCase and snake_case)
  const booleanFields = [
    { camel: 'pushEnabled', snake: 'push_enabled' },
    { camel: 'morningEnabled', snake: 'morning_enabled' },
    { camel: 'afternoonEnabled', snake: 'afternoon_enabled' },
    { camel: 'eveningEnabled', snake: 'evening_enabled' },
  ];

  for (const { camel, snake } of booleanFields) {
    const val = body[camel] !== undefined ? body[camel] : body[snake];
    if (val !== undefined) {
      if (typeof val !== 'boolean') {
        return res.status(400).json({ error: `${camel} must be a boolean.` });
      }
      updates[snake] = val;
    }
  }

  // Extract time fields (supporting both camelCase and snake_case)
  const timeFields = [
    { camel: 'morningTime', snake: 'morning_time' },
    { camel: 'afternoonTime', snake: 'afternoon_time' },
    { camel: 'eveningTime', snake: 'evening_time' },
  ];

  for (const { camel, snake } of timeFields) {
    const val = body[camel] !== undefined ? body[camel] : body[snake];
    if (val !== undefined) {
      if (typeof val !== 'string' || !TIME_REGEX.test(val.trim())) {
        return res.status(400).json({
          error: `${camel} must be a valid 24-hour time in HH:mm format (e.g. '08:00', '13:00', '20:00').`,
        });
      }
      updates[snake] = val.trim();
    }
  }

  // Extract timezone field
  if (body.timezone !== undefined) {
    if (typeof body.timezone !== 'string' || !body.timezone.trim()) {
      return res.status(400).json({
        error: 'timezone must be a non-empty string representing a valid IANA timezone identifier.',
      });
    }
    const trimmedTimezone = body.timezone.trim();
    if (!isValidIanaTimezone(trimmedTimezone)) {
      return res.status(400).json({
        error: 'Invalid IANA timezone identifier. Examples: Asia/Kolkata, America/New_York, Europe/London, UTC.',
      });
    }
    updates.timezone = trimmedTimezone;
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({
      error: 'At least one preference field must be provided to update.',
    });
  }

  try {
    const preferences = await updateNotificationPreferences(userId, updates);
    return res.status(200).json({
      preferences,
      ...preferences,
    });
  } catch (err) {
    console.error('[updatePreferences] Failed to update notification preferences:', err);
    return res.status(500).json({ error: 'Failed to update notification preferences.' });
  }
}

module.exports = {
  registerDeviceToken,
  sendTestNotification,
  getPreferences,
  updatePreferences,
  isValidIanaTimezone,
};
