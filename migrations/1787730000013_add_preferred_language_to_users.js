exports.up = async (pgm) => {
  // 1. Add preferred_language column with default 'en'
  pgm.addColumn('users', {
    preferred_language: {
      type: 'varchar(10)',
      default: 'en',
    },
  });

  // 2. Safely backfill any existing users to 'en'
  pgm.sql(`
    UPDATE users
    SET preferred_language = 'en'
    WHERE preferred_language IS NULL;
  `);

  // 3. Enforce NOT NULL constraint
  pgm.alterColumn('users', 'preferred_language', {
    notNull: true,
    default: 'en',
  });

  // 4. Add CHECK constraint for supported languages
  pgm.addConstraint('users', 'users_preferred_language_check', {
    check: "preferred_language IN ('en', 'hi', 'te', 'ta', 'kn', 'ml', 'bn', 'mr', 'gu')",
  });
};

exports.down = (pgm) => {
  pgm.dropConstraint('users', 'users_preferred_language_check', { ifExists: true });
  pgm.dropColumn('users', 'preferred_language');
};
