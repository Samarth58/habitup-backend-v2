const { pool } = require('./db');
const { getUserByUsername } = require('./usernameService');
const {
  getHabitSchedule,
  getCompletionDates,
  getHabitsForUser,
  getUserTimezone,
} = require('./habitService');
const { calculateBestStreak, getUserOverallStats } = require('./statsService');
const { calculateStreak } = require('./streakService');
const { logActivity } = require('./activityService');
const { getDeviceTokensByUserId, deleteDeviceToken } = require('./deviceTokenService');
const notificationService = require('./notificationService');
const { getLocalizedNotification } = require('./translationService');
const { getUserNotificationLanguage } = require('./userLanguageService');

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
  if (await isFriendsWith(requesterId, recipient.id)) {
    throw serviceError('Already friends', 409);
  }

  const result = request
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

  logActivity(requesterId, 'FRIEND_REQUEST_SENT', {
    request_id: result.rows[0].request_id,
    recipient_id: recipient.id,
    recipient_username: recipient.username,
  }).catch((err) => console.error('[sendFriendRequest activity]', err));

  if (notificationService.isFirebaseConfigured()) {
    try {
      const tokens = await getDeviceTokensByUserId(recipient.id);
      console.log(`[sendFriendRequest notification] recipient=${recipient.id} tokens=${tokens.length}`);

      if (tokens.length > 0) {
        const { rows: requesterRows } = await pool.query(
          `SELECT name, username FROM users WHERE id = $1 AND deleted_at IS NULL`,
          [requesterId]
        );
        const requester = requesterRows[0];
        const requesterName = requester?.name || requester?.username || 'Someone';

        const recipientLang = await getUserNotificationLanguage(recipient.id);
        const { title, body } = getLocalizedNotification('friend_request', recipientLang, {
          name: requesterName,
        });

        const data = {
          type: 'friend_request',
          requestId: String(result.rows[0].request_id),
          senderId: String(requesterId),
        };

        await Promise.allSettled(
          tokens.map(async ({ token, id: tokenId }) => {
            try {
              const sendRes = await notificationService.sendPushNotification(token, { title, body, data });
              console.log(
                `[sendFriendRequest notification] Push SUCCESS for recipient=${recipient.id} tokenId=${tokenId} messageId=${sendRes.messageId}`
              );
              return sendRes;
            } catch (sendErr) {
              console.error(
                `[sendFriendRequest notification] Push FAILED for recipient=${recipient.id} tokenId=${tokenId}:`,
                sendErr.code || sendErr.message
              );

              if (
                sendErr.code === 'messaging/invalid-registration-token' ||
                sendErr.code === 'messaging/registration-token-not-registered' ||
                sendErr.code === 'messaging/invalid-argument' ||
                (sendErr.message && sendErr.message.includes('not a valid FCM registration token'))
              ) {
                try {
                  await deleteDeviceToken(token);
                  console.log(
                    `[sendFriendRequest notification] Pruned invalid device token (tokenId=${tokenId}) for user ${recipient.id}`
                  );
                } catch (pruneErr) {
                  console.error(`[sendFriendRequest notification] Failed to prune invalid token:`, pruneErr.message);
                }
              }
              throw sendErr;
            }
          })
        );
      }
    } catch (notifyErr) {
      console.error('[sendFriendRequest notification] Non-blocking notification error:', notifyErr.message);
    }
  }

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

    logActivity(userId, 'FRIEND_REQUEST_ACCEPTED', {
      request_id: requestId,
      friendship_id: friendshipRows[0].friendship_id,
      requester_id: request.requester_id,
    }).catch((err) => console.error('[acceptFriendRequest activity]', err));

    if (notificationService.isFirebaseConfigured()) {
      try {
        const tokens = await getDeviceTokensByUserId(request.requester_id);
        if (tokens.length > 0) {
          const { rows: acceptingUserRows } = await pool.query(
            `SELECT name, username FROM users WHERE id = $1 AND deleted_at IS NULL`,
            [userId]
          );
          const acceptingUser = acceptingUserRows[0];
          const acceptingUserName = acceptingUser?.name || acceptingUser?.username || 'Someone';

          const requesterLang = await getUserNotificationLanguage(request.requester_id);
          const { title, body } = getLocalizedNotification('friend_request_accepted', requesterLang, {
            name: acceptingUserName,
          });

          const data = {
            type: 'friend_request_accepted',
            requestId: String(requestId),
            acceptingUserId: String(userId),
          };

          await Promise.allSettled(
            tokens.map(async ({ token }) => {
              try {
                return await notificationService.sendPushNotification(token, { title, body, data });
              } catch (_) {}
            })
          );
        }
      } catch (notifyErr) {
        console.error('[acceptFriendRequest notification] Non-blocking notification error:', notifyErr.message);
      }
    }

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

  logActivity(userId, 'FRIEND_REMOVED', {
    friend_id: friendId,
    friendship_id: rows[0].friendship_id,
  }).catch((err) => console.error('[removeFriend activity]', err));

  return { message: 'Friend removed', friendship_id: rows[0].friendship_id };
}

async function assertFriends(userId, friendId) {
  if (!(await isFriendsWith(userId, friendId))) {
    throw serviceError('Friend not found or not friends', 404);
  }
}

async function sendNudge(senderId, friendId, habitName = '') {
  if (senderId === friendId) {
    throw serviceError('Cannot nudge yourself', 400);
  }

  await assertFriends(senderId, friendId);

  const { rows } = await pool.query(
    `SELECT name, username FROM users WHERE id = $1 AND deleted_at IS NULL`,
    [senderId]
  );
  const sender = rows[0];
  if (!sender) throw serviceError('User not found', 404);

  const tokens = await getDeviceTokensByUserId(friendId);
  if (tokens.length === 0) {
    return {
      success: true,
      sent: false,
      message: 'Nudge accepted, but the recipient has no registered device.',
      attempted: 0,
      delivered: 0,
      failed: 0,
    };
  }

  if (!notificationService.isFirebaseConfigured()) {
    throw serviceError('Firebase Admin SDK is not configured.', 503);
  }

  const cleanHabitName = habitName || '';
  const recipientLang = await getUserNotificationLanguage(friendId);
  const senderName = sender.name || sender.username || 'Someone';

  const { title, body } = cleanHabitName
    ? getLocalizedNotification('friend_nudge_habit', recipientLang, {
        name: senderName,
        habitName: cleanHabitName,
      })
    : getLocalizedNotification('friend_nudge_general', recipientLang, {
        name: senderName,
      });

  const results = await Promise.allSettled(tokens.map(({ token }) => notificationService.sendPushNotification(token, {
    title,
    body,
    data: {
      type: 'friend_nudge',
      senderId,
      recipientId: friendId,
      habitName: cleanHabitName,
    },
  })));
  const delivered = results.filter((result) => result.status === 'fulfilled').length;
  const failed = results.length - delivered;

  if (delivered === 0) {
    throw results.find((result) => result.status === 'rejected').reason;
  }

  return {
    success: true,
    sent: true,
    message: 'Nudge sent successfully',
    attempted: results.length,
    delivered,
    failed,
  };
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
  assertFriends,
  sendNudge,
  getFriendHabits,
  getFriendStats,
};