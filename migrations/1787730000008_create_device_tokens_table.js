exports.up = (pgm) => {
  pgm.createTable('device_tokens', {
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
    token: {
      type: 'text',
      notNull: true,
    },
    platform: {
      type: 'varchar(20)',
      notNull: true,
    },
    timezone: {
      type: 'varchar(100)',
      notNull: true,
      default: 'UTC',
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

  pgm.addConstraint('device_tokens', 'device_tokens_token_key', {
    unique: ['token'],
  });

  pgm.createIndex('device_tokens', 'user_id', {
    name: 'idx_device_tokens_user_id',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('device_tokens');
};
