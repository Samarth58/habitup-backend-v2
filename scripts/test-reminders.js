/**
 * Test script for verifying reminder endpoints.
 * 
 * Usage: node scripts/test-reminders.js
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

async function runTests() {
  console.log(`Starting reminder API tests against ${BASE_URL}...\n`);

  // Step 0: Fresh login
  let accessToken;
  try {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'testpass123',
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.accessToken) {
      console.error('[FAIL] Step 0: Login failed.', data);
      process.exit(1);
    }

    accessToken = data.accessToken;
    console.log('[PASS] Step 0: Logged in successfully.');
  } catch (err) {
    console.error('[FAIL] Step 0: Exception during login.', err.message);
    process.exit(1);
  }

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };

  let habitId;

  // Step 1: Create habit
  try {
    const res = await fetch(`${BASE_URL}/habits`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'Morning Workout',
        frequency_type: 'daily',
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.habit || !data.habit.id) {
      console.error('[FAIL] Step 1: Create habit failed.', data);
      process.exit(1);
    }

    habitId = data.habit.id;
    console.log(`[PASS] Step 1: Created habit "Morning Workout" (ID: ${habitId}).`);
  } catch (err) {
    console.error('[FAIL] Step 1: Exception during habit creation.', err.message);
    process.exit(1);
  }

  let reminderId;

  // Step 2: Create reminder (POST /habits/:habitId/reminders)
  try {
    const res = await fetch(`${BASE_URL}/habits/${habitId}/reminders`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        time: '08:30:00',
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.reminder || !data.reminder.id) {
      console.error('[FAIL] Step 2: Create reminder failed.', data);
      process.exit(1);
    }

    reminderId = data.reminder.id;
    console.log(`[PASS] Step 2: Created reminder (ID: ${reminderId}, Time: ${data.reminder.time}, Enabled: ${data.reminder.enabled}).`);
  } catch (err) {
    console.error('[FAIL] Step 2: Exception during reminder creation.', err.message);
    process.exit(1);
  }

  // Step 3: List reminders (GET /habits/:habitId/reminders)
  try {
    const res = await fetch(`${BASE_URL}/habits/${habitId}/reminders`, {
      method: 'GET',
      headers: authHeaders,
    });

    const data = await res.json();
    if (!res.ok || !Array.isArray(data.reminders) || data.reminders.length === 0) {
      console.error('[FAIL] Step 3: List reminders failed.', data);
      process.exit(1);
    }

    const found = data.reminders.some((r) => r.id === reminderId);
    if (!found) {
      console.error(`[FAIL] Step 3: Created reminder ${reminderId} not found in list.`, data.reminders);
      process.exit(1);
    }

    console.log(`[PASS] Step 3: Listed reminders successfully (Found ${data.reminders.length} reminder(s)).`);
  } catch (err) {
    console.error('[FAIL] Step 3: Exception during listing reminders.', err.message);
    process.exit(1);
  }

  // Step 4: Update reminder (PATCH /reminders/:id)
  try {
    const res = await fetch(`${BASE_URL}/reminders/${reminderId}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        time: '09:00:00',
        enabled: false,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.reminder || data.reminder.enabled !== false) {
      console.error('[FAIL] Step 4: Update reminder failed.', data);
      process.exit(1);
    }

    console.log(`[PASS] Step 4: Updated reminder (New Time: ${data.reminder.time}, Enabled: ${data.reminder.enabled}).`);
  } catch (err) {
    console.error('[FAIL] Step 4: Exception during updating reminder.', err.message);
    process.exit(1);
  }

  // Step 5: Delete reminder (DELETE /reminders/:id)
  try {
    const res = await fetch(`${BASE_URL}/reminders/${reminderId}`, {
      method: 'DELETE',
      headers: authHeaders,
    });

    const data = await res.json();
    if (!res.ok || !data.message) {
      console.error('[FAIL] Step 5: Delete reminder failed.', data);
      process.exit(1);
    }

    console.log('[PASS] Step 5: Deleted reminder successfully.');
  } catch (err) {
    console.error('[FAIL] Step 5: Exception during deleting reminder.', err.message);
    process.exit(1);
  }

  // Step 6: Verify list reminders is empty
  try {
    const res = await fetch(`${BASE_URL}/habits/${habitId}/reminders`, {
      method: 'GET',
      headers: authHeaders,
    });

    const data = await res.json();
    if (!res.ok || !Array.isArray(data.reminders)) {
      console.error('[FAIL] Step 6: Final list reminders failed.', data);
      process.exit(1);
    }

    const found = data.reminders.some((r) => r.id === reminderId);
    if (found) {
      console.error(`[FAIL] Step 6: Deleted reminder ${reminderId} still exists in list.`, data.reminders);
      process.exit(1);
    }

    console.log('[PASS] Step 6: Verified reminder list no longer contains deleted reminder.');
  } catch (err) {
    console.error('[FAIL] Step 6: Exception during final listing reminders.', err.message);
    process.exit(1);
  }

  console.log('\n----------------------------------------');
  console.log('ALL REMINDER TESTS PASSED SUCCESSFULLY!');
  console.log('----------------------------------------');
  process.exit(0);
}

runTests();
