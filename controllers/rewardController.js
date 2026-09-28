/**
 * HabitUp Reward Controller
 *
 * Handles Bamboo balance retrieval, daily gift claiming, and transaction history.
 */

const bambooService = require('../services/bambooService');
const { getUserTimezone } = require('../services/habitService');

/**
 * GET /rewards/balance
 * Returns the authenticated user's Bamboo wallet balance and lifetime stats.
 */
async function getBalance(req, res) {
  const userId = req.userId;

  try {
    const wallet = await bambooService.getOrCreateWallet(userId);
    return res.json({
      balance: wallet.balance,
      total_earned: wallet.total_earned,
      total_spent: wallet.total_spent,
    });
  } catch (err) {
    console.error('[getBalance]', err);
    return res.status(500).json({ error: 'Failed to retrieve Bamboo balance.' });
  }
}

/**
 * POST /rewards/daily-gift
 * Claims the daily boutique gift (+35 Bamboo) once per calendar day.
 */
async function claimDailyGift(req, res) {
  const userId = req.userId;

  try {
    const timezone = await getUserTimezone(userId, req.user?.timezone);
    const result = await bambooService.claimDailyGift(userId, timezone);
    return res.json(result);
  } catch (err) {
    console.error('[claimDailyGift]', err);
    return res.status(500).json({ error: 'Failed to claim daily gift.' });
  }
}

/**
 * GET /rewards/transactions
 * Returns the authenticated user's Bamboo transaction history with pagination.
 */
async function getTransactions(req, res) {
  const userId = req.userId;
  const { limit, offset } = req.query;

  try {
    const result = await bambooService.getTransactions(userId, limit, offset);
    return res.json(result);
  } catch (err) {
    console.error('[getTransactions]', err);
    return res.status(500).json({ error: 'Failed to retrieve Bamboo transactions.' });
  }
}

module.exports = {
  getBalance,
  claimDailyGift,
  getTransactions,
};
