exports.up = (pgm) => {
  pgm.addColumn('users', {
    deleted_at: { type: 'timestamptz', notNull: false },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn('users', 'deleted_at');
};
