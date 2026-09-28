/**
 * HabitUp Shop & Inventory Service
 *
 * Handles accessory catalog queries, transactional item purchasing, inventory tracking,
 * and outfit equipment.
 */

const { pool } = require('./db');
const bambooService = require('./bambooService');

/**
 * Retrieves the active shop catalog.
 *
 * @returns {Promise<Array<object>>}
 */
async function getCatalog() {
  const { rows } = await pool.query(
    `SELECT id, name, category, price, icon, description, rarity, badge_color, created_at
     FROM shop_items
     WHERE is_active = true
     ORDER BY category ASC, price ASC`
  );
  return rows;
}

/**
 * Retrieves a user's owned inventory and currently equipped outfit.
 *
 * @param {string} userId - User UUID
 * @returns {Promise<{ inventory: Array<string>, items: Array<object>, outfit: { equipped_hat: string|null, equipped_glasses: string|null } }>}
 */
async function getUserInventory(userId) {
  await bambooService.getOrCreateWallet(userId);

  const [inventoryRes, outfitRes] = await Promise.all([
    pool.query(
      `SELECT ui.item_id, ui.purchased_price, ui.purchased_at,
              si.name, si.category, si.icon, si.description, si.rarity, si.badge_color
       FROM user_inventory ui
       JOIN shop_items si ON si.id = ui.item_id
       WHERE ui.user_id = $1
       ORDER BY ui.purchased_at ASC`,
      [userId]
    ),
    pool.query(
      'SELECT equipped_hat, equipped_glasses FROM user_mascot_outfits WHERE user_id = $1',
      [userId]
    ),
  ]);

  const ownedItemIds = inventoryRes.rows.map((r) => r.item_id);
  const outfit = outfitRes.rows[0] || { equipped_hat: null, equipped_glasses: null };

  return {
    inventory: ownedItemIds,
    items: inventoryRes.rows,
    outfit: {
      equipped_hat: outfit.equipped_hat || null,
      equipped_glasses: outfit.equipped_glasses || null,
    },
  };
}

/**
 * Purchases a shop item atomically for the user.
 *
 * @param {string} userId - User UUID
 * @param {string} itemId - Accessory ID from shop catalog
 * @returns {Promise<{ success: boolean, purchase?: object, current_bamboo_balance?: number, inventory?: Array<string>, error?: string, status?: number }>}
 */
async function purchaseItem(userId, itemId) {
  if (!itemId || typeof itemId !== 'string') {
    return { error: 'itemId is required.', status: 400 };
  }

  const cleanItemId = itemId.trim().toLowerCase();

  // 1. Validate item exists in shop_items
  const itemRes = await pool.query(
    'SELECT id, name, category, price FROM shop_items WHERE id = $1 AND is_active = true',
    [cleanItemId]
  );

  if (itemRes.rows.length === 0) {
    return { error: 'Item not found in shop catalog.', status: 404 };
  }

  const item = itemRes.rows[0];
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Ensure wallet exists
    await bambooService.getOrCreateWallet(userId, client);

    // 2. Check if item is already owned
    const ownedRes = await client.query(
      'SELECT id FROM user_inventory WHERE user_id = $1 AND item_id = $2',
      [userId, item.id]
    );

    if (ownedRes.rows.length > 0) {
      await client.query('ROLLBACK');
      return { error: 'Item is already owned.', status: 409 };
    }

    // 3. Atomically deduct exact server price from wallet
    const deductResult = await bambooService.deductBamboo(
      userId,
      item.price,
      'SHOP_PURCHASE',
      item.id,
      `Purchased accessory: ${item.name}`,
      client
    );

    if (!deductResult.success) {
      await client.query('ROLLBACK');
      return { error: 'Insufficient Bamboo Coins to purchase this item.', status: 400 };
    }

    // 4. Insert into user_inventory
    await client.query(
      `INSERT INTO user_inventory (user_id, item_id, purchased_price)
       VALUES ($1, $2, $3)`,
      [userId, item.id, item.price]
    );

    // 5. Query updated owned item IDs
    const allOwnedRes = await client.query(
      'SELECT item_id FROM user_inventory WHERE user_id = $1 ORDER BY purchased_at ASC',
      [userId]
    );

    await client.query('COMMIT');

    return {
      success: true,
      purchase: {
        itemId: item.id,
        name: item.name,
        category: item.category,
        price: item.price,
      },
      current_bamboo_balance: deductResult.current_bamboo_balance,
      inventory: allOwnedRes.rows.map((r) => r.item_id),
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Equips or unequips an accessory category (hat or glasses) for the user.
 *
 * @param {string} userId - User UUID
 * @param {string} category - 'hat' | 'glasses'
 * @param {string|null} itemId - Accessory ID or null to unequip
 * @returns {Promise<{ success: boolean, outfit?: object, error?: string, status?: number }>}
 */
async function equipAccessory(userId, category, itemId) {
  if (!['hat', 'glasses'].includes(category)) {
    return { error: 'Category must be either "hat" or "glasses".', status: 400 };
  }

  // Handle unequip
  if (!itemId) {
    const column = category === 'hat' ? 'equipped_hat' : 'equipped_glasses';
    const updateRes = await pool.query(
      `INSERT INTO user_mascot_outfits (user_id, ${column}, updated_at)
       VALUES ($1, NULL, NOW())
       ON CONFLICT (user_id) DO UPDATE
       SET ${column} = NULL, updated_at = NOW()
       RETURNING equipped_hat, equipped_glasses`,
      [userId]
    );

    const outfit = updateRes.rows[0];
    return {
      success: true,
      outfit: {
        equipped_hat: outfit?.equipped_hat || null,
        equipped_glasses: outfit?.equipped_glasses || null,
      },
    };
  }

  const cleanItemId = String(itemId).trim().toLowerCase();

  // Validate item exists and matches category
  const itemRes = await pool.query(
    'SELECT id, category FROM shop_items WHERE id = $1 AND is_active = true',
    [cleanItemId]
  );

  if (itemRes.rows.length === 0) {
    return { error: 'Item not found.', status: 404 };
  }

  const item = itemRes.rows[0];
  if (item.category !== category) {
    return {
      error: `Item "${cleanItemId}" belongs to category "${item.category}", cannot be equipped as "${category}".`,
      status: 400,
    };
  }

  // Ensure user owns this item
  const ownedRes = await pool.query(
    'SELECT id FROM user_inventory WHERE user_id = $1 AND item_id = $2',
    [userId, cleanItemId]
  );

  if (ownedRes.rows.length === 0) {
    return { error: 'You do not own this accessory.', status: 403 };
  }

  const column = category === 'hat' ? 'equipped_hat' : 'equipped_glasses';
  const updateRes = await pool.query(
    `INSERT INTO user_mascot_outfits (user_id, ${column}, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (user_id) DO UPDATE
     SET ${column} = $2, updated_at = NOW()
     RETURNING equipped_hat, equipped_glasses`,
    [userId, cleanItemId]
  );

  const outfit = updateRes.rows[0];
  return {
    success: true,
    outfit: {
      equipped_hat: outfit?.equipped_hat || null,
      equipped_glasses: outfit?.equipped_glasses || null,
    },
  };
}

module.exports = {
  getCatalog,
  getUserInventory,
  purchaseItem,
  equipAccessory,
};
