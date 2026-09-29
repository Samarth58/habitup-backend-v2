exports.up = async (pgm) => {
  // 1. Add original_name column to preserve the user's raw habit input
  pgm.addColumn('habits', {
    original_name: {
      type: 'varchar(255)',
    },
  });

  // 2. Backfill existing habits so original_name mirrors the stored name
  pgm.sql(`
    UPDATE habits
    SET original_name = name
    WHERE original_name IS NULL;
  `);
};

exports.down = (pgm) => {
  pgm.dropColumn('habits', 'original_name');
};
