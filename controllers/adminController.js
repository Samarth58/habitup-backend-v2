const { pool } = require('../services/db');
const { getDeviceTokensByUserId, deleteDeviceToken } = require('../services/deviceTokenService');
const { sendPushNotification, isFirebaseConfigured } = require('../services/notificationService');

const {
  getDashboardStats,
  getUsersList,
  getUserDetail: getUserDetailService,
  getUsageAnalytics: getUsageAnalyticsService,
  parsePeriod,
} = require('../services/adminService');

const {
  getActivityFeed,
  getActivityAggregates,
} = require('../services/activityService');

const {
  getExperimentAnalytics,
} = require('../services/experimentAnalyticsService');

const {
  listExperiments,
} = require('../services/experimentService');

/**
 * GET /admin/dashboard
 * Query params: ?period=7d|30d|90d|365d (default: 7d)
 */
async function getDashboard(req, res) {
  const period = req.query.period || '7d';

  try {
    const stats = await getDashboardStats({ period });
    return res.json(stats);
  } catch (err) {
    console.error('[getDashboard]', err);
    return res.status(500).json({ error: 'Failed to fetch dashboard metrics.' });
  }
}

/**
 * GET /admin/users
 * Query params: ?page=1&limit=20&email=...&role=...&status=...&sort=created_at&order=desc
 */
async function listUsers(req, res) {
  const { page, limit, email, role, status, sort, order } = req.query;

  try {
    const result = await getUsersList({
      page,
      limit,
      email,
      role,
      status,
      sort,
      order,
    });
    return res.json(result);
  } catch (err) {
    console.error('[listUsers]', err);
    return res.status(500).json({ error: 'Failed to fetch users list.' });
  }
}

/**
 * GET /admin/users/:userId
 */
async function getUserDetail(req, res) {
  const userId = req.params.userId;

  try {
    const result = await getUserDetailService(userId);
    if (!result) {
      return res.status(404).json({ error: 'User not found.' });
    }
    return res.json(result);
  } catch (err) {
    console.error('[getUserDetail]', err);
    return res.status(500).json({ error: 'Failed to fetch user details.' });
  }
}

/**
 * GET /admin/activity
 * Query params: ?userId=...&activityType=...&from=...&to=...&page=1&limit=50
 */
async function getActivity(req, res) {
  const { userId, activityType, from, to, page, limit } = req.query;

  try {
    const feed = await getActivityFeed({
      userId,
      activityType,
      from,
      to,
      page,
      limit,
    });
    return res.json(feed);
  } catch (err) {
    console.error('[getActivity]', err);
    return res.status(500).json({ error: 'Failed to fetch activity feed.' });
  }
}

/**
 * GET /admin/analytics/usage
 * Query params: ?period=7d|30d|90d|365d or ?from=ISO&to=ISO
 */
async function getUsageAnalytics(req, res) {
  const { period, from, to } = req.query;

  try {
    const analytics = await getUsageAnalyticsService({ period, from, to });
    return res.json(analytics);
  } catch (err) {
    console.error('[getUsageAnalytics]', err);
    return res.status(500).json({ error: 'Failed to fetch usage analytics.' });
  }
}

/**
 * GET /admin/analytics/activity
 * Query params: ?period=7d|30d|90d|365d or ?from=ISO&to=ISO
 */
async function getActivityAnalytics(req, res) {
  const { period, from: customFrom, to: customTo } = req.query;

  try {
    let from, to;
    if (customFrom && customTo) {
      from = customFrom;
      to = customTo;
    } else {
      const parsed = parsePeriod(period || '7d');
      from = parsed.from;
      to = parsed.to;
    }

    const analytics = await getActivityAggregates(from, to);
    return res.json(analytics);
  } catch (err) {
    console.error('[getActivityAnalytics]', err);
    return res.status(500).json({ error: 'Failed to fetch activity analytics.' });
  }
}

/**
 * GET /admin/experiments
 * Lists all experiments with basic statistics.
 */
async function listAllExperiments(req, res) {
  try {
    const experiments = await listExperiments();
    return res.json({ experiments });
  } catch (err) {
    console.error('[listAllExperiments]', err);
    return res.status(500).json({ error: 'Failed to list experiments.' });
  }
}

/**
 * GET /admin/experiments/:name
 * Returns full statistical analytics for a named experiment.
 */
