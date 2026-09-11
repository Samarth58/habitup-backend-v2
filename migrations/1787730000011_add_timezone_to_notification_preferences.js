exports.up = (pgm) => {
  pgm.addColumn('notification_preferences', {
    timezone: {
      type: 'varchar(100)',
      notNull: true,
      default: 'UTC',
    },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn('notification_preferences', 'timezone');
};
