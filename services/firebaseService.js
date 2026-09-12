const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');

/**
 * Checks if all required Firebase Admin SDK environment variables are present and non-empty.
 *
 * @returns {boolean} True if configured, false otherwise.
 */
function isFirebaseConfigured() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  return Boolean(
    projectId && projectId.trim() &&
    clientEmail && clientEmail.trim() &&
    privateKey && privateKey.trim()
  );
}

/**
 * Lazily initializes and returns the default Firebase Admin App instance.
 * Replaces escaped '\n' in FIREBASE_PRIVATE_KEY with actual newlines.
 *
 * Throws a safe descriptive error if configuration environment variables are missing.
 * Never logs or exposes the private key.
 *
 * @returns {import('firebase-admin/app').App}
 */
function getFirebaseAdminApp() {
  if (!isFirebaseConfigured()) {
    throw new Error(
      'Firebase Admin SDK is not configured. Missing required environment variables (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY).'
    );
  }

  const apps = getApps();
  if (apps.length > 0) {
    return apps[0];
  }

  const projectId = process.env.FIREBASE_PROJECT_ID.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL.trim();
  const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY.trim();
  // Handle single/double quotes if wrapped, and replace escaped newlines
  const unquotedPrivateKey = rawPrivateKey.replace(/^["']|["']$/g, '');
  const privateKey = unquotedPrivateKey.replace(/\\n/g, '\n');

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

/**
 * Returns the Firebase Cloud Messaging service instance.
 *
 * @returns {import('firebase-admin/messaging').Messaging}
 */
function getFirebaseMessaging() {
  const app = getFirebaseAdminApp();
  return getMessaging(app);
}

/**
 * Subscribes a single FCM device token to an FCM topic.
 * Safely repeatable — subscribing an already-subscribed token is a no-op.
 *
 * @param {string} token - FCM registration token
 * @param {string} topic - FCM topic name (e.g. 'all-users')
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
async function subscribeTokenToTopic(token, topic) {
  const messaging = getFirebaseMessaging();
  try {
    const response = await messaging.subscribeToTopic([token], topic);

    if (response.failureCount > 0) {
      const errorInfo = response.errors && response.errors[0];
      const errorCode = errorInfo && errorInfo.error && errorInfo.error.code;
      console.error(
        `[subscribeTokenToTopic] Failed to subscribe token to topic "${topic}":`,
        errorCode || (errorInfo && errorInfo.error && errorInfo.error.message) || 'unknown error'
      );
      return { success: false, error: errorCode };
    }

    return { success: true };
  } catch (err) {
    console.error(
      `[subscribeTokenToTopic] Error subscribing token to topic "${topic}":`,
      err.code || err.message
    );
    throw err;
  }
}

module.exports = {
  isFirebaseConfigured,
  getFirebaseAdminApp,
  getFirebaseMessaging,
  subscribeTokenToTopic,
};
