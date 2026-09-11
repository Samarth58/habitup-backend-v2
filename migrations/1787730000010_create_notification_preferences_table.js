exports.up = (pgm) => {
  pgm.createTable('notification_preferences', {
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
    push_enabled: {
      type: 'boolean',
      notNull: true,
      default: true,
    },
    morning_enabled: {
      type: 'boolean',
      notNull: true,
      default: true,
    },
    afternoon_enabled: {
      type: 'boolean',
      notNull: true,
      default: true,
    },
    evening_enabled: {
      type: 'boolean',
      notNull: true,
      default: true,
    },
    morning_time: {
      type: 'time',
      notNull: true,
      default: '08:00:00',
    },
    afternoon_time: {
      type: 'time',
      notNull: true,
      default: '13:00:00',
    },
    evening_time: {
      type: 'time',
      notNull: true,
      default: '20:00:00',
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

  pgm.addConstraint('notification_preferences', 'notification_preferences_user_id_key', {
    unique: ['user_id'],
  });

  pgm.createIndex('notification_preferences', 'user_id', {
    name: 'idx_notification_preferences_user_id',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('notification_preferences');
};
