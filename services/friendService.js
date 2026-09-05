const { Pool } = require('pg');
const { getUserByUsername } = require('./usernameService');
const {
  getHabitSchedule,
  getCompletionDates,
  getHabitsForUser,
  getUserTimezone,
} = require('./habitService');
const { calculateBestStreak, getUserOverallStats } = require('./statsService');
const { calculateStreak } = require('./streakService');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function serviceError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function getUserBestStreak(userId, timezone) {
  const { rows: habits } = await pool.query(
    `SELECT id, frequency_type FROM habits
     WHERE user_id = $1 AND deleted_at IS NULL`,
    [userId]
  );

  let bestStreak = 0;
  for (const habit of habits) {
    const schedule = await getHabitSchedule(habit.id);
    const completionDates = await getCompletionDates(userId, habit.id);
    bestStreak = Math.max(
      bestStreak,
      calculateBestStreak(habit.frequency_type, schedule, completionDates, timezone || 'UTC')
    );
  }
  return bestStreak;
}

async function sendFriendRequest(requesterId, recipientUsername) {
  const recipient = await getUserByUsername(recipientUsername);
  if (!recipient) throw serviceError('User not found', 404);
  if (requesterId === recipient.id) throw serviceError('Cannot add yourself as friend', 409);

  const existing = await pool.query(
    `SELECT id, status FROM friend_requests
     WHERE (requester_id = $1 AND recipient_id = $2)
        OR (requester_id = $2 AND recipient_id = $1)`,
    [requesterId, recipient.id]
  );
  const request = existing.rows[0];
  if (request?.status === 'pending') throw serviceError('Friend request already sent', 409);
  if (request?.status === 'accepted' || await isFriendsWith(requesterId, recipient.id)) {
    throw serviceError('Already friends', 409);
  }

  const result = request?.status === 'rejected'
    ? await pool.query(
      `UPDATE friend_requests SET requester_id = $1, recipient_id = $2,
       status = 'pending', updated_at = NOW() WHERE id = $3
       RETURNING id AS request_id, requester_id AS from_user_id,
                 recipient_id AS to_user_id, status, created_at`,
      [requesterId, recipient.id, request.id]
    )
    : await pool.query(
      `INSERT INTO friend_requests (requester_id, recipient_id, status)
       VALUES ($1, $2, 'pending')
       RETURNING id AS request_id, requester_id AS from_user_id,
                 recipient_id AS to_user_id, status, created_at`,
      [requesterId, recipient.id]
    );

  return { ...result.rows[0], to_username: recipient.username };
}

async function getPendingFriendRequests(userId) {
  const { rows } = await pool.query(
    `SELECT fr.id AS request_id, fr.requester_id AS from_user_id,
            u.username AS from_username, u.created_at,
            COUNT(h.id)::int AS total_habits
     FROM friend_requests fr
     JOIN users u ON u.id = fr.requester_id AND u.deleted_at IS NULL
     LEFT JOIN habits h ON h.user_id = u.id AND h.deleted_at IS NULL
     WHERE fr.recipient_id = $1 AND fr.status = 'pending'
     GROUP BY fr.id, u.id
     ORDER BY fr.created_at DESC`,
    [userId]
  );
  return Promise.all(rows.map(async (row) => ({
    ...row,
    best_streak: await getUserBestStreak(row.from_user_id),
  })));
}

async function acceptFriendRequest(requestId, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT * FROM friend_requests WHERE id = $1 FOR UPDATE', [requestId]);
    const request = rows[0];
    if (!request) throw serviceError('Request not found', 404);
    if (request.recipient_id !== userId) throw serviceError('Not authorized to accept this request', 403);
    if (request.status !== 'pending') throw serviceError('Request is not pending', 409);

    const [userA, userB] = [request.requester_id, userId].sort();
    const { rows: friendshipRows } = await client.query(
      `INSERT INTO friendships (user_a_id, user_b_id, status)
       VALUES ($1, $2, 'accepted')
       RETURNING id AS friendship_id, user_a_id, user_b_id, status, created_at`,
      [userA, userB]
    );
    await client.query(
      `UPDATE friend_requests SET status = 'accepted', updated_at = NOW() WHERE id = $1`,
      [requestId]
    );
    await client.query('COMMIT');
    return friendshipRows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') throw serviceError('Already friends', 409);
    throw error;
  } finally {
    client.release();
  }
}

