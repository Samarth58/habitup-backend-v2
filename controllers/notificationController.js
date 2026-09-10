const { upsertDeviceToken } = require('../services/deviceTokenService');

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

module.exports = {
  registerDeviceToken,
  isValidIanaTimezone,
};
