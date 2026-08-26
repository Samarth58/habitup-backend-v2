exports.up = (pgm) => {
    pgm.createTable('habit_schedules', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        habit_id: {
            type: 'uuid',
            notNull: true,
            references: 'habits',
            onDelete: 'CASCADE',
        },
        day_of_week: { type: 'integer', notNull: true },
    });

    pgm.addConstraint('habit_schedules', 'day_of_week_range', {
        check: 'day_of_week >= 0 AND day_of_week <= 6',
    });
};

exports.down = (pgm) => {
    pgm.dropTable('habit_schedules');
};