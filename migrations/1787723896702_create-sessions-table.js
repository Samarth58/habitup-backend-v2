exports.up = (pgm) => {
    pgm.createTable('sessions', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        user_id: {
            type: 'uuid',
            notNull: true,
            references: 'users',
            onDelete: 'CASCADE',
        },
        refresh_token_hash: { type: 'text', notNull: true },
        device_id: { type: 'text' },
        device_name: { type: 'text' },
        expires_at: { type: 'timestamptz', notNull: true },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
        revoked_at: { type: 'timestamptz' },
    }, { ifNotExists: true });
};

exports.down = (pgm) => {
    pgm.dropTable('sessions', { ifExists: true });
};