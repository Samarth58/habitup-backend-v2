/**
 * Migration: Create Bamboo Wallet, Shop, Inventory, Outfits, and Transactions tables.
 */

exports.up = async (pgm) => {
  // 1. user_bamboo_wallets
  pgm.createTable('user_bamboo_wallets', {
    user_id: {
      type: 'uuid',
      primaryKey: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    balance: {
      type: 'integer',
      notNull: true,
      default: 100,
      check: 'balance >= 0',
    },
    total_earned: {
      type: 'integer',
      notNull: true,
      default: 100,
    },
    total_spent: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  // 2. shop_items
  pgm.createTable('shop_items', {
    id: {
      type: 'varchar(64)',
      primaryKey: true,
    },
    name: {
      type: 'varchar(128)',
      notNull: true,
    },
    category: {
      type: 'varchar(32)',
      notNull: true,
    },
    price: {
      type: 'integer',
      notNull: true,
      check: 'price >= 0',
    },
    icon: {
      type: 'varchar(32)',
      notNull: true,
    },
    description: {
      type: 'text',
      notNull: true,
    },
    rarity: {
      type: 'varchar(32)',
      notNull: true,
    },
    badge_color: {
      type: 'varchar(16)',
      notNull: true,
    },
    is_active: {
      type: 'boolean',
      notNull: true,
      default: true,
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  // 3. user_inventory
  pgm.createTable('user_inventory', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    item_id: {
      type: 'varchar(64)',
      notNull: true,
      references: 'shop_items',
    },
    purchased_price: {
      type: 'integer',
      notNull: true,
    },
    purchased_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.addConstraint('user_inventory', 'uq_user_inventory_user_item', {
    unique: ['user_id', 'item_id'],
  });

  pgm.createIndex('user_inventory', 'user_id', {
    name: 'idx_user_inventory_user_id',
  });

  // 4. user_mascot_outfits
  pgm.createTable('user_mascot_outfits', {
    user_id: {
      type: 'uuid',
      primaryKey: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    equipped_hat: {
      type: 'varchar(64)',
      references: 'shop_items',
      onDelete: 'SET NULL',
    },
    equipped_glasses: {
      type: 'varchar(64)',
      references: 'shop_items',
      onDelete: 'SET NULL',
    },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  // 5. bamboo_transactions
  pgm.createTable('bamboo_transactions', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    amount: {
      type: 'integer',
      notNull: true,
    },
    balance_after: {
      type: 'integer',
      notNull: true,
    },
    type: {
      type: 'varchar(64)',
      notNull: true,
    },
    reference_id: {
      type: 'varchar(128)',
    },
    description: {
      type: 'text',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.createIndex('bamboo_transactions', 'user_id', {
    name: 'idx_bamboo_transactions_user_id',
  });

  // Unique partial index to prevent duplicate reward grants for same type + reference_id per user
  pgm.createIndex('bamboo_transactions', ['user_id', 'type', 'reference_id'], {
    name: 'idx_bamboo_tx_unique_reward',
    unique: true,
    where: 'reference_id IS NOT NULL',
  });

  // Seed shop items catalog
  const shopItems = [
    // HATS
    {
      id: 'party_hat',
      name: 'Party Cone',
      category: 'hat',
      price: 40,
      icon: '🥳',
      description: 'Every completed habit is a celebration! Rainbow striped party cone.',
      rarity: 'common',
      badge_color: '#06B6D4',
    },
    {
      id: 'beanie',
      name: 'Cozy Teal Beanie',
      category: 'hat',
      price: 45,
      icon: '🧢',
      description: 'Warm and comfortable for cool morning check-ins.',
      rarity: 'common',
      badge_color: '#0D9488',
    },
    {
      id: 'chef',
      name: 'Chef Toque',
      category: 'hat',
      price: 50,
      icon: '👨‍🍳',
      description: 'Cooking up healthy routines! Tall fluffy culinary master hat.',
      rarity: 'common',
      badge_color: '#10B981',
    },
    {
      id: 'detective',
      name: 'Detective Cap',
      category: 'hat',
      price: 60,
      icon: '🕵️',
      description: 'Investigating missing habits! Classic tweed cap with magnifying badge.',
      rarity: 'rare',
      badge_color: '#3B82F6',
    },
    {
      id: 'ninja_band',
      name: 'Focus Ninja Headband',
      category: 'hat',
      price: 70,
      icon: '🥋',
      description: 'Unbreakable warrior discipline! Crimson red martial arts headband.',
      rarity: 'rare',
      badge_color: '#DC2626',
    },
    {
      id: 'santa',
      name: 'Holiday Santa Cap',
      category: 'hat',
      price: 80,
      icon: '🎅',
      description: 'Spreading festive motivation! Red velvet with fluffy white puff.',
      rarity: 'rare',
      badge_color: '#EF4444',
    },
    {
      id: 'flower_crown',
      name: 'Sakura Flower Crown',
      category: 'hat',
      price: 90,
      icon: '🌸',
      description: 'Fresh blossoming habit energy! Delicate pink cherry blossoms & vines.',
      rarity: 'rare',
      badge_color: '#EC4899',
    },
    {
      id: 'wizard',
      name: 'Wizard Star Hat',
      category: 'hat',
      price: 120,
      icon: '🧙',
      description: 'Cast consistency spells! Indigo pointed hat studded with golden stars.',
      rarity: 'epic',
      badge_color: '#8B5CF6',
    },
    {
      id: 'crown',
      name: 'Royal Diamond Crown',
      category: 'hat',
      price: 250,
      icon: '👑',
      description: 'Fit for a habit monarch! Polished gold coronet with ruby jewels.',
      rarity: 'legendary',
      badge_color: '#F59E0B',
    },
    // GLASSES
    {
      id: 'round_specs',
      name: 'Scholar Round Specs',
      category: 'glasses',
      price: 55,
      icon: '👓',
      description: 'For studious deep work & learning routines! Intellectual circular frames.',
      rarity: 'common',
      badge_color: '#6366F1',
    },
    {
      id: 'aviators',
      name: 'Cool Aviator Shades',
      category: 'glasses',
      price: 75,
      icon: '😎',
      description: 'Too cool for broken streaks! Sleek dark gold-rim sunglasses with shine.',
      rarity: 'rare',
      badge_color: '#F59E0B',
    },
    {
      id: 'star_glasses',
      name: 'Star Rocker Glasses',
      category: 'glasses',
      price: 85,
      icon: '🤩',
      description: 'Rockstar momentum! Golden star-shaped festival shades.',
      rarity: 'rare',
      badge_color: '#EAB308',
    },
    {
      id: 'monocle',
      name: 'Golden Monocle',
      category: 'glasses',
      price: 110,
      icon: '🧐',
      description: 'Exquisite gentleman taste! Gold rim monocle with hanging chain.',
      rarity: 'epic',
      badge_color: '#D97706',
    },
    {
      id: 'pixel_shades',
      name: '8-Bit Pixel Shades',
      category: 'glasses',
      price: 130,
      icon: '🕶️',
      description: 'Deal with it! Stepped retro arcade pixel sunglasses.',
      rarity: 'epic',
      badge_color: '#14B8A6',
    },
    // DEFAULT SPECIAL STARTER
    {
      id: 'default_bamboo',
      name: 'Base Mascot Starter',
      category: 'special',
      price: 0,
      icon: '🎋',
      description: 'Base starter bamboo accessory.',
      rarity: 'common',
      badge_color: '#10B981',
    },
  ];

  for (const item of shopItems) {
    pgm.sql(
      `INSERT INTO shop_items (id, name, category, price, icon, description, rarity, badge_color, is_active)
       VALUES ('${item.id}', '${item.name.replace(/'/g, "''")}', '${item.category}', ${item.price}, '${item.icon}', '${item.description.replace(/'/g, "''")}', '${item.rarity}', '${item.badge_color}', true)
       ON CONFLICT (id) DO NOTHING`
    );
  }
};

exports.down = (pgm) => {
  pgm.dropTable('bamboo_transactions');
  pgm.dropTable('user_mascot_outfits');
  pgm.dropTable('user_inventory');
  pgm.dropTable('shop_items');
  pgm.dropTable('user_bamboo_wallets');
};
