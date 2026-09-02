exports.up = (pgm) => {
  pgm.addColumn('users', {
    role: { type: 'text', notNull: true, default: "'user'" },
  });
  pgm.addIndex('users', ['role'], { name: 'idx_users_role' });
};

exports.down = (pgm) => {
  pgm.dropIndex('users', ['role'], { name: 'idx_users_role', ifExists: true });
  pgm.dropColumn('users', 'role');
};
