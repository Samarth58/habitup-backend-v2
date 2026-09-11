exports.up = (pgm) => {
  pgm.createIndex('password_reset_tokens', 'token_hash', {
    name: 'idx_password_reset_tokens_hash',
  });
};

exports.down = (pgm) => {
  pgm.dropIndex('password_reset_tokens', 'token_hash', {
    name: 'idx_password_reset_tokens_hash',
  });
};
