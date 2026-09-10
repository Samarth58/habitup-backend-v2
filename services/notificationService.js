const { getFirebaseMessaging, isFirebaseConfigured } = require('./firebaseService');

/**
 * Sends a push notification to a single FCM device token using Firebase Cloud Messaging.
 *
 * @param {string} token - FCM registration token
 * @param {object} notificationData
 * @param {string} notificationData.title - Notification title
 * @param {string} notificationData.body - Notification body
 * @param {Record<string, string>} [notificationData.data] - Optional string key-value payload
 * @returns {Promise<{ success: boolean, messageId: string }>} Result containing the message ID
 */
async function sendPushNotification(token, { title, body, data }) {
  if (!token || typeof token !== 'string' || !token.trim()) {
    throw new Error('Device token is required to send push notification.');
  }

  if (!title || typeof title !== 'string' || !title.trim()) {
    throw new Error('Notification title is required.');
  }

  if (!body || typeof body !== 'string' || !body.trim()) {
    throw new Error('Notification body is required.');
  }

  const messaging = getFirebaseMessaging();

  const messagePayload = {
    token: token.trim(),
    notification: {
      title: title.trim(),
      body: body.trim(),
    },
  };

  if (data && typeof data === 'object') {
    messagePayload.data = Object.fromEntries(
      Object.entries(data).map(([key, val]) => [key, String(val)])
    );
  }

  try {
    const messageId = await messaging.send(messagePayload);
    return {
      success: true,
      messageId,
    };
  } catch (err) {
    // Log safe diagnostic info without exposing private keys or sensitive payloads
    console.error('[sendPushNotification] Firebase messaging error:', err.code || err.message);
    throw err;
  }
}

module.exports = {
  sendPushNotification,
  isFirebaseConfigured,
};