async function rejectFriendRequest(requestId, userId) {
  const { rows } = await pool.query('SELECT * FROM friend_requests WHERE id = $1', [requestId]);
  const request = rows[0];
  if (!request) throw serviceError('Request not found', 404);
  if (request.recipient_id !== userId) throw serviceError('Not authorized', 403);
  if (request.status !== 'pending') throw serviceError('Request is not pending', 409);
  await pool.query('DELETE FROM friend_requests WHERE id = $1', [requestId]);
  return { message: 'Friend request declined', request_id: requestId, status: 'rejected' };
}

async function getFriends(userId) {
  const { rows } = await pool.query(
    `SELECT CASE WHEN f.user_a_id = $1 THEN f.user_b_id ELSE f.user_a_id END AS friend_id,
            u.username, u.created_at, u.timezone, COUNT(h.id)::int AS total_habits
     FROM friendships f
     JOIN users u ON u.id = CASE WHEN f.user_a_id = $1 THEN f.user_b_id ELSE f.user_a_id END
       AND u.deleted_at IS NULL
     LEFT JOIN habits h ON h.user_id = u.id AND h.deleted_at IS NULL
     WHERE (f.user_a_id = $1 OR f.user_b_id = $1) AND f.status = 'accepted'
     GROUP BY f.id, u.id
     ORDER BY f.created_at DESC`,
    [userId]
  );
  return Promise.all(rows.map(async (row) => ({
    friend_id: row.friend_id,
    username: row.username,
    total_habits: row.total_habits,
    best_streak: await getUserBestStreak(row.friend_id, row.timezone),
    created_at: row.created_at,
  })));
}

async function isFriendsWith(userId1, userId2) {
  const { rowCount } = await pool.query(
    `SELECT id FROM friendships
     WHERE ((user_a_id = $1 AND user_b_id = $2) OR (user_a_id = $2 AND user_b_id = $1))
       AND status = 'accepted'`,
    [userId1, userId2]
  );
  return rowCount > 0;
}

async function removeFriend(userId, friendId) {
  const { rows } = await pool.query(
    `DELETE FROM friendships
     WHERE ((user_a_id = $1 AND user_b_id = $2) OR (user_a_id = $2 AND user_b_id = $1))
       AND status = 'accepted'
     RETURNING id AS friendship_id`,
    [userId, friendId]
  );
  if (!rows[0]) throw serviceError('Friend not found or not friends', 404);
  return { message: 'Friend removed', friendship_id: rows[0].friendship_id };
}

async function assertFriends(userId, friendId) {
  if (!(await isFriendsWith(userId, friendId))) {
    throw serviceError('Friend not found or not friends', 404);
  }
}

async function getFriendHabits(userId, friendId) {
  await assertFriends(userId, friendId);
  const timezone = await getUserTimezone(friendId);
  const habits = await getHabitsForUser(friendId);
  return Promise.all(habits.map(async (habit) => {
    const schedule = await getHabitSchedule(habit.id);
    const completionDates = await getCompletionDates(friendId, habit.id);
    return {
      ...habit,
      schedule,
      streak: calculateStreak(habit.frequency_type, schedule, completionDates, timezone),
    };
  }));
}

async function getFriendStats(userId, friendId, period = 'month') {
  await assertFriends(userId, friendId);
  const timezone = await getUserTimezone(friendId);
  return getUserOverallStats(friendId, timezone, period);
}

module.exports = {
  sendFriendRequest,
  getPendingFriendRequests,
  acceptFriendRequest,
  rejectFriendRequest,
  getFriends,
  isFriendsWith,
  removeFriend,
  getFriendHabits,
  getFriendStats,
};