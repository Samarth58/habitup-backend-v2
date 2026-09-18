const { pool } = require('./db');
const { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, isValidLanguage, normalizeLanguage } = require('../constants/languages');
const { getDeviceTokensByUserId } = require('./deviceTokenService');
const firebaseService = require('./firebaseService');

/**
 * Resolves a user's notification language preference.
 * Rules:
 * 1. Read the user's preferred_language.
 * 2. If it is a supported language, use it.
 * 3. If missing, use 'en'.
 * 4. If invalid, use 'en'.
 * 5. Never return an undefined language.
 *
 * @param {string} userId - User UUID
 * @returns {Promise<string>} Normalized 2-letter language code (e.g. 'en', 'kn', 'hi')
 */
async function getUserNotificationLanguage(userId) {
  if (!userId) return DEFAULT_LANGUAGE;

  try {
    const { rows } = await pool.query(
      `SELECT preferred_language FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [userId]
    );

    if (rows.length === 0 || !rows[0].preferred_language) {
      return DEFAULT_LANGUAGE;
    }

    return normalizeLanguage(rows[0].preferred_language);
  } catch (err) {
    console.error(`[getUserNotificationLanguage] Error fetching language for user ${userId}:`, err.message);
    return DEFAULT_LANGUAGE;
  }
}

/**
 * Gets a user's language preference object for API response.
 *
 * @param {string} userId - User UUID
 * @returns {Promise<{ language: string }>}
 */
async function getUserLanguagePreference(userId) {
  const language = await getUserNotificationLanguage(userId);
  return { language };
}

/**
 * Updates a user's preferred language and synchronizes their FCM broadcast topic subscriptions.
 *
 * @param {string} userId - User UUID
 * @param {string} rawLanguage - New language code to set
 * @returns {Promise<{ language: string }>}
 */
async function updateUserLanguage(userId, rawLanguage) {
  if (!rawLanguage || typeof rawLanguage !== 'string') {
    const err = new Error('Language is required');
    err.status = 400;
    err.supportedLanguages = SUPPORTED_LANGUAGES;
    throw err;
  }

  const cleanLang = rawLanguage.trim().toLowerCase();
  if (!isValidLanguage(cleanLang)) {
    const err = new Error('Unsupported language');
    err.status = 400;
    err.supportedLanguages = SUPPORTED_LANGUAGES;
    throw err;
  }

  // Fetch previous language to handle topic migration
  const oldLanguage = await getUserNotificationLanguage(userId);

  // Update users table
  const { rows } = await pool.query(
    `UPDATE users
     SET preferred_language = $1, updated_at = NOW()
     WHERE id = $2 AND deleted_at IS NULL
     RETURNING preferred_language`,
    [cleanLang, userId]
  );

  if (rows.length === 0) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  const newLanguage = normalizeLanguage(rows[0].preferred_language);

  // If language changed, migrate FCM device token subscriptions
  if (oldLanguage !== newLanguage && firebaseService.isFirebaseConfigured()) {
    try {
      const deviceTokens = await getDeviceTokensByUserId(userId);
      if (deviceTokens && deviceTokens.length > 0) {
        const oldTopic = `all-users-${oldLanguage}`;
        const newTopic = `all-users-${newLanguage}`;

        await Promise.allSettled(
          deviceTokens.map(async ({ token }) => {
            try {
              await firebaseService.unsubscribeTokenFromTopic(token, oldTopic);
            } catch (unsubErr) {
              console.warn(`[updateUserLanguage] Failed to unsubscribe token from ${oldTopic}:`, unsubErr.message);
            }
            try {
              await firebaseService.subscribeTokenToTopic(token, newTopic);
            } catch (subErr) {
              console.warn(`[updateUserLanguage] Failed to subscribe token to ${newTopic}:`, subErr.message);
            }
          })
        );
      }
    } catch (topicErr) {
      console.error(`[updateUserLanguage] Error updating topic subscriptions for user ${userId}:`, topicErr.message);
    }
  }

  return { language: newLanguage };
}

module.exports = {
  getUserNotificationLanguage,
  getUserLanguagePreference,
  updateUserLanguage,
};
