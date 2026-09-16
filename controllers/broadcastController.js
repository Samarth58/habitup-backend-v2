const { pool } = require('../services/db');
const {
  sendTopicPushNotification,
  isFirebaseConfigured,
} = require('../services/notificationService');

const ALL_USERS_TOPIC = 'all-users';
const MAX_TITLE_LENGTH = 120;
const MAX_BODY_LENGTH = 1000;
const CATEGORIES = new Set([
  'motivation',
  'encouragement',
  'habit_tip',
  'streak',
  'goal',
  'progress',
  'comeback',
  'challenge',
  'announcement',
]);

function validateText(value, field, maxLength) {
  if (typeof value !== 'string' || !value.trim()) {
    return `${field} is required and must be a non-empty string.`;
  }
  if (value.trim().length > maxLength) {
    return `${field} must be ${maxLength} characters or fewer.`;
  }
  return null;
}

async function sendBroadcast(req, res) {
  const { title, body, category } = req.body || {};
  const titleError = validateText(title, 'title', MAX_TITLE_LENGTH);
  if (titleError) return res.status(400).json({ error: titleError });

  const bodyError = validateText(body, 'body', MAX_BODY_LENGTH);
  if (bodyError) return res.status(400).json({ error: bodyError });

  if (category !== undefined && (!CATEGORIES.has(category) || typeof category !== 'string')) {
    return res.status(400).json({ error: 'category is invalid.' });
  }

  if (!isFirebaseConfigured()) {
    return res.status(503).json({ error: 'Firebase Admin SDK is not configured.' });
  }

  const slotKey = `manual_${Date.now()}`;
  const today = new Date().toISOString().slice(0, 10);

  try {
    const result = await sendTopicPushNotification(ALL_USERS_TOPIC, {
      title: title.trim(),
      body: body.trim(),
      data: {
        type: 'engagement_broadcast',
        audience: ALL_USERS_TOPIC,
        ...(category ? { category } : {}),
      },
    });

    try {
      await pool.query(
        `INSERT INTO broadcast_deliveries (slot_key, broadcast_date, title, body, category, status, message_id, sent_at)
         VALUES ($1, $2, $3, $4, $5, 'sent', $6, NOW())`,
        [slotKey, today, title.trim(), body.trim(), category || 'announcement', result.messageId]
      );
    } catch (dbErr) {
      console.warn('[sendBroadcast] Could not log to broadcast_deliveries:', dbErr.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Broadcast notification sent successfully',
      topic: ALL_USERS_TOPIC,
      category: category || null,
      messageId: result.messageId,
    });
  } catch (error) {
    console.error('[sendBroadcast] Failed to send broadcast:', error.code || error.message);

    try {
      await pool.query(
        `INSERT INTO broadcast_deliveries (slot_key, broadcast_date, title, body, category, status, error_message, sent_at)
         VALUES ($1, $2, $3, $4, $5, 'failed', $6, NOW())`,
        [slotKey, today, title.trim(), body.trim(), category || 'announcement', error.message || 'FCM delivery failed']
      );
    } catch (dbErr) {
      console.warn('[sendBroadcast] Could not log failure to broadcast_deliveries:', dbErr.message);
    }

    return res.status(502).json({ error: 'Failed to send broadcast notification.' });
  }
}

module.exports = {
  sendBroadcast,
  ALL_USERS_TOPIC,
  CATEGORIES,
};