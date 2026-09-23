const { Router } = require('express');
const { handleAIChat } = require('../controllers/aiController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = Router();

/**
 * @swagger
 * /ai/chat:
 *   post:
 *     tags: [AI]
 *     summary: Send a message to the HabitUp AI Coach with optional conversation history
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
 *               message:
 *                 type: string
 *                 maxLength: 2000
 *                 example: How can I stay consistent with my workout habit?
 *               history:
 *                 type: array
 *                 maxItems: 10
 *                 description: Optional recent conversation turns (max 10 messages, max 2000 chars per message, max 8000 total chars)
 *                 items:
 *                   type: object
 *                   required: [role, content]
 *                   properties:
 *                     role:
 *                       type: string
 *                       enum: [user, assistant]
 *                       example: user
 *                     content:
 *                       type: string
 *                       maxLength: 2000
 *                       example: How can I improve my reading habit?
 *     responses:
 *       200:
 *         description: AI Coach response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 reply:
 *                   type: string
 *                   example: Start small! Commit to just 5 minutes a day to build momentum.
 *       400:
 *         description: Validation error (invalid message, invalid history, or bounds exceeded)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized (missing or invalid access token)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error or Gemini service failure
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/chat', requireAuth, handleAIChat);

module.exports = router;
