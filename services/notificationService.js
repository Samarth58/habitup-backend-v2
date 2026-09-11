const firebaseService = require('./firebaseService');

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

  const messaging = firebaseService.getFirebaseMessaging();

  const messagePayload = {
    token: token.trim(),
    notification: {
      title: title.trim(),
      body: body.trim(),
    },
    android: {
      priority: 'high',
      notification: {
        channelId: (data && data.channelId) || 'high_importance_channel',
        sound: 'default',
        priority: 'max',
        defaultSound: true,
        defaultVibrateTimings: true,
        visibility: 'public',
      },
    },
    apns: {
      payload: {
        aps: {
          sound: 'default',
          badge: 1,
          contentAvailable: true,
        },
      },
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

/**
 * Sends a push notification to an FCM topic.
 * This is intentionally separate from token delivery used by personalized notifications.
 */
async function sendTopicPushNotification(topic, { title, body, data }) {
  if (!topic || typeof topic !== 'string' || !topic.trim()) {
    throw new Error('Notification topic is required.');
  }

  if (!title || typeof title !== 'string' || !title.trim()) {
    throw new Error('Notification title is required.');
  }

  if (!body || typeof body !== 'string' || !body.trim()) {
    throw new Error('Notification body is required.');
  }

  const messaging = firebaseService.getFirebaseMessaging();
  const messagePayload = {
    topic: topic.trim(),
    notification: {
      title: title.trim(),
      body: body.trim(),
    },
    android: {
      priority: 'high',
      notification: {
        channelId: (data && data.channelId) || 'high_importance_channel',
        sound: 'default',
        priority: 'max',
        defaultSound: true,
        defaultVibrateTimings: true,
        visibility: 'public',
      },
    },
    apns: {
      payload: {
        aps: {
          sound: 'default',
          badge: 1,
          contentAvailable: true,
        },
      },
    },
  };

  if (data && typeof data === 'object') {
    messagePayload.data = Object.fromEntries(
      Object.entries(data).map(([key, val]) => [key, String(val)])
    );
  }

  try {
    const messageId = await messaging.send(messagePayload);
    return { success: true, messageId };
  } catch (err) {
    console.error('[sendTopicPushNotification] Firebase messaging error:', err.code || err.message);
    throw err;
  }
}

module.exports = {
  sendPushNotification,
  sendTopicPushNotification,
  isFirebaseConfigured: () => firebaseService.isFirebaseConfigured(),
};
