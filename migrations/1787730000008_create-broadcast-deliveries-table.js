exports.up = (pgm) => {
  pgm.createTable('broadcast_deliveries', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    slot_key: { type: 'varchar(32)', notNull: true },
    broadcast_date: { type: 'date', notNull: true },
    title: { type: 'varchar(120)', notNull: true },
    body: { type: 'text', notNull: true },
    category: { type: 'varchar(32)', notNull: true },
    status: { type: 'varchar(20)', notNull: true, default: 'processing' },
    message_id: { type: 'varchar(255)', notNull: false },
    error_message: { type: 'text', notNull: false },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    sent_at: { type: 'timestamptz', notNull: false },
  });

  pgm.addConstraint('broadcast_deliveries', 'uq_broadcast_slot_date', {
    unique: ['slot_key', 'broadcast_date'],
  });

  pgm.createIndex('broadcast_deliveries', ['broadcast_date'], {
    name: 'idx_broadcast_deliveries_date',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('broadcast_deliveries');
};
