exports.up = async (pgm) => {
  // 1. Add column username to users table (nullable initially for backfill)
  pgm.addColumn('users', {
    username: { type: 'varchar(30)' },
  });

  // 2. Backfill existing users (if any in production)
  pgm.sql(`
    UPDATE users
    SET username = 'user_' || SUBSTRING(id::text, 1, 8)
    WHERE username IS NULL;
  `);

  // 3. Enforce NOT NULL and UNIQUE constraints
  pgm.alterColumn('users', 'username', {
    notNull: true,
  });

  pgm.addConstraint('users', 'users_username_key', {
    unique: ['username'],
  });

  // 4. Create index for fast case-insensitive lookups
  pgm.createIndex('users', 'LOWER(username)', {
    name: 'idx_users_username',
  });
};

exports.down = (pgm) => {
  pgm.dropIndex('users', 'LOWER(username)', { name: 'idx_users_username', ifExists: true });
  pgm.dropConstraint('users', 'users_username_key', { ifExists: true });
  pgm.dropColumn('users', 'username');
};
