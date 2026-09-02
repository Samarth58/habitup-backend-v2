exports.up = (pgm) => {
  pgm.createTable('user_activity', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: {
      type: 'uuid',
      notNull: false,
      references: 'users',
      onDelete: 'SET NULL',
    },
    activity_type: { type: 'text', notNull: true },
    metadata: { type: 'jsonb', notNull: false },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.addIndex('user_activity', ['user_id'], { name: 'idx_user_activity_user_id' });
  pgm.addIndex('user_activity', ['activity_type'], { name: 'idx_user_activity_type' });
  pgm.addIndex('user_activity', ['created_at'], { name: 'idx_user_activity_created_at' });
  pgm.addIndex('user_activity', ['user_id', 'created_at'], { name: 'idx_user_activity_user_created' });
};

exports.down = (pgm) => {
  pgm.dropTable('user_activity');
};
