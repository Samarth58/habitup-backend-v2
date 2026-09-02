const { Pool } = require('pg');
const { calculateStreak } = require('./streakService');
const { calculateBestStreak } = require('./statsService');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const MAX_SESSION_GAP_MINUTES = parseInt(process.env.MAX_SESSION_GAP_MINUTES, 10) || 120;

/**
 * Calculates start and end timestamps from a period string (e.g. '7d', '30d', '90d', '365d').
 */
function parsePeriod(periodStr = '7d') {
  const to = new Date();
  let days = 7;

  if (periodStr === '30d') days = 30;
  else if (periodStr === '90d') days = 90;
  else if (periodStr === '365d') days = 365;
  else if (periodStr === '1d') days = 1;

  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString(), period: `${days}d` };
}

/**
 * Aggregates high-level metrics for the Admin Dashboard.
 *
 * @param {object} params
 * @param {string} [params.period='7d']
 * @returns {Promise<object>}
 */
async function getDashboardStats({ period = '7d' } = {}) {
  const { from, to } = parsePeriod(period);

  const query = `
    WITH
    users_total AS (
      SELECT COUNT(*)::int AS count FROM users WHERE deleted_at IS NULL
    ),
    users_active AS (
      SELECT COUNT(DISTINCT user_id)::int AS count
      FROM user_activity
      WHERE created_at >= $1 AND created_at <= $2
        AND user_id IN (SELECT id FROM users WHERE deleted_at IS NULL)
    ),
    users_new AS (
      SELECT COUNT(*)::int AS count FROM users
      WHERE created_at >= $1 AND created_at <= $2 AND deleted_at IS NULL
    ),
    users_deleted AS (
      SELECT COUNT(*)::int AS count FROM users
      WHERE deleted_at >= $1 AND deleted_at <= $2
    ),
    habits_total AS (
      SELECT COUNT(*)::int AS count FROM habits WHERE deleted_at IS NULL
    ),
    habits_created AS (
      SELECT COUNT(*)::int AS count FROM habits
      WHERE created_at >= $1 AND created_at <= $2 AND deleted_at IS NULL
    ),
    completions_total AS (
      SELECT COUNT(*)::int AS count FROM habit_completions
    ),
    completions_in_period AS (
      SELECT COUNT(*)::int AS count FROM habit_completions
      WHERE completed_at >= $1 AND completed_at <= $2
    ),
    reminders_total AS (
      SELECT COUNT(*)::int AS count FROM reminders
    ),
    session_durations AS (
      SELECT
        id,
        GREATEST(
          0,
          EXTRACT(EPOCH FROM (
            LEAST(
              COALESCE(last_used_at, created_at),
              created_at + ($3 * INTERVAL '1 minute'),
              $2::timestamptz
            )
            - GREATEST(created_at, $1::timestamptz)
          ))
        ) AS duration_seconds
      FROM sessions
      WHERE created_at <= $2::timestamptz
        AND COALESCE(last_used_at, created_at) >= $1::timestamptz
    )
    SELECT
      (SELECT count FROM users_total) AS total_users,
      (SELECT count FROM users_active) AS active_users,
      (SELECT count FROM users_new) AS new_users,
      (SELECT count FROM users_deleted) AS deleted_users,
      (SELECT count FROM habits_total) AS total_habits,
      (SELECT count FROM habits_created) AS created_habits,
      (SELECT count FROM completions_total) AS total_completions,
      (SELECT count FROM completions_in_period) AS period_completions,
      (SELECT count FROM reminders_total) AS total_reminders,
      (SELECT COUNT(*)::int FROM session_durations) AS total_sessions,
      (SELECT COALESCE(AVG(duration_seconds), 0)::int FROM session_durations) AS avg_duration_seconds,
      (SELECT COALESCE(SUM(duration_seconds), 0)::int FROM session_durations) AS total_usage_seconds
  `;

  const { rows } = await pool.query(query, [from, to, MAX_SESSION_GAP_MINUTES]);
  const row = rows[0];

  return {
    period,
    from,
    to,
    users: {
      total: row.total_users,
      active_in_period: row.active_users,
      new_in_period: row.new_users,
      deleted_in_period: row.deleted_users,
      active_users_note: 'Non-deleted users with at least one recorded activity event in the selected period.',
    },
    habits: {
      total: row.total_habits,
      created_in_period: row.created_habits,
    },
    completions: {
      total: row.total_completions,
      in_period: row.period_completions,
    },
    reminders: {
      total: row.total_reminders,
    },
    sessions: {
      total_in_period: row.total_sessions,
      estimated_avg_duration_seconds: row.avg_duration_seconds,
      estimated_total_usage_seconds: row.total_usage_seconds,
      usage_note: `Estimated. Sessions without heartbeat data contribute 0 seconds. Durations are capped at ${MAX_SESSION_GAP_MINUTES} minutes gap and clipped to period bounds.`,
    },
  };
}

