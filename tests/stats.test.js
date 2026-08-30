const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const { registerTestUser, authFetch } = require('./helpers');

describe('Statistics API Endpoints', () => {
  let user;

  before(async () => {
    user = await registerTestUser();
  });

  test('per-habit stats returned with current_streak, best_streak, total_completions, and completion_rate', async () => {
    const habitRes = await authFetch(
      '/habits',
      {
        method: 'POST',
        body: JSON.stringify({ name: 'Stats Habit', frequency_type: 'daily' }),
      },
      user.accessToken
    );
    const { habit } = await habitRes.json();

    // Complete habit
    await authFetch(`/habits/${habit.id}/completions`, { method: 'POST' }, user.accessToken);

    // Fetch habit stats
    const statsRes = await authFetch(`/habits/${habit.id}/stats?period=month`, { method: 'GET' }, user.accessToken);
    const body = await statsRes.json();

    assert.equal(statsRes.status, 200);
    assert.equal(typeof body.current_streak, 'number');
    assert.equal(typeof body.best_streak, 'number');
    assert.equal(typeof body.total_completions, 'number');
    assert.equal(typeof body.completion_rate, 'number');
    assert.equal(body.period, 'month');
    assert.ok(body.total_completions >= 1);
  });

  test('aggregate /stats matches single habit completion rate when only one habit exists', async () => {
    // Single habit stats
    const listHabitsRes = await authFetch('/habits', { method: 'GET' }, user.accessToken);
    const { habits } = await listHabitsRes.json();
    assert.ok(habits.length > 0);
    const firstHabit = habits[0];

    const singleRes = await authFetch(`/habits/${firstHabit.id}/stats?period=month`, { method: 'GET' }, user.accessToken);
    const singleStats = await singleRes.json();

    // Overall stats
    const overallRes = await authFetch('/stats?period=month', { method: 'GET' }, user.accessToken);
    const overallStats = await overallRes.json();

    assert.equal(overallRes.status, 200);
    assert.equal(typeof overallStats.overall_completion_rate, 'number');
    assert.equal(typeof overallStats.total_completions, 'number');
    assert.ok(Array.isArray(overallStats.habits));
    assert.equal(overallStats.total_completions, singleStats.total_completions);
    assert.equal(overallStats.overall_completion_rate, singleStats.completion_rate);
  });
});
