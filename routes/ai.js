const { Router } = require('express');
const {
  handleAIChat,
  getUserConversations,
  getConversationDetails,
  deleteUserConversation,
} = require('../controllers/aiController');
const { requireAuth } = require('../middleware/authMiddleware');
const { validateUuid } = require('../middleware/validateUuid');

const router = Router();

// Enforce authentication across all AI endpoints
router.use(requireAuth);

/**
 * @swagger
 * /ai/chat:
 *   post:
 *     tags: [AI]
 *     summary: Send a message to the HabitUp AI Coach with persistent conversation support
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               conversationId:
 *                 type: string
 *                 format: uuid
 *                 description: Optional existing conversation ID to continue. If omitted, a new conversation is created automatically.
 *                 example: 123e4567-e89b-12d3-a456-426614174000
 *               message:
 *                 type: string
 *                 maxLength: 2000
 *                 example: How can I stay consistent with my workout habit?
 *               history:
 *                 type: array
 *                 maxItems: 10
 *                 description: Optional ephemeral conversation turns (max 10 messages, max 2000 chars per message, max 8000 total chars)
 *                 items:
 *                   type: object
 *                   required: [role, content]
 *                   properties:
 *                     role:
 *                       type: string
 *                       enum: [user, assistant]
 *                     content:
 *                       type: string
 *                       maxLength: 2000
 *     responses:
 *       200:
 *         description: AI Coach response with conversation ID
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 conversationId:
 *                   type: string
 *                   format: uuid
 *                   example: 123e4567-e89b-12d3-a456-426614174000
 *                 reply:
 *                   type: string
 *                   example: Start small! Commit to just 5 minutes a day to build momentum.
 *       400:
 *         description: Validation error (invalid message, invalid history, or invalid UUID format)
 *       401:
 *         description: Unauthorized (missing or invalid access token)
 *       404:
 *         description: Conversation not found or belongs to another user
 *       500:
 *         description: Internal server error or Gemini service failure
 *       503:
 *         description: AI service quota temporarily exhausted
 */
router.post('/chat', handleAIChat);

/**
 * @swagger
 * /ai/conversations:
 *   get:
 *     tags: [AI]
 *     summary: List all persistent conversations for the authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user conversations ordered newest first
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 conversations:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       title:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *       401:
 *         description: Unauthorized
 */
router.get('/conversations', getUserConversations);

/**
 * @swagger
 * /ai/conversations/{conversationId}:
 *   get:
 *     tags: [AI]
 *     summary: Retrieve a single conversation and its message history
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Conversation details with message history
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 conversation:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     title:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                     messages:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           role:
 *                             type: string
 *                             enum: [user, assistant]
 *                           content:
 *                             type: string
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *       400:
 *         description: Invalid conversation ID format
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Conversation not found
 */
router.get('/conversations/:conversationId', validateUuid('conversationId'), getConversationDetails);

/**
 * @swagger
 * /ai/conversations/{conversationId}:
 *   delete:
 *     tags: [AI]
 *     summary: Delete a persistent conversation owned by the authenticated user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Conversation deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Conversation deleted successfully.
 *       400:
 *         description: Invalid conversation ID format
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Conversation not found
 */
router.delete('/conversations/:conversationId', validateUuid('conversationId'), deleteUserConversation);

module.exports = router;
