exports.up = (pgm) => {
    pgm.createTable('reminders', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        habit_id: {
            type: 'uuid',
            notNull: true,
            references: 'habits',
            onDelete: 'CASCADE',
        },
        user_id: {
            type: 'uuid',
            notNull: true,
            references: 'users',
            onDelete: 'CASCADE',
        },
        time: { type: 'time', notNull: true },
        enabled: { type: 'boolean', notNull: true, default: true },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
        updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    });
};

exports.down = (pgm) => {
    pgm.dropTable('reminders');
};