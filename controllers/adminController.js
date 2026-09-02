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

module.exports = {
  getDashboard,
  listUsers,
  getUserDetail,
  getActivity,
  getUsageAnalytics,
  getActivityAnalytics,
};
