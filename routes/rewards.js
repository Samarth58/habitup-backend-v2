const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const {
  getBalance,
  claimDailyGift,
  getTransactions,
} = require('../controllers/rewardController');

router.use(requireAuth);

/**
 * @swagger
 * /rewards/balance:
 *   get:
 *     tags: [Rewards]
 *     summary: Retrieve the current user's Bamboo wallet balance
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Bamboo wallet balance and lifetime stats
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 balance: { type: integer, example: 100 }
 *                 total_earned: { type: integer, example: 100 }
 *                 total_spent: { type: integer, example: 0 }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/balance', getBalance);

/**
 * @swagger
 * /rewards/daily-gift:
 *   post:
 *     tags: [Rewards]
 *     summary: Claim the daily Sparky Boutique Gift (+35 Bamboo)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Daily gift claim result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 claimed: { type: boolean, example: true }
 *                 bamboo_earned: { type: integer, example: 35 }
 *                 current_bamboo_balance: { type: integer, example: 135 }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/daily-gift', claimDailyGift);

/**
 * @swagger
 * /rewards/transactions:
 *   get:
 *     tags: [Rewards]
 *     summary: Retrieve paginated Bamboo transaction ledger
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *         description: Number of records to return (max 100)
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *         description: Number of records to skip
 *     responses:
 *       200:
 *         description: Array of Bamboo transaction records
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 transactions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string, format: uuid }
 *                       amount: { type: integer, example: 10 }
 *                       balance_after: { type: integer, example: 110 }
 *                       type: { type: string, example: 'HABIT_COMPLETION' }
 *                       reference_id: { type: string, example: 'completion_123_2026-09-28' }
 *                       description: { type: string }
 *                       created_at: { type: string, format: date-time }
 *                 total: { type: integer, example: 5 }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/transactions', getTransactions);

module.exports = router;
