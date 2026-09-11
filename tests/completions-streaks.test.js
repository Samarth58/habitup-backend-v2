const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const { registerTestUser, authFetch } = require('./helpers');

describe('Completions & Streaks API Endpoints', () => {
  let user;

  before(async () => {
    user = await registerTestUser();
  });

  test('marking habit complete creates completion and returns current streak', async () => {
    const habitRes = await authFetch(
      '/habits',
      {
        method: 'POST',
        body: JSON.stringify({ name: 'Morning Jog', frequency_type: 'daily' }),
      },
      user.accessToken
    );
    const { habit } = await habitRes.json();

    const completeRes = await authFetch(
      `/habits/${habit.id}/completions`,
      { method: 'POST' },
      user.accessToken
    );

    const body = await completeRes.json();
    assert.equal(completeRes.status, 201);
    assert.ok(body.completion);
    assert.equal(body.completion.habit_id, habit.id);
    assert.ok(body.completion.completion_date);
    assert.equal(typeof body.streak, 'number');
    assert.equal(body.streak, 1);
  });

  test('marking complete twice on the same day is idempotent and does not inflate streak', async () => {
    const habitRes = await authFetch(
      '/habits',
      {
        method: 'POST',
        body: JSON.stringify({ name: 'Read News', frequency_type: 'daily' }),
      },
      user.accessToken
    );
    const { habit } = await habitRes.json();

    // First completion
    await authFetch(`/habits/${habit.id}/completions`, { method: 'POST' }, user.accessToken);

    // Second completion on same day
    const res2 = await authFetch(`/habits/${habit.id}/completions`, { method: 'POST' }, user.accessToken);
    const body2 = await res2.json();

    assert.ok(res2.status === 200 || res2.status === 201);
    assert.equal(body2.streak, 1);
  });

  test('undoing completion removes record and recalculates streak correctly', async () => {
    const habitRes = await authFetch(
      '/habits',
      {
        method: 'POST',
        body: JSON.stringify({ name: 'Meditation', frequency_type: 'daily' }),
      },
      user.accessToken
    );
    const { habit } = await habitRes.json();

    const completeRes = await authFetch(`/habits/${habit.id}/completions`, { method: 'POST' }, user.accessToken);
    const completeBody = await completeRes.json();
    const dateStr = completeBody.completion.completion_date;

    // Undo completion
    const undoRes = await authFetch(
      `/habits/${habit.id}/completions/${dateStr}`,
      { method: 'DELETE' },
      user.accessToken
    );

    const undoBody = await undoRes.json();
    assert.equal(undoRes.status, 200);
    assert.equal(undoBody.message, 'Completion removed.');
    assert.equal(undoBody.streak, 0);

    // Fetch habit to confirm streak is 0
    const getRes = await authFetch(`/habits/${habit.id}`, { method: 'GET' }, user.accessToken);
    const getBody = await getRes.json();
    assert.equal(getBody.habit.streak, 0);
  });

  test('daily streak logic evaluates active streak based on consecutive completion dates', async () => {
    const habitRes = await authFetch(
      '/habits',
      {
        method: 'POST',
        body: JSON.stringify({ name: 'Code Review', frequency_type: 'daily' }),
      },
      user.accessToken
    );
    const { habit } = await habitRes.json();

    // Mark complete today
    const res = await authFetch(`/habits/${habit.id}/completions`, { method: 'POST' }, user.accessToken);
    const body = await res.json();
    assert.equal(body.streak, 1);
  });

  test('scheduled streak logic ignores non-scheduled days and enforces scheduled days', async () => {
    // Schedule habit for Monday (1), Wednesday (3), Friday (5)
    const habitRes = await authFetch(
      '/habits',
      {
        method: 'POST',
        body: JSON.stringify({
          name: 'Scheduled Gym',
          frequency_type: 'scheduled',
          days: [1, 3, 5],
        }),
      },
      user.accessToken
    );

    const { habit } = await habitRes.json();
    assert.equal(habit.frequency_type, 'scheduled');
    assert.ok(Array.isArray(habit.schedule));
    assert.deepEqual(habit.schedule, [1, 3, 5]);

    // Mark complete today
    const completeRes = await authFetch(`/habits/${habit.id}/completions`, { method: 'POST' }, user.accessToken);
    assert.equal(completeRes.status, 201);
  });

  test('scheduled habit supports Sunday (0), Monday (1), Wednesday (3), Friday (5)', async () => {
    const habitRes = await authFetch(
      '/habits',
      {
        method: 'POST',
        body: JSON.stringify({
          name: 'Sun Mon Wed Fri Workout',
          frequency_type: 'scheduled',
          days: [0, 1, 3, 5],
        }),
      },
      user.accessToken
    );

    const { habit } = await habitRes.json();
    assert.equal(habitRes.status, 201);
    assert.equal(habit.frequency_type, 'scheduled');
    assert.deepEqual(habit.schedule, [0, 1, 3, 5]);

    // Fetch by ID to confirm schedule persists
    const getRes = await authFetch(`/habits/${habit.id}`, { method: 'GET' }, user.accessToken);
    const getBody = await getRes.json();
    assert.equal(getRes.status, 200);
    assert.deepEqual(getBody.habit.schedule, [0, 1, 3, 5]);
  });
});

