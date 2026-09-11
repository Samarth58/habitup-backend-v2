exports.up = (pgm) => {
  pgm.createTable('notification_deliveries', {
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
    notification_type: {
      type: 'varchar(50)',
      notNull: true,
    },
    scheduled_local_date: {
      type: 'varchar(10)',
      notNull: true,
    },
    scheduled_local_time: {
      type: 'varchar(5)',
      notNull: true,
    },
    timezone: {
      type: 'varchar(100)',
      notNull: true,
      default: 'UTC',
    },
    status: {
      type: 'varchar(30)',
      notNull: true,
      default: 'processing',
    },
    device_count: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    sent_at: {
      type: 'timestamptz',
    },
    error_message: {
      type: 'text',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.addConstraint(
    'notification_deliveries',
    'notification_deliveries_user_type_date_time_key',
    {
      unique: ['user_id', 'notification_type', 'scheduled_local_date', 'scheduled_local_time'],
    }
  );

  pgm.createIndex('notification_deliveries', ['user_id', 'created_at'], {
    name: 'idx_notification_deliveries_user_created',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('notification_deliveries');
};