async function getExperimentReport(req, res) {
  const { name } = req.params;

  try {
    const report = await getExperimentAnalytics(name);
    return res.json(report);
  } catch (err) {
    if (err.message && err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    console.error('[getExperimentReport]', err);
    return res.status(500).json({ error: 'Failed to fetch experiment analytics.' });
  }
}

/**
 * GET /admin/notifications
 * Returns real notification deliveries & broadcast history from database with summary stats.
 */
async function getNotifications(req, res) {
  const { page = 1, limit = 50 } = req.query;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const offset = (pageNum - 1) * limitNum;

  try {
    const statsQuery = `
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'sent' OR status = 'delivered') as sent,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COUNT(*) FILTER (WHERE status = 'processing' OR status = 'queued' OR status = 'pending') as pending
      FROM (
        SELECT status FROM broadcast_deliveries
        UNION ALL
        SELECT status FROM notification_deliveries
      ) combined_deliveries;
    `;
    const statsRes = await pool.query(statsQuery);
    const row = statsRes.rows[0] || {};
    const stats = {
      total: parseInt(row.total || 0, 10),
      sent: parseInt(row.sent || 0, 10),
      failed: parseInt(row.failed || 0, 10),
      pending: parseInt(row.pending || 0, 10),
    };

    const listQuery = `
      WITH combined AS (
        SELECT 
          id,
          title,
          body as message,
          COALESCE(category, 'Announcement') as type,
          'All Users' as recipient,
          'all' as "recipientType",
          CASE 
            WHEN status = 'sent' OR status = 'delivered' THEN 'Sent'
            WHEN status = 'failed' THEN 'Failed'
            ELSE 'Pending'
          END as status,
          error_message as "errorReason",
          COALESCE(sent_at, created_at) as timestamp,
          created_at
        FROM broadcast_deliveries

        UNION ALL

        SELECT 
          nd.id,
          CASE 
            WHEN nd.notification_type LIKE 'admin_%' THEN 'Admin Direct Message'
            ELSE nd.notification_type
          END as title,
          CASE 
            WHEN nd.notification_type LIKE 'admin_%' THEN 'Direct push notification sent to user device'
            ELSE CONCAT('Scheduled local reminder for ', nd.scheduled_local_time, ' (', nd.timezone, ')')
          END as message,
          CASE 
            WHEN nd.notification_type LIKE 'admin_%' THEN 'Direct Message'
            ELSE nd.notification_type
          END as type,
          COALESCE(u.name, u.email, 'User') as recipient,
          'single' as "recipientType",
          CASE 
            WHEN nd.status = 'sent' OR nd.status = 'delivered' THEN 'Sent'
            WHEN nd.status = 'failed' THEN 'Failed'
            WHEN nd.status = 'skipped_no_token' THEN 'Skipped'
            ELSE 'Pending'
          END as status,
          nd.error_message as "errorReason",
          COALESCE(nd.sent_at, nd.created_at) as timestamp,
          nd.created_at
        FROM notification_deliveries nd
        LEFT JOIN users u ON u.id = nd.user_id
      )
      SELECT * FROM combined
      ORDER BY timestamp DESC
      LIMIT $1 OFFSET $2;
    `;
    const listRes = await pool.query(listQuery, [limitNum, offset]);

    return res.json({
      notifications: listRes.rows.map((item) => ({
        ...item,
        sentAt: item.timestamp
          ? new Date(item.timestamp).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            })
          : 'Just now',
      })),
      stats,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: stats.total,
        totalPages: Math.max(1, Math.ceil(stats.total / limitNum)),
      },
    });
  } catch (err) {
    console.error('[getNotifications]', err);
    return res.status(500).json({ error: 'Failed to fetch notifications.' });
  }
}

/**
 * GET /admin/users/search
 * Fast, lightweight user search returning safe identifying fields for admin selectors.
 */
async function searchUsers(req, res) {
  const { q = '', limit = 20 } = req.query;
  const safeLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const query = (q || '').trim();

  try {
    let sql = `
      SELECT id, name, email, username, role, created_at
      FROM users
      WHERE deleted_at IS NULL
    `;
    const params = [];

    if (query) {
      params.push(`%${query}%`);
      sql += ` AND (email ILIKE $1 OR username ILIKE $1 OR name ILIKE $1)`;
    }

    params.push(safeLimit);
    sql += ` ORDER BY created_at DESC LIMIT $${params.length};`;

    const { rows } = await pool.query(sql, params);
    return res.json({ users: rows });
  } catch (err) {
    console.error('[searchUsers]', err);
    return res.status(500).json({ error: 'Failed to search users.' });
  }
}

/**
 * POST /admin/notifications/user/:userId
 * Sends an admin push notification to all active device tokens belonging to a specific user.
 */
