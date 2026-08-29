const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'HabitUp API',
      version: '1.0.0',
      description: 'Backend API for the HabitUp daily habit tracker',
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Access token obtained from /auth/login or /auth/register',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Something went wrong.' },
          },
        },
        User: {
          type: 'object',
          properties: {
            id:         { type: 'string', format: 'uuid' },
            name:       { type: 'string', example: 'Samarth' },
            email:      { type: 'string', format: 'email' },
            timezone:   { type: 'string', example: 'Asia/Kolkata' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Habit: {
          type: 'object',
          properties: {
            id:             { type: 'string', format: 'uuid' },
            user_id:        { type: 'string', format: 'uuid' },
            name:           { type: 'string', example: 'Morning Run' },
            description:    { type: 'string', example: 'Run 5km every morning', nullable: true },
            icon:           { type: 'string', example: '🏃', nullable: true },
            color:          { type: 'string', example: '#FF5733', nullable: true },
            frequency_type: { type: 'string', enum: ['daily', 'scheduled'] },
            paused_at:      { type: 'string', format: 'date-time', nullable: true },
            archived_at:    { type: 'string', format: 'date-time', nullable: true },
            deleted_at:     { type: 'string', format: 'date-time', nullable: true },
            created_at:     { type: 'string', format: 'date-time' },
            schedule:       { type: 'array', items: { type: 'integer', minimum: 0, maximum: 6 }, example: [1, 3, 5] },
            streak:         { type: 'integer', example: 7 },
          },
        },
        Reminder: {
          type: 'object',
          properties: {
            id:         { type: 'string', format: 'uuid' },
            habit_id:   { type: 'string', format: 'uuid' },
            user_id:    { type: 'string', format: 'uuid' },
            time:       { type: 'string', example: '07:30' },
            enabled:    { type: 'boolean', example: true },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        HabitStats: {
          type: 'object',
          properties: {
            habit_id:          { type: 'string', format: 'uuid' },
            period:            { type: 'string', enum: ['month', 'year'] },
            current_streak:    { type: 'integer', example: 5 },
            best_streak:       { type: 'integer', example: 14 },
            total_completions: { type: 'integer', example: 21 },
            completion_rate:   { type: 'number', format: 'float', example: 0.75 },
          },
        },
        UserStats: {
          type: 'object',
          properties: {
            period:                  { type: 'string', enum: ['month', 'year'] },
            overall_completion_rate: { type: 'number', format: 'float', example: 0.68 },
            total_completions:       { type: 'integer', example: 45 },
            habits:                  { type: 'array', items: { $ref: '#/components/schemas/HabitStats' } },
          },
        },
      },
    },
    tags: [
      { name: 'Auth',      description: 'Authentication & account management' },
      { name: 'Habits',    description: 'Habit CRUD, state management, and completions' },
      { name: 'Reminders', description: 'Per-habit reminder management' },
      { name: 'Stats',     description: 'Habit and user-level statistics' },
    ],
  },
  apis: ['./routes/*.js'],
};

module.exports = swaggerJsdoc(options);
