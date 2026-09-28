/**
 * HabitUp Shop Controller
 *
 * Handles catalog browsing, inventory queries, atomic purchases, and mascot equipment.
 */

const shopService = require('../services/shopService');

/**
 * GET /shop/items
 * Retrieves active shop accessories catalog.
 */
async function getItems(req, res) {
  try {
    const items = await shopService.getCatalog();
    return res.json({ items });
  } catch (err) {
    console.error('[getItems]', err);
    return res.status(500).json({ error: 'Failed to retrieve shop items.' });
  }
}

/**
 * GET /shop/inventory
 * Retrieves authenticated user's owned items and equipped outfit.
 */
async function getInventory(req, res) {
  const userId = req.userId;

  try {
    const data = await shopService.getUserInventory(userId);
    return res.json(data);
  } catch (err) {
    console.error('[getInventory]', err);
    return res.status(500).json({ error: 'Failed to retrieve inventory.' });
  }
}

/**
 * POST /shop/purchase
 * Purchases a shop item using Bamboo Coins.
 */
async function purchase(req, res) {
  const userId = req.userId;
  const { itemId } = req.body;

  if (!itemId) {
    return res.status(400).json({ error: 'itemId is required.' });
  }

  try {
    const result = await shopService.purchaseItem(userId, itemId);
    if (result.error) {
      return res.status(result.status || 400).json({ error: result.error });
    }

    return res.status(200).json({
      purchase: result.purchase,
      current_bamboo_balance: result.current_bamboo_balance,
      inventory: result.inventory,
    });
  } catch (err) {
    console.error('[purchase]', err);
    return res.status(500).json({ error: 'Failed to process purchase.' });
  }
}

/**
 * POST /shop/equip
 * Equips or unequips an accessory category (hat or glasses).
 */
async function equip(req, res) {
  const userId = req.userId;
  const { category, itemId } = req.body;

  if (!category) {
    return res.status(400).json({ error: 'category is required (hat or glasses).' });
  }

  try {
    const result = await shopService.equipAccessory(userId, category, itemId);
    if (result.error) {
      return res.status(result.status || 400).json({ error: result.error });
    }

    return res.json({ outfit: result.outfit });
  } catch (err) {
    console.error('[equip]', err);
    return res.status(500).json({ error: 'Failed to equip accessory.' });
  }
}

module.exports = {
  getItems,
  getInventory,
  purchase,
  equip,
};
