const { Router } = require('express');
const {
  getDashboard,
  listUsers,
  getUserDetail,
  getActivity,
  getUsageAnalytics,
  getActivityAnalytics,
} = require('../controllers/adminController');
const { requireAuth } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/adminMiddleware');
const { validateUuid } = require('../middleware/validateUuid');

const router = Router();

// Protect all admin endpoints with both authentication and database-checked admin authorization
router.use(requireAuth, requireAdmin);

/**
 * @swagger
 * /admin/dashboard:
 *   get:
 *     tags: [Admin]
 *     summary: Retrieve aggregate metrics for the Admin Dashboard
 *     description: Returns high-level statistics for total/active/new/deleted users, habits, completions, reminders, and estimated usage time.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 365d]
 *           default: 7d
 *         description: Lookback period
 *     responses:
 *       200:
 *         description: Dashboard metrics
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AdminDashboard' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       403:
 *         description: Forbidden (Non-admin)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/dashboard', getDashboard);

/**
 * @swagger
 * /admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: List all user accounts with pagination, search, and filtering
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *       - in: query
 *         name: email
 *         schema: { type: string }
 *         description: Partial email search (case-insensitive)
 *       - in: query
 *         name: role
 *         schema: { type: string, enum: [user, admin] }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [active, deleted] }
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: [created_at, last_activity, email], default: created_at }
 *       - in: query
 *         name: order
 *         schema: { type: string, enum: [asc, desc], default: desc }
 *     responses:
 *       200:
 *         description: Paginated user list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 users:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/AdminUser' }
 *                 pagination: { $ref: '#/components/schemas/PaginationMeta' }
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/users', listUsers);

/**
 * @swagger
 * /admin/users/{userId}:
 *   get:
 *     tags: [Admin]
 *     summary: Get detailed administrative view of a specific user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: User administrative details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user: { $ref: '#/components/schemas/AdminUserDetail' }
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User not found
 */
router.get('/users/:userId', validateUuid('userId'), getUserDetail);

/**
 * @swagger
 * /admin/activity:
 *   get:
 *     tags: [Admin]
 *     summary: Retrieve paginated user activity events
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: activityType
 *         schema: { type: string }
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50, maximum: 200 }
 *     responses:
 *       200:
 *         description: Paginated activity feed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 events:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/ActivityEvent' }
 *                 pagination: { $ref: '#/components/schemas/PaginationMeta' }
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/activity', getActivity);

/**
 * @swagger
 * /admin/analytics/usage:
 *   get:
 *     tags: [Admin]
 *     summary: Get session and app usage analytics for charts
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema: { type: string, enum: [7d, 30d, 90d, 365d], default: 7d }
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Usage analytics
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/UsageAnalytics' }
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/analytics/usage', getUsageAnalytics);

/**
 * @swagger
 * /admin/analytics/activity:
 *   get:
 *     tags: [Admin]
 *     summary: Get aggregate activity breakdown for charts
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema: { type: string, enum: [7d, 30d, 90d, 365d], default: 7d }
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Activity analytics
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ActivityAnalytics' }
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/analytics/activity', getActivityAnalytics);

module.exports = router;
