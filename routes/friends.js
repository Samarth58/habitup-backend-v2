const { Router } = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const { validateUuid } = require('../middleware/validateUuid');
const {
  sendFriendRequest,
  getPendingRequests,
  acceptFriendRequest,
  rejectFriendRequest,
  getFriends,
  removeFriend,
  getFriendHabits,
  getFriendStats,
} = require('../controllers/friendController');

const router = Router();
router.use(requireAuth);

/**
 * @swagger
 * /friends/request:
 *   post:
 *     tags: [Friends]
 *     summary: Send a friend request by username
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username]
 *             properties:
 *               username: { type: string, example: jane_doe }
 *     responses:
 *       201: { description: Friend request created }
 *       400: { description: Username is missing }
 *       404: { description: User not found }
 *       409: { description: Request conflicts with an existing relationship }
 */
router.post('/request', sendFriendRequest);

/**
 * @swagger
 * /friends/requests:
 *   get:
 *     tags: [Friends]
 *     summary: List pending incoming friend requests
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Pending requests }
 */
router.get('/requests', getPendingRequests);

/**
 * @swagger
 * /friends/requests/{requestId}/accept:
 *   post:
 *     tags: [Friends]
 *     summary: Accept a pending friend request
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: requestId, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Friendship created }
 *       403: { description: User is not the recipient }
 *       404: { description: Request not found }
 *       409: { description: Request is not pending }
 */
router.post('/requests/:requestId/accept', validateUuid('requestId'), acceptFriendRequest);

/**
 * @swagger
 * /friends/requests/{requestId}:
 *   delete:
 *     tags: [Friends]
 *     summary: Reject a pending friend request
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: requestId, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Friend request declined }
 *       403: { description: User is not the recipient }
 *       404: { description: Request not found }
 *       409: { description: Request is not pending }
 */
router.delete('/requests/:requestId', validateUuid('requestId'), rejectFriendRequest);

/**
 * @swagger
 * /friends:
 *   get:
 *     tags: [Friends]
 *     summary: List accepted friends
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Accepted friends }
 */
router.get('/', getFriends);

/**
 * @swagger
 * /friends/{friendId}/habits:
 *   get:
 *     tags: [Friends]
 *     summary: View an accepted friend's active habits
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: friendId, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Friend habits }
 *       404: { description: Friendship not found }
 */
router.get('/:friendId/habits', validateUuid('friendId'), getFriendHabits);

/**
 * @swagger
 * /friends/{friendId}/stats:
 *   get:
 *     tags: [Friends]
 *     summary: View an accepted friend's aggregate habit stats
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: friendId, required: true, schema: { type: string, format: uuid } }
 *       - { in: query, name: period, schema: { type: string, enum: [month, year] } }
 *     responses:
 *       200: { description: Friend stats }
 *       404: { description: Friendship not found }
 */
router.get('/:friendId/stats', validateUuid('friendId'), getFriendStats);

/**
 * @swagger
 * /friends/{friendId}:
 *   delete:
 *     tags: [Friends]
 *     summary: Remove an accepted friend
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: friendId, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Friend removed }
 *       404: { description: Friendship not found }
 */
router.delete('/:friendId', validateUuid('friendId'), removeFriend);

module.exports = router;