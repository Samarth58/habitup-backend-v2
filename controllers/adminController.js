const { pool } = require('../services/db');

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
          nd.notification_type as title,
          CONCAT('Scheduled local reminder for ', nd.scheduled_local_time, ' (', nd.timezone, ')') as message,
          nd.notification_type as type,
          COALESCE(u.name, u.email, 'User') as recipient,
          'single' as "recipientType",
          CASE 
            WHEN nd.status = 'sent' OR nd.status = 'delivered' THEN 'Sent'
            WHEN nd.status = 'failed' THEN 'Failed'
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
};
