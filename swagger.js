const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'HabitUp API',
      version: '1.0.0',
      description: 'Backend API for the HabitUp daily habit tracker & Admin Dashboard',
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
            role:       { type: 'string', enum: ['user', 'admin'], example: 'user' },
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
        PaginationMeta: {
          type: 'object',
          properties: {
            page:       { type: 'integer', example: 1 },
            limit:      { type: 'integer', example: 20 },
            total:      { type: 'integer', example: 105 },
            totalPages: { type: 'integer', example: 6 },
          },
        },
        AdminDashboard: {
          type: 'object',
          properties: {
            period: { type: 'string', example: '7d' },
            from:   { type: 'string', format: 'date-time' },
            to:     { type: 'string', format: 'date-time' },
            users: {
              type: 'object',
              properties: {
                total:             { type: 'integer', example: 1024 },
                active_in_period:  { type: 'integer', example: 312 },
                new_in_period:     { type: 'integer', example: 45 },
                deleted_in_period: { type: 'integer', example: 3 },
                active_users_note: { type: 'string' },
              },
            },
            habits: {
              type: 'object',
              properties: {
                total:             { type: 'integer', example: 4820 },
                created_in_period: { type: 'integer', example: 110 },
              },
            },
            completions: {
              type: 'object',
              properties: {
                total:     { type: 'integer', example: 38400 },
                in_period: { type: 'integer', example: 2300 },
              },
            },
            reminders: {
              type: 'object',
              properties: {
                total: { type: 'integer', example: 1540 },
              },
            },
            sessions: {
              type: 'object',
              properties: {
                total_in_period:                { type: 'integer', example: 890 },
                estimated_avg_duration_seconds: { type: 'integer', example: 420 },
                estimated_total_usage_seconds:  { type: 'integer', example: 374100 },
                usage_note:                     { type: 'string' },
              },
            },
          },
        },
        AdminUser: {
          type: 'object',
          properties: {
            id:                      { type: 'string', format: 'uuid' },
            name:                    { type: 'string' },
            email:                   { type: 'string' },
            role:                    { type: 'string', enum: ['user', 'admin'] },
            status:                  { type: 'string', enum: ['active', 'deleted'] },
            created_at:              { type: 'string', format: 'date-time' },
            last_login:              { type: 'string', format: 'date-time', nullable: true },
            last_activity_at:        { type: 'string', format: 'date-time', nullable: true },
            total_habits:            { type: 'integer' },
            total_completions:       { type: 'integer' },
            estimated_usage_seconds: { type: 'integer' },
          },
        },
        AdminUserDetail: {
          type: 'object',
          properties: {
            id:                            { type: 'string', format: 'uuid' },
            name:                          { type: 'string' },
            email:                         { type: 'string' },
            role:                          { type: 'string' },
            timezone:                      { type: 'string' },
            status:                        { type: 'string' },
            created_at:                    { type: 'string', format: 'date-time' },
            deleted_at:                    { type: 'string', format: 'date-time', nullable: true },
            last_login:                    { type: 'string', format: 'date-time', nullable: true },
            last_activity_at:              { type: 'string', format: 'date-time', nullable: true },
            total_habits:                  { type: 'integer' },
            total_completions:             { type: 'integer' },
            current_streak_max:            { type: 'integer' },
            best_streak_max:               { type: 'integer' },
            estimated_total_usage_seconds: { type: 'integer' },
            estimated_avg_session_seconds: { type: 'integer' },
            total_sessions:                { type: 'integer' },
            recent_activity:               { type: 'array', items: { $ref: '#/components/schemas/ActivityEvent' } },
          },
        },
        ActivityEvent: {
          type: 'object',
          properties: {
            id:            { type: 'string', format: 'uuid' },
            user_id:       { type: 'string', format: 'uuid', nullable: true },
            activity_type: { type: 'string', example: 'HABIT_COMPLETED' },
            metadata:      { type: 'object', nullable: true },
            created_at:    { type: 'string', format: 'date-time' },
          },
        },
        UsageAnalytics: {
          type: 'object',
          properties: {
            from:       { type: 'string', format: 'date-time' },
            to:         { type: 'string', format: 'date-time' },
            usage_note: { type: 'string' },
            summary: {
              type: 'object',
              properties: {
                total_sessions:                { type: 'integer' },
                estimated_total_usage_seconds: { type: 'integer' },
                estimated_avg_session_seconds: { type: 'integer' },
                active_users:                  { type: 'integer' },
              },
            },
            daily:             { type: 'array', items: { type: 'object' } },
            most_active_users: { type: 'array', items: { type: 'object' } },
          },
        },
        ActivityAnalytics: {
          type: 'object',
          properties: {
            from:    { type: 'string', format: 'date-time' },
            to:      { type: 'string', format: 'date-time' },
            summary: {
              type: 'object',
              properties: {
                total_events: { type: 'integer' },
                by_type:      { type: 'object' },
              },
            },
            daily:   { type: 'array', items: { type: 'object' } },
          },
        },
      },
    },
    tags: [
      { name: 'Auth',      description: 'Authentication & account management' },
      { name: 'Habits',    description: 'Habit CRUD, state management, and completions' },
      { name: 'Reminders', description: 'Per-habit reminder management' },
      { name: 'Stats',     description: 'Habit and user-level statistics' },
      { name: 'Admin',     description: 'Administrative dashboard and analytics' },
    ],
  },
  apis: ['./routes/*.js'],
};

module.exports = swaggerJsdoc(options);
