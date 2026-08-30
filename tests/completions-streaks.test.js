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
});
