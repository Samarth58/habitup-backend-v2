const friendService = require('../services/friendService');

function getUserId(req) {
  return req.userId || req.user?.sub;
}

function handleError(res, error, fallback) {
  if (error.status) return res.status(error.status).json({ error: error.message });
  console.error(fallback, error);
  return res.status(500).json({ error: fallback });
}

async function sendFriendRequest(req, res) {
  const username = req.body?.username;
  if (!username || typeof username !== 'string' || !username.trim()) {
    return res.status(400).json({ error: 'Username required' });
  }
  try {
    return res.status(201).json(await friendService.sendFriendRequest(getUserId(req), username));
  } catch (error) {
    return handleError(res, error, 'Failed to send friend request');
  }
}

async function getPendingRequests(req, res) {
  try {
    return res.json({ pending_requests: await friendService.getPendingFriendRequests(getUserId(req)) });
  } catch (error) {
    return handleError(res, error, 'Failed to fetch pending friend requests');
  }
}

async function acceptFriendRequest(req, res) {
  try {
    return res.json(await friendService.acceptFriendRequest(req.params.requestId, getUserId(req)));
  } catch (error) {
    return handleError(res, error, 'Failed to accept friend request');
  }
}

async function rejectFriendRequest(req, res) {
  try {
    return res.json(await friendService.rejectFriendRequest(req.params.requestId, getUserId(req)));
  } catch (error) {
    return handleError(res, error, 'Failed to reject friend request');
  }
}

async function getFriends(req, res) {
  try {
    return res.json({ friends: await friendService.getFriends(getUserId(req)) });
  } catch (error) {
    return handleError(res, error, 'Failed to fetch friends');
  }
}

async function removeFriend(req, res) {
  try {
    return res.json(await friendService.removeFriend(getUserId(req), req.params.friendId));
  } catch (error) {
    return handleError(res, error, 'Failed to remove friend');
  }
}

async function getFriendHabits(req, res) {
  try {
    return res.json({ habits: await friendService.getFriendHabits(getUserId(req), req.params.friendId) });
  } catch (error) {
    return handleError(res, error, 'Failed to fetch friend habits');
  }
}

async function getFriendStats(req, res) {
  try {
    return res.json(await friendService.getFriendStats(
      getUserId(req),
      req.params.friendId,
      req.query.period || 'month'
    ));
  } catch (error) {
    return handleError(res, error, 'Failed to fetch friend stats');
  }
}

module.exports = {
  sendFriendRequest,
  getPendingRequests,
  acceptFriendRequest,
  rejectFriendRequest,
  getFriends,
  removeFriend,
  getFriendHabits,
  getFriendStats,
};