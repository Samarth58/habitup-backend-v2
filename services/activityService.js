const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const ALLOWED_ACTIVITY_TYPES = new Set([
  'LOGIN',
  'LOGOUT',
  'LOGOUT_ALL',
  'REGISTER',
  'HABIT_CREATED',
  'HABIT_UPDATED',
  'HABIT_DELETED',
  'HABIT_COMPLETED',
  'HABIT_UNCOMPLETED',
  'HABIT_PAUSED',
  'HABIT_UNPAUSED',
  'HABIT_ARCHIVED',
  'HABIT_UNARCHIVED',
  'REMINDER_CREATED',
  'REMINDER_UPDATED',
  'REMINDER_DELETED',
  'PASSWORD_RESET_REQUESTED',
  'PASSWORD_RESET_COMPLETED',
  'ACCOUNT_DELETED',
]);

const ALLOWED_METADATA_KEYS = {
  HABIT_CREATED: ['habit_id'],
  HABIT_UPDATED: ['habit_id'],
  HABIT_DELETED: ['habit_id'],
  HABIT_COMPLETED: ['habit_id'],
  HABIT_UNCOMPLETED: ['habit_id'],
  HABIT_PAUSED: ['habit_id'],
  HABIT_UNPAUSED: ['habit_id'],
  HABIT_ARCHIVED: ['habit_id'],
  HABIT_UNARCHIVED: ['habit_id'],
  REMINDER_CREATED: ['reminder_id', 'habit_id'],
  REMINDER_UPDATED: ['reminder_id'],
  REMINDER_DELETED: ['reminder_id'],
};

/**
 * Filters metadata strictly against an explicit per-type allow-list.
 * Ensures no passwords, hashes, tokens, emails, or PII can ever be saved.
 */
function sanitizeMetadata(activityType, rawMetadata) {
  if (!rawMetadata || typeof rawMetadata !== 'object') {
    return null;
  }

  const allowedKeys = ALLOWED_METADATA_KEYS[activityType];
  if (!allowedKeys || allowedKeys.length === 0) {
    return null;
  }

  const clean = {};
  for (const key of allowedKeys) {
    if (Object.prototype.hasOwnProperty.call(rawMetadata, key) && rawMetadata[key] !== undefined) {
      clean[key] = rawMetadata[key];
    }
  }

  return Object.keys(clean).length > 0 ? clean : null;
}

/**
 * Logs a privacy-conscious user activity event.
 *
 * @param {string} userId
 * @param {string} activityType
 * @param {object} [metadata]
 */
async function logActivity(userId, activityType, metadata = null) {
  if (!ALLOWED_ACTIVITY_TYPES.has(activityType)) {
    console.warn(`[logActivity] Ignored unrecognized activityType: ${activityType}`);
    return;
  }

  const cleanMetadata = sanitizeMetadata(activityType, metadata);

  await pool.query(
    `INSERT INTO user_activity (user_id, activity_type, metadata)
     VALUES ($1, $2, $3)`,
    [userId || null, activityType, cleanMetadata ? JSON.stringify(cleanMetadata) : null]
  );
}

/**
 * Retrieves a paginated list of activity events for administrative review.
 *
 * @param {object} params
 * @param {string} [params.userId]
 * @param {string} [params.activityType]
 * @param {string} [params.from] ISO date/timestamp
 * @param {string} [params.to] ISO date/timestamp
 * @param {number} [params.page=1]
 * @param {number} [params.limit=50]
 * @returns {Promise<{ events: Array<object>, pagination: { page: number, limit: number, total: number, totalPages: number } }>}
 */
async function getActivityFeed({ userId, activityType, from, to, page = 1, limit = 50 }) {
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
  const offset = (safePage - 1) * safeLimit;

  const conditions = [];
  const queryParams = [];

  if (userId) {
    queryParams.push(userId);
    conditions.push(`user_id = $${queryParams.length}`);
  }

  if (activityType) {
    queryParams.push(activityType);
    conditions.push(`activity_type = $${queryParams.length}`);
  }

  if (from) {
    queryParams.push(from);
    conditions.push(`created_at >= $${queryParams.length}`);
  }

  if (to) {
    queryParams.push(to);
    conditions.push(`created_at <= $${queryParams.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const dataQuery = `
    SELECT id, user_id, activity_type, metadata, created_at,
           COUNT(*) OVER() AS total_count
    FROM user_activity
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
  `;

  const { rows } = await pool.query(dataQuery, [...queryParams, safeLimit, offset]);

  const total = rows.length > 0 ? parseInt(rows[0].total_count, 10) : 0;
  const totalPages = Math.ceil(total / safeLimit) || 1;

  const events = rows.map(({ total_count, activity_type, metadata, ...rest }) => ({
    ...rest,
    activity_type,
    metadata: sanitizeMetadata(activity_type, metadata),
  }));

  return {
    events,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages,
    },
  };
}

/**
 * Returns daily aggregate counts by activity_type for charts.
 *
 * @param {string} from ISO date/timestamp
 * @param {string} to ISO date/timestamp
 * @returns {Promise<{ from: string, to: string, summary: object, daily: Array<object> }>}
 */
async function getActivityAggregates(from, to) {
  const summaryQuery = `
    SELECT activity_type, COUNT(*)::int AS count
    FROM user_activity
    WHERE created_at >= $1 AND created_at <= $2
    GROUP BY activity_type
  `;
  const { rows: summaryRows } = await pool.query(summaryQuery, [from, to]);

  const byTypeSummary = {};
  let totalEvents = 0;
  for (const r of summaryRows) {
    byTypeSummary[r.activity_type] = r.count;
    totalEvents += r.count;
  }

  const dailyQuery = `
    SELECT
      to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
      activity_type,
      COUNT(*)::int AS count
    FROM user_activity
    WHERE created_at >= $1 AND created_at <= $2
    GROUP BY 1, 2
    ORDER BY 1 ASC
  `;
  const { rows: dailyRows } = await pool.query(dailyQuery, [from, to]);

  const dailyMap = {};
  for (const r of dailyRows) {
    if (!dailyMap[r.date]) {
      dailyMap[r.date] = { date: r.date, total: 0, by_type: {} };
    }
    dailyMap[r.date].by_type[r.activity_type] = r.count;
    dailyMap[r.date].total += r.count;
  }

  return {
    from,
    to,
    summary: {
      total_events: totalEvents,
      by_type: byTypeSummary,
    },
    daily: Object.values(dailyMap),
  };
}

module.exports = {
  ALLOWED_ACTIVITY_TYPES,
  logActivity,
  getActivityFeed,
  getActivityAggregates,
};