/**
 * Lists users for administrative management with pagination, filtering, and sorting.
 */
async function getUsersList({
  page = 1,
  limit = 20,
  email,
  role,
  status,
  sort = 'created_at',
  order = 'desc',
}) {
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (safePage - 1) * safeLimit;

  const conditions = [];
  const queryParams = [];

  if (email) {
    queryParams.push(`%${email}%`);
    conditions.push(`u.email ILIKE $${queryParams.length}`);
  }

  if (role) {
    queryParams.push(role);
    conditions.push(`u.role = $${queryParams.length}`);
  }

  if (status === 'active') {
    conditions.push(`u.deleted_at IS NULL`);
  } else if (status === 'deleted') {
    conditions.push(`u.deleted_at IS NOT NULL`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sortColumnMap = {
    created_at: 'u.created_at',
    email: 'u.email',
    last_activity: 'last_activity_at',
  };
  const sortCol = sortColumnMap[sort] || 'u.created_at';
  const sortOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const query = `
    WITH user_stats AS (
      SELECT
        u.id,
        u.name,
        u.email,
        u.role,
        u.created_at,
        u.deleted_at,
        (
          SELECT MAX(created_at)
          FROM user_activity
          WHERE user_id = u.id AND activity_type = 'LOGIN'
        ) AS last_login,
        (
          SELECT MAX(created_at)
          FROM user_activity
          WHERE user_id = u.id
        ) AS last_activity_at,
        (
          SELECT COUNT(*)::int
          FROM habits
          WHERE user_id = u.id AND deleted_at IS NULL
        ) AS total_habits,
        (
          SELECT COUNT(*)::int
          FROM habit_completions
          WHERE user_id = u.id
        ) AS total_completions,
        (
          SELECT COALESCE(SUM(
            GREATEST(
              0,
              EXTRACT(EPOCH FROM (
                LEAST(
                  COALESCE(last_used_at, created_at),
                  created_at + ($1 * INTERVAL '1 minute')
                ) - created_at
              ))
            )
          ), 0)::int
          FROM sessions
          WHERE user_id = u.id
        ) AS estimated_usage_seconds
      FROM users u
    )
    SELECT
      u.*,
      COUNT(*) OVER() AS total_count
    FROM user_stats u
    ${whereClause}
    ORDER BY ${sortCol} ${sortOrder} NULLS LAST
    LIMIT $${queryParams.length + 2} OFFSET $${queryParams.length + 3}
  `;

  const { rows } = await pool.query(query, [MAX_SESSION_GAP_MINUTES, ...queryParams, safeLimit, offset]);

  const total = rows.length > 0 ? parseInt(rows[0].total_count, 10) : 0;
  const totalPages = Math.ceil(total / safeLimit) || 1;

  const users = rows.map(({ total_count, deleted_at, ...rest }) => ({
    ...rest,
    status: deleted_at ? 'deleted' : 'active',
    deleted_at: deleted_at || null,
  }));

  return {
    users,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages,
    },
  };
}

/**
 * Returns complete administrative detail for a specific user ID.
 */
async function getUserDetail(userId) {
  const userQuery = `
    SELECT id, name, email, role, timezone, created_at, updated_at, deleted_at
    FROM users
    WHERE id = $1
  `;
  const { rows: userRows } = await pool.query(userQuery, [userId]);
  const user = userRows[0];

  if (!user) {
    return null;
  }

  const metricsQuery = `
    SELECT
      (
        SELECT MAX(created_at)
        FROM user_activity
        WHERE user_id = $1 AND activity_type = 'LOGIN'
      ) AS last_login,
      (
        SELECT MAX(created_at)
        FROM user_activity
        WHERE user_id = $1
      ) AS last_activity_at,
      (
        SELECT COUNT(*)::int
        FROM habits
        WHERE user_id = $1 AND deleted_at IS NULL
      ) AS total_habits,
      (
        SELECT COUNT(*)::int
        FROM habit_completions
        WHERE user_id = $1
      ) AS total_completions,
      (
        SELECT COUNT(*)::int
        FROM sessions
        WHERE user_id = $1
      ) AS total_sessions,
      (
        SELECT COALESCE(SUM(
          GREATEST(
            0,
            EXTRACT(EPOCH FROM (
              LEAST(
                COALESCE(last_used_at, created_at),
                created_at + ($2 * INTERVAL '1 minute')
              ) - created_at
            ))
          )
        ), 0)::int
        FROM sessions
        WHERE user_id = $1
      ) AS estimated_total_usage_seconds,
      (
        SELECT COALESCE(AVG(
          GREATEST(
            0,
            EXTRACT(EPOCH FROM (
              LEAST(
                COALESCE(last_used_at, created_at),
                created_at + ($2 * INTERVAL '1 minute')
              ) - created_at
            ))
          )
        ), 0)::int
        FROM sessions
        WHERE user_id = $1
      ) AS estimated_avg_session_seconds
  `;
  const { rows: metricRows } = await pool.query(metricsQuery, [userId, MAX_SESSION_GAP_MINUTES]);
  const metrics = metricRows[0];

  // Fetch habits and calculate streak metrics across habits
  const { rows: habits } = await pool.query(
    `SELECT id, frequency_type FROM habits WHERE user_id = $1 AND deleted_at IS NULL`,
    [userId]
  );

  let currentStreakMax = 0;
  let bestStreakMax = 0;

  for (const h of habits) {
    const { rows: schedRows } = await pool.query(
      `SELECT day_of_week FROM habit_schedules WHERE habit_id = $1`,
      [h.id]
    );
    const schedule = schedRows.map((r) => r.day_of_week);

    const { rows: compRows } = await pool.query(
      `SELECT to_char(completion_date, 'YYYY-MM-DD') AS cd FROM habit_completions WHERE habit_id = $1 AND user_id = $2`,
      [h.id, userId]
    );
    const completionDates = compRows.map((r) => r.cd);

    const cur = calculateStreak(h.frequency_type, schedule, completionDates, user.timezone || 'UTC');
    const best = calculateBestStreak(h.frequency_type, schedule, completionDates, user.timezone || 'UTC');

    if (cur > currentStreakMax) currentStreakMax = cur;
    if (best > bestStreakMax) bestStreakMax = best;
  }

  // Fetch 10 most recent activity events
  const { rows: recentActivity } = await pool.query(
    `SELECT id, activity_type, metadata, created_at
     FROM user_activity
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 10`,
    [userId]
  );

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      timezone: user.timezone,
      status: user.deleted_at ? 'deleted' : 'active',
      created_at: user.created_at,
      deleted_at: user.deleted_at || null,
      last_login: metrics.last_login || null,
      last_activity_at: metrics.last_activity_at || null,
      total_habits: metrics.total_habits,
      total_completions: metrics.total_completions,
      current_streak_max: currentStreakMax,
      best_streak_max: bestStreakMax,
      estimated_total_usage_seconds: metrics.estimated_total_usage_seconds,
      estimated_avg_session_seconds: metrics.estimated_avg_session_seconds,
      total_sessions: metrics.total_sessions,
      recent_activity: recentActivity,
    },
  };
}