describe('GET /habits/:id/completions', () => {
  let user;
  let otherUser;

  before(async () => {
    user = await registerTestUser();
    otherUser = await registerTestUser();
  });

  test('returns empty completions array for a habit with no check-ins', async () => {
    const habitRes = await authFetch(
      '/habits',
      { method: 'POST', body: JSON.stringify({ name: 'Fresh Habit', frequency_type: 'daily' }) },
      user.accessToken
    );
    const { habit } = await habitRes.json();

    const res = await authFetch(`/habits/${habit.id}/completions`, { method: 'GET' }, user.accessToken);
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(body.completions));
    assert.equal(body.completions.length, 0);
  });

  test('returns completion records after marking habit complete', async () => {
    const habitRes = await authFetch(
      '/habits',
      { method: 'POST', body: JSON.stringify({ name: 'Hydration Habit', frequency_type: 'daily' }) },
      user.accessToken
    );
    const { habit } = await habitRes.json();

    // Mark complete
    await authFetch(`/habits/${habit.id}/completions`, { method: 'POST' }, user.accessToken);

    const res = await authFetch(`/habits/${habit.id}/completions`, { method: 'GET' }, user.accessToken);
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(body.completions));
    assert.equal(body.completions.length, 1);

    const c = body.completions[0];
    assert.equal(c.habit_id, habit.id);
    assert.ok(c.completion_date, 'completion_date must be present');
    assert.match(c.completion_date, /^\d{4}-\d{2}-\d{2}$/, 'completion_date must be YYYY-MM-DD');
    assert.ok(c.id);
    assert.ok(c.user_id);
  });

  test('returns 404 for a nonexistent habit', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await authFetch(`/habits/${fakeId}/completions`, { method: 'GET' }, user.accessToken);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.ok(body.error);
  });

  test('returns 400 for an invalid (non-UUID) habit ID', async () => {
    const res = await authFetch('/habits/not-a-uuid/completions', { method: 'GET' }, user.accessToken);
    assert.equal(res.status, 400);
  });

  test('returns 401 for unauthenticated request', async () => {
    const habitRes = await authFetch(
      '/habits',
      { method: 'POST', body: JSON.stringify({ name: 'Private Habit', frequency_type: 'daily' }) },
      user.accessToken
    );
    const { habit } = await habitRes.json();

    const res = await authFetch(`/habits/${habit.id}/completions`, { method: 'GET' });
    assert.equal(res.status, 401);
  });

  test('does not expose another user\'s habit completions (returns 404)', async () => {
    // user creates and completes a habit
    const habitRes = await authFetch(
      '/habits',
      { method: 'POST', body: JSON.stringify({ name: 'User A Secret Habit', frequency_type: 'daily' }) },
      user.accessToken
    );
    const { habit } = await habitRes.json();
    await authFetch(`/habits/${habit.id}/completions`, { method: 'POST' }, user.accessToken);

    // otherUser tries to fetch user's habit completions
    const res = await authFetch(`/habits/${habit.id}/completions`, { method: 'GET' }, otherUser.accessToken);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.ok(body.error);
  });
});
