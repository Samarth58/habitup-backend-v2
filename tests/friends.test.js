const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const { registerTestUser, authFetch, INVALID_UUID, VALID_UUID } = require('./helpers');

describe('Friends API', () => {
  let alice;
  let bob;
  let charlie;
  let requestId;

  before(async () => {
    alice = await registerTestUser({ username: `alice_${Date.now()}`.slice(0, 30) });
    bob = await registerTestUser({ username: `bob_${Date.now()}`.slice(0, 30) });
    charlie = await registerTestUser({ username: `charlie_${Date.now()}`.slice(0, 30) });
  });

  test('requires authentication', async () => {
    const response = await authFetch('/friends');
    assert.equal(response.status, 401);
  });

  test('requires a username when sending a request', async () => {
    const response = await authFetch('/friends/request', { method: 'POST', body: '{}' }, alice.accessToken);
    assert.equal(response.status, 400);
  });

  test('returns 404 for an unknown username', async () => {
    const response = await authFetch('/friends/request', {
      method: 'POST',
      body: JSON.stringify({ username: `missing_${Date.now()}` }),
    }, alice.accessToken);
    assert.equal(response.status, 404);
  });

  test('rejects a malformed request UUID before querying the database', async () => {
    const response = await authFetch('/friends/requests/not-a-uuid/accept', {
      method: 'POST',
    }, bob.accessToken);
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /invalid id format/i);
  });

  test('returns 404 for a well-formed nonexistent request UUID', async () => {
    const response = await authFetch(`/friends/requests/${VALID_UUID}/accept`, {
      method: 'POST',
    }, bob.accessToken);
    assert.equal(response.status, 404);
  });

  test('prevents sending a request to yourself', async () => {
    const response = await authFetch('/friends/request', {
      method: 'POST',
      body: JSON.stringify({ username: alice.username }),
    }, alice.accessToken);
    assert.equal(response.status, 409);
  });

  test('creates a pending request with case-insensitive username lookup', async () => {
    const response = await authFetch('/friends/request', {
      method: 'POST',
      body: JSON.stringify({ username: bob.username.toUpperCase() }),
    }, alice.accessToken);
    const body = await response.json();
    assert.equal(response.status, 201, JSON.stringify(body));
    assert.equal(body.status, 'pending');
    assert.equal(body.to_username, bob.username);
    requestId = body.request_id;
  });

  test('prevents duplicate pending requests in either direction', async () => {
    const response = await authFetch('/friends/request', {
      method: 'POST',
      body: JSON.stringify({ username: bob.username }),
    }, alice.accessToken);
    assert.equal(response.status, 409);
  });

  test('prevents the reverse-direction duplicate while the request is pending', async () => {
    const response = await authFetch('/friends/request', {
      method: 'POST',
      body: JSON.stringify({ username: alice.username }),
    }, bob.accessToken);
    assert.equal(response.status, 409);
  });

  test('shows pending requests only to the recipient', async () => {
    const response = await authFetch('/friends/requests', {}, bob.accessToken);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.pending_requests.length, 1);
    assert.equal(body.pending_requests[0].request_id, requestId);
    assert.equal(body.pending_requests[0].from_username, alice.username);
  });

  test('does not expose another user request through the wrong account', async () => {
    const response = await authFetch(`/friends/requests/${requestId}/accept`, {
      method: 'POST',
    }, charlie.accessToken);
    assert.equal(response.status, 403);
  });

  test('does not allow a non-friend to view friend habits or stats', async () => {
    const [habitsResponse, statsResponse] = await Promise.all([
      authFetch(`/friends/${bob.user.id}/habits`, {}, charlie.accessToken),
      authFetch(`/friends/${bob.user.id}/stats`, {}, charlie.accessToken),
    ]);
    assert.equal(habitsResponse.status, 404);
    assert.equal(statsResponse.status, 404);
  });

  test('validates friend read UUIDs and handles nonexistent users', async () => {
    const [invalidHabits, invalidStats, missingHabits, missingStats] = await Promise.all([
      authFetch(`/friends/${INVALID_UUID}/habits`, {}, alice.accessToken),
      authFetch(`/friends/${INVALID_UUID}/stats`, {}, alice.accessToken),
      authFetch(`/friends/${VALID_UUID}/habits`, {}, alice.accessToken),
      authFetch(`/friends/${VALID_UUID}/stats`, {}, alice.accessToken),
    ]);
    assert.equal(invalidHabits.status, 400);
    assert.equal(invalidStats.status, 400);
    assert.equal(missingHabits.status, 404);
    assert.equal(missingStats.status, 404);
  });

  test('accepts a pending request for the recipient', async () => {
    const habitResponse = await authFetch('/habits', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Bob friend-visible habit',
        frequency_type: 'daily',
      }),
    }, bob.accessToken);
    assert.equal(habitResponse.status, 201);

    const response = await authFetch(`/friends/requests/${requestId}/accept`, {
      method: 'POST',
    }, bob.accessToken);
    const body = await response.json();
    assert.equal(response.status, 200, JSON.stringify(body));
    assert.equal(body.status, 'accepted');
    assert.ok(body.friendship_id);
  });

  test('allows both friends to view active habits and aggregate stats', async () => {
    const [habitsResponse, statsResponse] = await Promise.all([
      authFetch(`/friends/${bob.user.id}/habits`, {}, alice.accessToken),
      authFetch(`/friends/${bob.user.id}/stats?period=month`, {}, alice.accessToken),
    ]);
    const habitsBody = await habitsResponse.json();
    const statsBody = await statsResponse.json();

    assert.equal(habitsResponse.status, 200, JSON.stringify(habitsBody));
    assert.ok(Array.isArray(habitsBody.habits));
    assert.ok(habitsBody.habits.some((habit) => habit.name === 'Bob friend-visible habit'));
    assert.equal(statsResponse.status, 200, JSON.stringify(statsBody));
    assert.ok(Array.isArray(statsBody.habits));
    assert.ok(statsBody.habits.some((habit) => habit.name === 'Bob friend-visible habit'));
    assert.equal(typeof statsBody.overall_completion_rate, 'number');
  });

  test('rejects accepting the same request twice', async () => {
    const response = await authFetch(`/friends/requests/${requestId}/accept`, {
      method: 'POST',
    }, bob.accessToken);
    assert.equal(response.status, 409);
  });

  test('rejects removal with an invalid or nonexistent friend UUID', async () => {
    const invalidResponse = await authFetch(`/friends/${INVALID_UUID}`, {
      method: 'DELETE',
    }, alice.accessToken);
    const missingResponse = await authFetch(`/friends/${VALID_UUID}`, {
      method: 'DELETE',
    }, alice.accessToken);
    assert.equal(invalidResponse.status, 400);
    assert.equal(missingResponse.status, 404);
  });

  test('prevents requests between existing friends', async () => {
    const response = await authFetch('/friends/request', {
      method: 'POST',
      body: JSON.stringify({ username: bob.username }),
    }, alice.accessToken);
    assert.equal(response.status, 409);
  });

  test('lists the accepted friend for both users', async () => {
    const [aliceResponse, bobResponse] = await Promise.all([
      authFetch('/friends', {}, alice.accessToken),
      authFetch('/friends', {}, bob.accessToken),
    ]);
    const aliceBody = await aliceResponse.json();
    const bobBody = await bobResponse.json();
    assert.equal(aliceBody.friends[0].username, bob.username);
    assert.equal(bobBody.friends[0].username, alice.username);
  });

  test('returns an empty list for a user without friends', async () => {
    const response = await authFetch('/friends', {}, charlie.accessToken);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(body.friends, []);
  });

  test('rejects a nonexistent friendship removal', async () => {
    const response = await authFetch(`/friends/${charlie.user.id}`, {
      method: 'DELETE',
    }, alice.accessToken);
    assert.equal(response.status, 404);
  });

  test('removes an accepted friend for both users', async () => {
    const response = await authFetch(`/friends/${bob.user.id}`, {
      method: 'DELETE',
    }, alice.accessToken);
    assert.equal(response.status, 200);

    const friendsResponse = await authFetch('/friends', {}, bob.accessToken);
    const body = await friendsResponse.json();
    assert.deepEqual(body.friends, []);
  });

  test('blocks friend habit and stats access after removal', async () => {
    const [habitsResponse, statsResponse] = await Promise.all([
      authFetch(`/friends/${bob.user.id}/habits`, {}, alice.accessToken),
      authFetch(`/friends/${bob.user.id}/stats`, {}, alice.accessToken),
    ]);
    assert.equal(habitsResponse.status, 404);
    assert.equal(statsResponse.status, 404);
  });

  test('supports a fresh request after a rejected request', async () => {
    const first = await authFetch('/friends/request', {
      method: 'POST',
      body: JSON.stringify({ username: charlie.username }),
    }, alice.accessToken);
    const firstBody = await first.json();
    assert.equal(first.status, 201);

    const unauthorizedReject = await authFetch(`/friends/requests/${firstBody.request_id}`, {
      method: 'DELETE',
    }, alice.accessToken);
    assert.equal(unauthorizedReject.status, 403);

    const rejected = await authFetch(`/friends/requests/${firstBody.request_id}`, {
      method: 'DELETE',
    }, charlie.accessToken);
    assert.equal(rejected.status, 200);

    const secondReject = await authFetch(`/friends/requests/${firstBody.request_id}`, {
      method: 'DELETE',
    }, charlie.accessToken);
    assert.equal(secondReject.status, 404);

    const second = await authFetch('/friends/request', {
      method: 'POST',
      body: JSON.stringify({ username: charlie.username }),
    }, alice.accessToken);
    assert.equal(second.status, 201);
  });
});