/**
 * Returns usage and session analytics suitable for charts within a date range.
 */
async function getUsageAnalytics({ period, from: customFrom, to: customTo }) {
  let from, to;
  if (customFrom && customTo) {
    from = customFrom;
    to = customTo;
  } else {
    const parsed = parsePeriod(period || '7d');
    from = parsed.from;
    to = parsed.to;
  }

  const summaryQuery = `
    SELECT
      COUNT(*)::int AS total_sessions,
      COALESCE(SUM(
        GREATEST(
          0,
          EXTRACT(EPOCH FROM (
            LEAST(
              COALESCE(last_used_at, created_at),
              created_at + ($3 * INTERVAL '1 minute'),
              $2::timestamptz
            ) - GREATEST(created_at, $1::timestamptz)
          ))
        )
      ), 0)::int AS estimated_total_usage_seconds,
      COALESCE(AVG(
        GREATEST(
          0,
          EXTRACT(EPOCH FROM (
            LEAST(
              COALESCE(last_used_at, created_at),
              created_at + ($3 * INTERVAL '1 minute'),
              $2::timestamptz
            ) - GREATEST(created_at, $1::timestamptz)
          ))
        )
      ), 0)::int AS estimated_avg_session_seconds,
      COUNT(DISTINCT user_id)::int AS active_users
    FROM sessions
    WHERE created_at <= $2::timestamptz
      AND COALESCE(last_used_at, created_at) >= $1::timestamptz
  `;
  const { rows: summaryRows } = await pool.query(summaryQuery, [from, to, MAX_SESSION_GAP_MINUTES]);
  const summary = summaryRows[0];

  const dailyQuery = `
    SELECT
      to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
      COUNT(*)::int AS sessions,
      COUNT(DISTINCT user_id)::int AS active_users,
      COALESCE(SUM(
        GREATEST(
          0,
          EXTRACT(EPOCH FROM (
            LEAST(
              COALESCE(last_used_at, created_at),
              created_at + ($3 * INTERVAL '1 minute'),
              $2::timestamptz
            ) - GREATEST(created_at, $1::timestamptz)
          ))
        )
      ), 0)::int AS estimated_usage_seconds
    FROM sessions
    WHERE created_at <= $2::timestamptz
      AND COALESCE(last_used_at, created_at) >= $1::timestamptz
    GROUP BY 1
    ORDER BY 1 ASC
  `;
  const { rows: dailyRows } = await pool.query(dailyQuery, [from, to, MAX_SESSION_GAP_MINUTES]);

  const topUsersQuery = `
    SELECT
      s.user_id,
      u.email,
      COUNT(*)::int AS session_count,
      COALESCE(SUM(
        GREATEST(
          0,
          EXTRACT(EPOCH FROM (
            LEAST(
              COALESCE(s.last_used_at, s.created_at),
              s.created_at + ($3 * INTERVAL '1 minute'),
              $2::timestamptz
            ) - GREATEST(s.created_at, $1::timestamptz)
          ))
        )
      ), 0)::int AS estimated_usage_seconds
    FROM sessions s
    LEFT JOIN users u ON s.user_id = u.id
    WHERE s.created_at <= $2::timestamptz
      AND COALESCE(s.last_used_at, s.created_at) >= $1::timestamptz
    GROUP BY s.user_id, u.email
    ORDER BY estimated_usage_seconds DESC
    LIMIT 10
  `;
  const { rows: topUsers } = await pool.query(topUsersQuery, [from, to, MAX_SESSION_GAP_MINUTES]);

  return {
    from,
    to,
    usage_note: `Estimated. Sessions without heartbeat data contribute 0 seconds. Durations are capped at ${MAX_SESSION_GAP_MINUTES} minutes gap and clipped to period bounds.`,
    summary: {
      total_sessions: summary.total_sessions,
      estimated_total_usage_seconds: summary.estimated_total_usage_seconds,
      estimated_avg_session_seconds: summary.estimated_avg_session_seconds,
      active_users: summary.active_users,
    },
    daily: dailyRows,
    most_active_users: topUsers,
  };
}

module.exports = {
  parsePeriod,
  getDashboardStats,
  getUsersList,
  getUserDetail,
  getUsageAnalytics,
};
