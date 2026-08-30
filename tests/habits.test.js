const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const { registerTestUser, authFetch, INVALID_UUID, VALID_UUID } = require('./helpers');

describe('Habits API Endpoints', () => {
  let userA;
  let userB;

  before(async () => {
    userA = await registerTestUser();
    userB = await registerTestUser();
  });

  describe('POST /habits', () => {
    test('creates habit successfully with required fields', async () => {
      const res = await authFetch(
        '/habits',
        {
          method: 'POST',
          body: JSON.stringify({
            name: 'Daily Hydration',
            description: 'Drink 2L of water daily',
            icon: '💧',
            color: '#3498db',
            frequency_type: 'daily',
          }),
        },
        userA.accessToken
      );

      const body = await res.json();
      assert.equal(res.status, 201);
      assert.ok(body.habit);
      assert.ok(body.habit.id);
      assert.equal(body.habit.name, 'Daily Hydration');
      assert.equal(body.habit.frequency_type, 'daily');
      assert.equal(body.habit.streak, 0);
    });

    test('returns 400 when missing required fields (name or frequency_type)', async () => {
      const res = await authFetch(
        '/habits',
        {
          method: 'POST',
          body: JSON.stringify({
            description: 'Incomplete payload',
          }),
        },
        userA.accessToken
      );

      assert.equal(res.status, 400);
    });
  });

  describe('GET /habits', () => {
    test('lists only habits created by the authenticated user', async () => {
      // User A creates habit
      await authFetch(
        '/habits',
        {
          method: 'POST',
          body: JSON.stringify({ name: 'User A Unique Habit', frequency_type: 'daily' }),
        },
        userA.accessToken
      );

      // User B creates habit
      await authFetch(
        '/habits',
        {
          method: 'POST',
          body: JSON.stringify({ name: 'User B Unique Habit', frequency_type: 'daily' }),
        },
        userB.accessToken
      );

      // User A lists habits
      const resA = await authFetch('/habits', { method: 'GET' }, userA.accessToken);
      const bodyA = await resA.json();

      assert.equal(resA.status, 200);
      assert.ok(Array.isArray(bodyA.habits));
      assert.equal(bodyA.habits.some((h) => h.name === 'User A Unique Habit'), true);
      assert.equal(bodyA.habits.some((h) => h.name === 'User B Unique Habit'), false);
    });
  });

  describe('GET /habits/:id', () => {
    test('fetches habit by ID for owner', async () => {
      const createRes = await authFetch(
        '/habits',
        {
          method: 'POST',
          body: JSON.stringify({ name: 'Read Book', frequency_type: 'daily' }),
        },
        userA.accessToken
      );
      const { habit } = await createRes.json();

      const getRes = await authFetch(`/habits/${habit.id}`, { method: 'GET' }, userA.accessToken);
      const body = await getRes.json();

      assert.equal(getRes.status, 200);
      assert.ok(body.habit);
      assert.equal(body.habit.id, habit.id);
      assert.equal(body.habit.name, 'Read Book');
    });

    test('returns 404 for nonexistent UUID', async () => {
      const res = await authFetch(`/habits/${VALID_UUID}`, { method: 'GET' }, userA.accessToken);
      assert.equal(res.status, 404);
    });

    test('returns 400 for malformed invalid UUID', async () => {
      const res = await authFetch(`/habits/${INVALID_UUID}`, { method: 'GET' }, userA.accessToken);
      assert.equal(res.status, 400);
    });
  });

  describe('PATCH /habits/:id', () => {
    test('updates habit fields successfully', async () => {
      const createRes = await authFetch(
        '/habits',
        {
          method: 'POST',
          body: JSON.stringify({ name: 'Old Habit Name', frequency_type: 'daily' }),
        },
        userA.accessToken
      );
      const { habit } = await createRes.json();

      const updateRes = await authFetch(
        `/habits/${habit.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ name: 'New Habit Name', color: '#e74c3c' }),
        },
        userA.accessToken
      );
      const body = await updateRes.json();

      assert.equal(updateRes.status, 200);
      assert.equal(body.habit.name, 'New Habit Name');
      assert.equal(body.habit.color, '#e74c3c');
    });
  });

  describe('Cross-User Security', () => {
    test('user B cannot access user A habit by ID (returns 404 without data leak)', async () => {
      const createRes = await authFetch(
        '/habits',
        {
          method: 'POST',
          body: JSON.stringify({ name: 'Secret Habit User A', frequency_type: 'daily' }),
        },
        userA.accessToken
      );
      const { habit } = await createRes.json();

      const accessRes = await authFetch(`/habits/${habit.id}`, { method: 'GET' }, userB.accessToken);
      assert.equal(accessRes.status, 404);
    });
  });

  describe('DELETE /habits/:id (Soft Delete)', () => {
    test('soft deleted habit disappears from active habits list', async () => {
      const createRes = await authFetch(
        '/habits',
        {
          method: 'POST',
          body: JSON.stringify({ name: 'Temporary Habit', frequency_type: 'daily' }),
        },
        userA.accessToken
      );
      const { habit } = await createRes.json();

      const deleteRes = await authFetch(`/habits/${habit.id}`, { method: 'DELETE' }, userA.accessToken);
      assert.equal(deleteRes.status, 200);

      const listRes = await authFetch('/habits', { method: 'GET' }, userA.accessToken);
      const { habits } = await listRes.json();

      const exists = habits.some((h) => h.id === habit.id);
      assert.equal(exists, false);
    });
  });

  describe('Pause / Unpause & Archive / Unarchive State Transitions', () => {
    test('pause and unpause correctly transition state and affect list visibility', async () => {
      const createRes = await authFetch(
        '/habits',
        {
          method: 'POST',
          body: JSON.stringify({ name: 'Pausable Habit', frequency_type: 'daily' }),
        },
        userA.accessToken
      );
      const { habit } = await createRes.json();

      // Pause habit
      const pauseRes = await authFetch(`/habits/${habit.id}/pause`, { method: 'PATCH' }, userA.accessToken);
      const pauseBody = await pauseRes.json();
      assert.equal(pauseRes.status, 200);
      assert.ok(pauseBody.habit.paused_at);

      // Verify no longer in active list
      const listRes1 = await authFetch('/habits', { method: 'GET' }, userA.accessToken);
      const { habits: activeHabits1 } = await listRes1.json();
      assert.equal(activeHabits1.some((h) => h.id === habit.id), false);

      // Unpause habit
      const unpauseRes = await authFetch(`/habits/${habit.id}/unpause`, { method: 'PATCH' }, userA.accessToken);
      const unpauseBody = await unpauseRes.json();
      assert.equal(unpauseRes.status, 200);
      assert.equal(unpauseBody.habit.paused_at, null);

      // Verify back in active list
      const listRes2 = await authFetch('/habits', { method: 'GET' }, userA.accessToken);
      const { habits: activeHabits2 } = await listRes2.json();
      assert.equal(activeHabits2.some((h) => h.id === habit.id), true);
    });

    test('archive and unarchive correctly transition state and affect archived list visibility', async () => {
      const createRes = await authFetch(
        '/habits',
        {
          method: 'POST',
          body: JSON.stringify({ name: 'Archivable Habit', frequency_type: 'daily' }),
        },
        userA.accessToken
      );
      const { habit } = await createRes.json();

      // Archive habit
      const archiveRes = await authFetch(`/habits/${habit.id}/archive`, { method: 'PATCH' }, userA.accessToken);
      const archiveBody = await archiveRes.json();
      assert.equal(archiveRes.status, 200);
      assert.ok(archiveBody.habit.archived_at);

      // Verify present in /habits/archived and absent from /habits
      const archivedListRes1 = await authFetch('/habits/archived', { method: 'GET' }, userA.accessToken);
      const { habits: archivedHabits1 } = await archivedListRes1.json();
      assert.equal(archivedHabits1.some((h) => h.id === habit.id), true);

      const activeListRes1 = await authFetch('/habits', { method: 'GET' }, userA.accessToken);
      const { habits: activeHabits1 } = await activeListRes1.json();
      assert.equal(activeHabits1.some((h) => h.id === habit.id), false);

      // Unarchive habit
      const unarchiveRes = await authFetch(`/habits/${habit.id}/unarchive`, { method: 'PATCH' }, userA.accessToken);
      const unarchiveBody = await unarchiveRes.json();
      assert.equal(unarchiveRes.status, 200);
      assert.equal(unarchiveBody.habit.archived_at, null);

      // Verify absent from /habits/archived and present in /habits
      const archivedListRes2 = await authFetch('/habits/archived', { method: 'GET' }, userA.accessToken);
      const { habits: archivedHabits2 } = await archivedListRes2.json();
      assert.equal(archivedHabits2.some((h) => h.id === habit.id), false);

      const activeListRes2 = await authFetch('/habits', { method: 'GET' }, userA.accessToken);
      const { habits: activeHabits2 } = await activeListRes2.json();
      assert.equal(activeHabits2.some((h) => h.id === habit.id), true);
    });
  });
});
