exports.up = (pgm) => {
  pgm.createTable('experiments', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    name: { type: 'varchar(100)', notNull: true, unique: true },
    description: { type: 'text', notNull: false },
    status: { type: 'varchar(20)', notNull: true, default: 'RUNNING' }, // RUNNING, PAUSED, COMPLETED
    allocation: { type: 'jsonb', notNull: true, default: '{"A": 0.5, "B": 0.5}' },
    variants: { type: 'jsonb', notNull: true, default: '["A", "B"]' },
    primary_metric: { type: 'varchar(50)', notNull: true, default: 'd7_retention' },
    experiment_type: { type: 'varchar(50)', notNull: true, default: 'feature_gate' },
    target_sample_size: { type: 'integer', notNull: false, default: 200 },
    start_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    end_at: { type: 'timestamptz', notNull: false },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('experiments', ['status'], { name: 'idx_experiments_status' });
  pgm.createIndex('experiments', ['name'], { name: 'idx_experiments_name' });

  pgm.createTable('user_experiments', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    experiment_id: {
      type: 'uuid',
      notNull: true,
      references: 'experiments',
      onDelete: 'CASCADE',
    },
    variant: { type: 'varchar(10)', notNull: true },
    assigned_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.addConstraint('user_experiments', 'user_experiments_user_id_experiment_id_key', {
    unique: ['user_id', 'experiment_id'],
  });

  pgm.createIndex('user_experiments', ['experiment_id', 'variant'], {
    name: 'idx_user_experiments_exp_variant',
  });
  pgm.createIndex('user_experiments', ['user_id', 'experiment_id'], {
    name: 'idx_user_experiments_user_exp',
  });

  // Seed default friends_feature_v1 experiment
  pgm.sql(`
    INSERT INTO experiments (name, description, status, allocation, variants, primary_metric, experiment_type, target_sample_size, start_at)
    VALUES (
      'friends_feature_v1',
      'Measure whether enabling the Friends feature improves user retention and habit engagement.',
      'RUNNING',
      '{"A": 0.5, "B": 0.5}',
      '["A", "B"]',
      'd7_retention',
      'feature_gate',
      200,
      NOW()
    )
    ON CONFLICT (name) DO NOTHING;
  `);
};

exports.down = (pgm) => {
  pgm.dropTable('user_experiments');
  pgm.dropTable('experiments');
};
