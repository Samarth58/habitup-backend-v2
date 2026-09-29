/**
 * HabitUp Bamboo Currency & Wallet Service
 *
 * Authoritative management for Bamboo balance, earnings, spending, and audit ledger.
 */

const { pool } = require('./db');

/**
 * Derives current local date string (YYYY-MM-DD) for a given timezone.
 *
 * @param {string} [timezone='UTC'] - IANA timezone
 * @returns {string} Date string 'YYYY-MM-DD'
 */
function getLocalDateInTimezone(timezone = 'UTC') {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(new Date());
    const year = parts.find((p) => p.type === 'year').value;
    const month = parts.find((p) => p.type === 'month').value;
    const day = parts.find((p) => p.type === 'day').value;
    return `${year}-${month}-${day}`;
  } catch (err) {
    return new Date().toISOString().slice(0, 10);
  }
}

/**
 * Safely retrieves or initializes a user's Bamboo wallet, starter inventory, and mascot outfit.
 *
 * @param {string} userId - User UUID
 * @param {object} [client=pool] - Optional pg client for existing transaction
 * @returns {Promise<{ balance: number, total_earned: number, total_spent: number }>}
 */
async function getOrCreateWallet(userId, client = pool) {
  // Check if wallet exists
  const selectRes = await client.query(
    'SELECT balance, total_earned, total_spent FROM user_bamboo_wallets WHERE user_id = $1',
    [userId]
  );

  if (selectRes.rows.length > 0) {
    return selectRes.rows[0];
  }

  // Create wallet initialized with 100 Bamboo
  const insertRes = await client.query(
    `INSERT INTO user_bamboo_wallets (user_id, balance, total_earned, total_spent)
     VALUES ($1, 100, 100, 0)
     ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
     RETURNING balance, total_earned, total_spent`,
    [userId]
  );

  // Grant default_bamboo to user_inventory
  await client.query(
    `INSERT INTO user_inventory (user_id, item_id, purchased_price)
     VALUES ($1, 'default_bamboo', 0)
     ON CONFLICT (user_id, item_id) DO NOTHING`,
    [userId]
  );

  // Initialize user_mascot_outfits row
  await client.query(
    `INSERT INTO user_mascot_outfits (user_id)
     VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );

  // Log initial starting bonus transaction if not exists
  const existingBonus = await client.query(
    `SELECT id FROM bamboo_transactions WHERE user_id = $1 AND type = 'INITIAL_BONUS'`,
    [userId]
  );
  if (existingBonus.rows.length === 0) {
    await client.query(
      `INSERT INTO bamboo_transactions (user_id, amount, balance_after, type, reference_id, description)
       VALUES ($1, 100, 100, 'INITIAL_BONUS', 'welcome_bonus', 'Initial welcome bonus')`,
      [userId]
    );
  }

  return insertRes.rows[0];
}

/**
 * Credits Bamboo to a user's wallet atomically with idempotency protection.
 *
 * @param {string} userId - User UUID
 * @param {number} amount - Positive integer of Bamboo to credit
 * @param {string} type - Transaction category (e.g. 'HABIT_COMPLETION', 'DAILY_100_BONUS', 'DAILY_GIFT')
 * @param {string} [referenceId] - Idempotency key (e.g. 'completion:<id>', 'daily_gift:<date>')
 * @param {string} [description] - Human-readable description
 * @param {object} [client] - Optional pg client if already inside an active transaction
 * @returns {Promise<{ awarded: boolean, bamboo_earned: number, current_bamboo_balance: number }>}
 */
async function addBamboo(userId, amount, type, referenceId = null, description = null, client = null) {
  if (typeof amount !== 'number' || amount <= 0 || !Number.isInteger(amount)) {
    throw new Error('Bamboo award amount must be a positive integer.');
  }

  const isInternalTransaction = !client;
  const dbClient = client || (await pool.connect());

  try {
    if (isInternalTransaction) {
      await dbClient.query('BEGIN');
    }

    // Ensure wallet exists
    await getOrCreateWallet(userId, dbClient);

    // If referenceId is provided, check idempotency
    if (referenceId) {
      const existingTx = await dbClient.query(
        'SELECT id, balance_after FROM bamboo_transactions WHERE user_id = $1 AND type = $2 AND reference_id = $3',
        [userId, type, referenceId]
      );
      if (existingTx.rows.length > 0) {
        const wallet = await dbClient.query(
          'SELECT balance FROM user_bamboo_wallets WHERE user_id = $1',
          [userId]
        );
        if (isInternalTransaction) {
          await dbClient.query('COMMIT');
        }
        return {
          awarded: false,
          bamboo_earned: 0,
          current_bamboo_balance: wallet.rows[0]?.balance ?? 100,
        };
      }
    }

    // Atomic wallet update
    const updateRes = await dbClient.query(
      `UPDATE user_bamboo_wallets
       SET balance = balance + $1, total_earned = total_earned + $1, updated_at = NOW()
       WHERE user_id = $2
       RETURNING balance`,
      [amount, userId]
    );

    const newBalance = updateRes.rows[0].balance;

    // Record transaction
    await dbClient.query(
      `INSERT INTO bamboo_transactions (user_id, amount, balance_after, type, reference_id, description)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, amount, newBalance, type, referenceId, description]
    );

    if (isInternalTransaction) {
      await dbClient.query('COMMIT');
    }

    return {
      awarded: true,
      bamboo_earned: amount,
      current_bamboo_balance: newBalance,
    };
  } catch (err) {
    if (isInternalTransaction) {
      await dbClient.query('ROLLBACK');
    }
    // Handle unique constraint conflict gracefully if duplicate transaction raced
    if (err.code === '23505' && referenceId) {
      const currentWallet = await pool.query(
        'SELECT balance FROM user_bamboo_wallets WHERE user_id = $1',
        [userId]
      );
      return {
        awarded: false,
        bamboo_earned: 0,
        current_bamboo_balance: currentWallet.rows[0]?.balance ?? 100,
      };
    }
    throw err;
  } finally {
    if (isInternalTransaction) {
      dbClient.release();
    }
  }
}

