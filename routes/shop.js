const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const {
  getItems,
  getInventory,
  purchase,
  equip,
} = require('../controllers/shopController');

router.use(requireAuth);

/**
 * @swagger
 * /shop/items:
 *   get:
 *     tags: [Shop]
 *     summary: Retrieve active shop accessories catalog
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of available shop items
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string, example: 'detective' }
 *                       name: { type: string, example: 'Detective Cap' }
 *                       category: { type: string, enum: [hat, glasses, special], example: 'hat' }
 *                       price: { type: integer, example: 60 }
 *                       icon: { type: string, example: '🕵️' }
 *                       description: { type: string }
 *                       rarity: { type: string, enum: [common, rare, epic, legendary], example: 'rare' }
 *                       badge_color: { type: string, example: '#3B82F6' }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/items', getItems);

/**
 * @swagger
 * /shop/inventory:
 *   get:
 *     tags: [Shop]
 *     summary: Retrieve authenticated user's inventory and equipped outfit
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User's owned items and equipped accessories
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 inventory:
 *                   type: array
 *                   items: { type: string, example: 'detective' }
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       item_id: { type: string }
 *                       name: { type: string }
 *                       category: { type: string }
 *                       purchased_price: { type: integer }
 *                       purchased_at: { type: string, format: date-time }
 *                 outfit:
 *                   type: object
 *                   properties:
 *                     equipped_hat: { type: string, nullable: true, example: 'detective' }
 *                     equipped_glasses: { type: string, nullable: true, example: null }
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/inventory', getInventory);

/**
 * @swagger
 * /shop/purchase:
 *   post:
 *     tags: [Shop]
 *     summary: Purchase an accessory item from the shop
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [itemId]
 *             properties:
 *               itemId: { type: string, example: 'detective' }
 *     responses:
 *       200:
 *         description: Purchase successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 purchase:
 *                   type: object
 *                   properties:
 *                     itemId: { type: string, example: 'detective' }
 *                     name: { type: string, example: 'Detective Cap' }
 *                     category: { type: string, example: 'hat' }
 *                     price: { type: integer, example: 60 }
 *                 current_bamboo_balance: { type: integer, example: 40 }
 *                 inventory:
 *                   type: array
 *                   items: { type: string }
 *       400:
 *         description: Insufficient funds or invalid item
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Item not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       409:
 *         description: Item already owned
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/purchase', purchase);

/**
 * @swagger
 * /shop/equip:
 *   post:
 *     tags: [Shop]
 *     summary: Equip or unequip an accessory (hat or glasses)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [category]
 *             properties:
 *               category: { type: string, enum: [hat, glasses], example: 'hat' }
 *               itemId: { type: string, nullable: true, example: 'detective' }
 *     responses:
 *       200:
 *         description: Outfit equipment updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 outfit:
 *                   type: object
 *                   properties:
 *                     equipped_hat: { type: string, nullable: true, example: 'detective' }
 *                     equipped_glasses: { type: string, nullable: true, example: null }
 *       400:
 *         description: Invalid category or item category mismatch
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       403:
 *         description: Item not owned by user
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Item not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/equip', equip);

module.exports = router;
