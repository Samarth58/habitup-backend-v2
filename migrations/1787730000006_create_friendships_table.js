exports.up = (pgm) => {
  pgm.createTable('friendships', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_a_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'CASCADE' },
    user_b_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'CASCADE' },
    status: { type: 'varchar(20)', notNull: true, default: 'accepted' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.addConstraint('friendships', 'friendships_user_pair_key', {
    unique: ['user_a_id', 'user_b_id'],
  });
  pgm.addConstraint('friendships', 'friendships_users_ordered_check', {
    check: 'user_a_id < user_b_id',
  });
  pgm.createIndex('friendships', 'user_a_id', { name: 'idx_friendships_user_a' });
  pgm.createIndex('friendships', 'user_b_id', { name: 'idx_friendships_user_b' });
};

exports.down = (pgm) => {
  pgm.dropTable('friendships');
};