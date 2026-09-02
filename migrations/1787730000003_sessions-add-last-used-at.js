exports.up = (pgm) => {
  pgm.addColumns('sessions', {
    last_used_at: { type: 'timestamptz', notNull: false },
  }, { ifNotExists: true });

  pgm.addIndex('sessions', ['user_id', 'created_at'], {
    name: 'idx_sessions_user_created',
    ifNotExists: true,
  });
  pgm.addIndex('sessions', ['user_id', 'last_used_at'], {
    name: 'idx_sessions_user_last_used',
    ifNotExists: true,
  });
};

exports.down = (pgm) => {
  pgm.dropIndex('sessions', ['user_id', 'created_at'], {
    name: 'idx_sessions_user_created',
    ifExists: true,
  });
  pgm.dropIndex('sessions', ['user_id', 'last_used_at'], {
    name: 'idx_sessions_user_last_used',
    ifExists: true,
  });
};