async function sendUserNotification(req, res) {
  const { userId } = req.params;
  const { title, message, body, type, category } = req.body || {};

  const cleanTitle = (title || '').trim();
  const cleanBody = (message || body || '').trim();

  if (!cleanTitle) {
    return res.status(400).json({ error: 'title is required and must be a non-empty string.' });
  }
  if (cleanTitle.length > 120) {
    return res.status(400).json({ error: 'title must be 120 characters or fewer.' });
  }

  if (!cleanBody) {
    return res.status(400).json({ error: 'message is required and must be a non-empty string.' });
  }
  if (cleanBody.length > 1000) {
    return res.status(400).json({ error: 'message must be 1000 characters or fewer.' });
  }

  try {
    // 1. Verify user exists and is active
    const userRes = await pool.query(
      'SELECT id, name, email, timezone FROM users WHERE id = $1 AND deleted_at IS NULL',
      [userId]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const targetUser = userRes.rows[0];

    // 2. Query user's active device tokens
    const deviceTokens = await getDeviceTokensByUserId(userId);

    const today = new Date().toISOString().slice(0, 10);
    const timeStr = new Date().toTimeString().slice(0, 5);
    const notifType = `admin_${Date.now().toString().slice(-8)}`;

    if (!deviceTokens || deviceTokens.length === 0) {
      // Log skipped delivery to notification_deliveries
      try {
        await pool.query(
          `INSERT INTO notification_deliveries
           (user_id, notification_type, scheduled_local_date, scheduled_local_time, timezone, status, device_count, error_message, created_at)
           VALUES ($1, $2, $3, $4, $5, 'skipped_no_token', 0, 'User has no registered active device tokens', NOW())`,
          [userId, notifType, today, timeStr, targetUser.timezone || 'UTC']
        );
      } catch (dbErr) {
        console.warn('[sendUserNotification] db log skipped error:', dbErr.message);
      }

      return res.status(400).json({
        success: false,
        noToken: true,
        error: 'User has no registered active device tokens',
      });
    }

    // 3. Verify Firebase configuration
    if (!isFirebaseConfigured()) {
      return res.status(503).json({ error: 'Firebase Admin SDK is not configured.' });
    }

    // 4. Dispatch notification to all user's registered device tokens
    let successCount = 0;
    const messageIds = [];
    const errors = [];

    for (const dt of deviceTokens) {
      try {
        const result = await sendPushNotification(dt.token, {
          title: cleanTitle,
          body: cleanBody,
          data: {
            type: type || category || 'admin_direct',
            recipient_id: String(userId),
            ...(category ? { category } : {}),
          },
        });
        successCount++;
        messageIds.push(result.messageId);
      } catch (err) {
        errors.push(err.message || 'FCM delivery failed');
        if (
          err.code === 'messaging/registration-token-not-registered' ||
          err.code === 'messaging/invalid-registration-token' ||
          err.code === 'messaging/invalid-argument' ||
          (err.message && (
            err.message.includes('not a valid FCM registration token') ||
            err.message.includes('NotRegistered') ||
            err.message.includes('SenderId mismatch') ||
            err.message.includes('not registered')
          ))
        ) {
          await deleteDeviceToken(dt.token).catch(() => {});
        }
      }
    }

    const isSuccess = successCount > 0;
    const status = isSuccess ? 'sent' : 'failed';
    const errorMsg = errors.length > 0 ? errors.join('; ') : null;

    // 5. Log delivery into notification_deliveries
    try {
      await pool.query(
        `INSERT INTO notification_deliveries
         (user_id, notification_type, scheduled_local_date, scheduled_local_time, timezone, status, device_count, sent_at, error_message, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
        [
          userId,
          notifType,
          today,
          timeStr,
          targetUser.timezone || 'UTC',
          status,
          deviceTokens.length,
          isSuccess ? new Date() : null,
          errorMsg,
        ]
      );
    } catch (dbErr) {
      console.warn('[sendUserNotification] db log error:', dbErr.message);
    }

    if (!isSuccess) {
      return res.status(502).json({
        error: errorMsg || 'Failed to send push notification to user device.',
      });
    }

    return res.status(200).json({
      success: true,
      message: `Notification sent successfully to ${targetUser.name || targetUser.email}.`,
      recipient: targetUser.name || targetUser.email,
      deviceCount: successCount,
      messageIds,
    });
  } catch (err) {
    console.error('[sendUserNotification]', err);
    return res.status(500).json({ error: 'Failed to send notification to user.' });
  }
}

module.exports = {
  getDashboard,
  listUsers,
  getUserDetail,
  getActivity,
  getUsageAnalytics,
  getActivityAnalytics,
  listAllExperiments,
  getExperimentReport,
  getNotifications,
  searchUsers,
  sendUserNotification,
};
