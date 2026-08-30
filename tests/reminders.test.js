const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const { registerTestUser, authFetch } = require('./helpers');

describe('Reminders API Endpoints', () => {
  let userA;
  let userB;

  before(async () => {
    userA = await registerTestUser();
    userB = await registerTestUser();
  });

  test('creates reminder on user\'s own habit successfully', async () => {
    const habitRes = await authFetch(
      '/habits',
      {
        method: 'POST',
        body: JSON.stringify({ name: 'Morning Drink', frequency_type: 'daily' }),
      },
      userA.accessToken
    );
    const { habit } = await habitRes.json();

    const reminderRes = await authFetch(
      `/habits/${habit.id}/reminders`,
      {
        method: 'POST',
        body: JSON.stringify({ time: '07:30:00' }),
      },
      userA.accessToken
    );

    const body = await reminderRes.json();
    assert.equal(reminderRes.status, 201);
    assert.ok(body.reminder);
    assert.ok(body.reminder.id);
    assert.equal(body.reminder.habit_id, habit.id);
    assert.ok(body.reminder.time.startsWith('07:30'));
    assert.equal(body.reminder.enabled, true);
  });

  test('creating reminder on another user\'s habit is rejected with 404', async () => {
    const habitRes = await authFetch(
      '/habits',
      {
        method: 'POST',
        body: JSON.stringify({ name: 'User A Habit for Reminder', frequency_type: 'daily' }),
      },
      userA.accessToken
    );
    const { habit } = await habitRes.json();

    // User B attempts to create reminder on User A's habit
    const res = await authFetch(
      `/habits/${habit.id}/reminders`,
      {
        method: 'POST',
        body: JSON.stringify({ time: '08:00:00' }),
      },
      userB.accessToken
    );

    assert.equal(res.status, 404);
  });

  test('full CRUD cycle: list, update, delete, and verify removal', async () => {
    const habitRes = await authFetch(
      '/habits',
      {
        method: 'POST',
        body: JSON.stringify({ name: 'Evening Reading', frequency_type: 'daily' }),
      },
      userA.accessToken
    );
    const { habit } = await habitRes.json();

    // 1. Create reminder
    const createRes = await authFetch(
      `/habits/${habit.id}/reminders`,
      {
        method: 'POST',
        body: JSON.stringify({ time: '20:00:00' }),
      },
      userA.accessToken
    );
    const { reminder } = await createRes.json();

    // 2. List reminders
    const listRes = await authFetch(`/habits/${habit.id}/reminders`, { method: 'GET' }, userA.accessToken);
    const listBody = await listRes.json();
    assert.equal(listRes.status, 200);
    assert.ok(Array.isArray(listBody.reminders));
    assert.ok(listBody.reminders.some((r) => r.id === reminder.id));

    // 3. Update reminder
    const updateRes = await authFetch(
      `/reminders/${reminder.id}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ time: '21:30:00', enabled: false }),
      },
      userA.accessToken
    );
    const updateBody = await updateRes.json();
    assert.equal(updateRes.status, 200);
    assert.ok(updateBody.reminder.time.startsWith('21:30'));
    assert.equal(updateBody.reminder.enabled, false);

    // 4. Delete reminder
    const deleteRes = await authFetch(`/reminders/${reminder.id}`, { method: 'DELETE' }, userA.accessToken);
    const deleteBody = await deleteRes.json();
    assert.equal(deleteRes.status, 200);
    assert.equal(deleteBody.message, 'Reminder deleted successfully.');

    // 5. Verify removal
    const verifyRes = await authFetch(`/habits/${habit.id}/reminders`, { method: 'GET' }, userA.accessToken);
    const verifyBody = await verifyRes.json();
    assert.equal(verifyRes.status, 200);
    assert.equal(verifyBody.reminders.some((r) => r.id === reminder.id), false);
  });
});