/**
 * Deducts Bamboo from a user's wallet atomically with row-level balance checks.
 *
 * @param {string} userId - User UUID
 * @param {number} amount - Positive integer of Bamboo to deduct
 * @param {string} type - Transaction category (e.g. 'SHOP_PURCHASE')
 * @param {string} [referenceId] - Reference item ID
 * @param {string} [description] - Human-readable description
 * @param {object} [client] - Optional pg client if already inside an active transaction
 * @returns {Promise<{ success: boolean, deducted: number, current_bamboo_balance: number }>}
 */
async function deductBamboo(userId, amount, type, referenceId = null, description = null, client = null) {
  if (typeof amount !== 'number' || amount <= 0 || !Number.isInteger(amount)) {
    throw new Error('Bamboo deduction amount must be a positive integer.');
  }

  const isInternalTransaction = !client;
  const dbClient = client || (await pool.connect());

  try {
    if (isInternalTransaction) {
      await dbClient.query('BEGIN');
    }

    // Ensure wallet exists
    await getOrCreateWallet(userId, dbClient);

    // Atomic deduction ensuring balance does not drop below 0
    const updateRes = await dbClient.query(
      `UPDATE user_bamboo_wallets
       SET balance = balance - $1, total_spent = total_spent + $1, updated_at = NOW()
       WHERE user_id = $2 AND balance >= $1
       RETURNING balance`,
      [amount, userId]
    );

    if (updateRes.rowCount === 0) {
      if (isInternalTransaction) {
        await dbClient.query('ROLLBACK');
      }
      return {
        success: false,
        deducted: 0,
        reason: 'insufficient_funds',
      };
    }

    const newBalance = updateRes.rows[0].balance;

    // Record debit transaction (negative amount)
    await dbClient.query(
      `INSERT INTO bamboo_transactions (user_id, amount, balance_after, type, reference_id, description)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, -amount, newBalance, type, referenceId, description]
    );

    if (isInternalTransaction) {
      await dbClient.query('COMMIT');
    }

    return {
      success: true,
      deducted: amount,
      current_bamboo_balance: newBalance,
    };
  } catch (err) {
    if (isInternalTransaction) {
      await dbClient.query('ROLLBACK');
    }
    throw err;
  } finally {
    if (isInternalTransaction) {
      dbClient.release();
    }
  }
}

/**
 * Claims the daily boutique gift (+35 Bamboo) once per calendar day.
 *
 * @param {string} userId - User UUID
 * @param {string} [timezone='UTC'] - User's IANA timezone
 * @returns {Promise<{ claimed: boolean, bamboo_earned: number, current_bamboo_balance: number }>}
 */
async function claimDailyGift(userId, timezone = 'UTC') {
  const localDate = getLocalDateInTimezone(timezone);
  const referenceId = `daily_gift_${localDate}`;

  const result = await addBamboo(
    userId,
    35,
    'DAILY_GIFT',
    referenceId,
    'Daily Sparky Boutique Gift 🎁'
  );

  return {
    claimed: result.awarded,
    bamboo_earned: result.bamboo_earned,
    current_bamboo_balance: result.current_bamboo_balance,
  };
}

/**
 * Fetches paginated Bamboo transaction history for a specific user.
 *
 * @param {string} userId - User UUID
 * @param {number} [limit=50] - Result limit
 * @param {number} [offset=0] - Offset for pagination
 * @returns {Promise<{ transactions: Array<object>, total: number }>}
 */
async function getTransactions(userId, limit = 50, offset = 0) {
  const sanitizedLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const sanitizedOffset = Math.max(Number(offset) || 0, 0);

  const [countRes, listRes] = await Promise.all([
    pool.query('SELECT COUNT(id)::int AS total FROM bamboo_transactions WHERE user_id = $1', [userId]),
    pool.query(
      `SELECT id, amount, balance_after, type, reference_id, description, created_at
       FROM bamboo_transactions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, sanitizedLimit, sanitizedOffset]
    ),
  ]);

  return {
    transactions: listRes.rows,
    total: countRes.rows[0]?.total || 0,
  };
}

