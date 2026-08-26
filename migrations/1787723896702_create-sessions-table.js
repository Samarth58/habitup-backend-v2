exports.up = (pgm) => {
    pgm.createTable('habits', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        user_id: {
            type: 'uuid',
            notNull: true,
            references: 'users',
            onDelete: 'CASCADE',
        },
        name: { type: 'text', notNull: true },
        description: { type: 'text' },
        icon: { type: 'text' },
        color: { type: 'text' },
        frequency_type: { type: 'text', notNull: true },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
        updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
        paused_at: { type: 'timestamptz' },
        archived_at: { type: 'timestamptz' },
        deleted_at: { type: 'timestamptz' },
    });
};

exports.down = (pgm) => {
    pgm.dropTable('habits');
};