exports.up = (pgm) => {
  // 1. Create ai_conversations table
  pgm.createTable('ai_conversations', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    title: {
      type: 'text',
      notNull: false,
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.createIndex('ai_conversations', 'user_id', {
    name: 'idx_ai_conversations_user_id',
  });

  pgm.createIndex('ai_conversations', ['user_id', 'updated_at'], {
    name: 'idx_ai_conversations_user_id_updated_at',
  });

  // 2. Create ai_messages table
  pgm.createTable('ai_messages', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    conversation_id: {
      type: 'uuid',
      notNull: true,
      references: 'ai_conversations',
      onDelete: 'CASCADE',
    },
    role: {
      type: 'varchar(20)',
      notNull: true,
    },
    content: {
      type: 'text',
      notNull: true,
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.createIndex('ai_messages', 'conversation_id', {
    name: 'idx_ai_messages_conversation_id',
  });

  pgm.createIndex('ai_messages', ['conversation_id', 'created_at'], {
    name: 'idx_ai_messages_conversation_id_created_at',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('ai_messages');
  pgm.dropTable('ai_conversations');
};
