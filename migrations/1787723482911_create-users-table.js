exports.up = (pgm) => {
    pgm.createExtension('pgcrypto', { ifNotExists: true });

    pgm.createTable('users', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        name: { type: 'text', notNull: true },
        email: { type: 'text', notNull: true, unique: true },
        password_hash: { type: 'text', notNull: true },
        timezone: { type: 'text', notNull: true, default: 'UTC' },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
        updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    });
};

exports.down = (pgm) => {
    pgm.dropTable('users');
    pgm.dropExtension('pgcrypto');
};