/**
 * Reverses a previously granted Bamboo reward atomically and clears the idempotency lock.
 *
 * @param {string} userId - User UUID
 * @param {string} type - Transaction category (e.g. 'HABIT_COMPLETION', 'DAILY_100_BONUS')
 * @param {string} referenceId - Idempotency key (e.g. 'completion_<id>_<date>')
 * @param {object} [client] - Optional pg client if already inside an active transaction
 * @returns {Promise<{ revoked: boolean, bamboo_deducted: number, current_bamboo_balance: number }>}
 */
async function revokeBambooReward(userId, type, referenceId, client = null) {
  if (!referenceId) {
    throw new Error('Reference ID is required to revoke a Bamboo reward.');
  }

  const isInternalTransaction = !client;
  const dbClient = client || (await pool.connect());

  try {
    if (isInternalTransaction) {
      await dbClient.query('BEGIN');
    }

    // 1. Find the specific granted reward transaction
    const txRes = await dbClient.query(
      `SELECT id, amount
       FROM bamboo_transactions
       WHERE user_id = $1 AND type = $2 AND reference_id = $3
       FOR UPDATE`,
      [userId, type, referenceId]
    );

    if (txRes.rows.length === 0) {
      // Transaction was not found (or already revoked)
      const walletRes = await dbClient.query(
        'SELECT balance FROM user_bamboo_wallets WHERE user_id = $1',
        [userId]
      );
      if (isInternalTransaction) {
        await dbClient.query('COMMIT');
      }
      return {
        revoked: false,
        bamboo_deducted: 0,
        current_bamboo_balance: walletRes.rows[0]?.balance ?? 100,
      };
    }

    const txId = txRes.rows[0].id;
    const amountToDeduct = Math.max(0, txRes.rows[0].amount);

    // 2. Delete the transaction record to clear idempotency lock and restore clean audit state
    await dbClient.query('DELETE FROM bamboo_transactions WHERE id = $1', [txId]);

    // 3. Update wallet balance and total_earned
    const updateRes = await dbClient.query(
      `UPDATE user_bamboo_wallets
       SET balance = GREATEST(0, balance - $1),
           total_earned = GREATEST(0, total_earned - $1),
           updated_at = NOW()
       WHERE user_id = $2
       RETURNING balance`,
      [amountToDeduct, userId]
    );

    const newBalance = updateRes.rows[0]?.balance ?? 0;

    if (isInternalTransaction) {
      await dbClient.query('COMMIT');
    }

    return {
      revoked: true,
      bamboo_deducted: amountToDeduct,
      current_bamboo_balance: newBalance,
    };
  } catch (err) {
    if (isInternalTransaction) {
      await dbClient.query('ROLLBACK');
    }
    throw err;
  } finally {
    if (isInternalTransaction) {
      dbClient.release();
    }
  }
}

module.exports = {
  getLocalDateInTimezone,
  getOrCreateWallet,
  addBamboo,
  deductBamboo,
  revokeBambooReward,
  claimDailyGift,
  getTransactions,
};
