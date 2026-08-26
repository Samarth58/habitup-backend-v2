exports.up = (pgm) => {
    pgm.createTable('habit_completions', {
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
        completion_date: { type: 'date', notNull: true },
        completed_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    });

    pgm.addConstraint('habit_completions', 'unique_habit_completion_date', {
        unique: ['habit_id', 'completion_date'],
    });
};

exports.down = (pgm) => {
    pgm.dropTable('habit_completions');
};