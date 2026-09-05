exports.up = (pgm) => {
  pgm.createTable('friend_requests', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    requester_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'CASCADE' },
    recipient_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'CASCADE' },
    status: { type: 'varchar(20)', notNull: true, default: 'pending' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.addConstraint('friend_requests', 'friend_requests_requester_recipient_key', {
    unique: ['requester_id', 'recipient_id'],
  });
  pgm.createIndex('friend_requests', 'recipient_id', {
    name: 'idx_friend_requests_recipient_pending',
    where: "status = 'pending'",
  });
  pgm.createIndex('friend_requests', ['requester_id', 'status'], {
    name: 'idx_friend_requests_status',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('friend_requests');
};