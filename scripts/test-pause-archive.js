/**
 * Test script for pause, unpause, archive, unarchive, and listing archived habits.
 * 
 * Usage: node scripts/test-pause-archive.js
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

async function runTests() {
  console.log(`Starting pause & archive habit tests against ${BASE_URL}...\n`);

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

  // Step 1: Create a habit
  try {
    const res = await fetch(`${BASE_URL}/habits`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'Meditate 10 mins',
        frequency_type: 'daily',
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.habit || !data.habit.id) {
      console.error('[FAIL] Step 1: Create habit failed.', data);
      process.exit(1);
    }

    habitId = data.habit.id;
    console.log(`[PASS] Step 1: Created habit "Meditate 10 mins" (ID: ${habitId}).`);
  } catch (err) {
    console.error('[FAIL] Step 1: Exception during habit creation.', err.message);
    process.exit(1);
  }

  // Step 2: Pause habit
  try {
    const res = await fetch(`${BASE_URL}/habits/${habitId}/pause`, {
      method: 'PATCH',
      headers: authHeaders,
    });

    const data = await res.json();
    if (!res.ok || !data.habit || !data.habit.paused_at) {
      console.error('[FAIL] Step 2: Pause habit failed.', data);
      process.exit(1);
    }

    console.log(`[PASS] Step 2: Paused habit. paused_at: ${data.habit.paused_at}.`);
  } catch (err) {
    console.error('[FAIL] Step 2: Exception during pause habit.', err.message);
    process.exit(1);
  }

  // Step 3: Unpause habit
  try {
    const res = await fetch(`${BASE_URL}/habits/${habitId}/unpause`, {
      method: 'PATCH',
      headers: authHeaders,
    });

    const data = await res.json();
    if (!res.ok || !data.habit || data.habit.paused_at !== null) {
      console.error('[FAIL] Step 3: Unpause habit failed.', data);
      process.exit(1);
    }

    console.log('[PASS] Step 3: Unpaused habit. paused_at is null.');
  } catch (err) {
    console.error('[FAIL] Step 3: Exception during unpause habit.', err.message);
    process.exit(1);
  }

  // Step 4: Archive habit
  try {
    const res = await fetch(`${BASE_URL}/habits/${habitId}/archive`, {
      method: 'PATCH',
      headers: authHeaders,
    });

    const data = await res.json();
    if (!res.ok || !data.habit || !data.habit.archived_at) {
      console.error('[FAIL] Step 4: Archive habit failed.', data);
      process.exit(1);
    }

    console.log(`[PASS] Step 4: Archived habit. archived_at: ${data.habit.archived_at}.`);
  } catch (err) {
    console.error('[FAIL] Step 4: Exception during archive habit.', err.message);
    process.exit(1);
  }

  // Step 5: Verify GET /habits/archived includes the habit
  try {
    const res = await fetch(`${BASE_URL}/habits/archived`, {
      method: 'GET',
      headers: authHeaders,
    });

    const data = await res.json();
    if (!res.ok || !Array.isArray(data.habits)) {
      console.error('[FAIL] Step 5: GET /habits/archived failed.', data);
      process.exit(1);
    }

    const found = data.habits.some((h) => h.id === habitId);
    if (!found) {
      console.error(`[FAIL] Step 5: Habit ${habitId} not found in archived list.`, data.habits);
      process.exit(1);
    }

    console.log('[PASS] Step 5: Verified habit appears in GET /habits/archived.');
  } catch (err) {
    console.error('[FAIL] Step 5: Exception during GET archived habits.', err.message);
    process.exit(1);
  }

  // Step 6: Unarchive habit
  try {
    const res = await fetch(`${BASE_URL}/habits/${habitId}/unarchive`, {
      method: 'PATCH',
      headers: authHeaders,
    });

    const data = await res.json();
    if (!res.ok || !data.habit || data.habit.archived_at !== null) {
      console.error('[FAIL] Step 6: Unarchive habit failed.', data);
      process.exit(1);
    }

    console.log('[PASS] Step 6: Unarchived habit. archived_at is null.');
  } catch (err) {
    console.error('[FAIL] Step 6: Exception during unarchive habit.', err.message);
    process.exit(1);
  }

  // Step 7: Verify GET /habits/archived no longer includes the habit
  try {
    const res = await fetch(`${BASE_URL}/habits/archived`, {
      method: 'GET',
      headers: authHeaders,
    });

    const data = await res.json();
    if (!res.ok || !Array.isArray(data.habits)) {
      console.error('[FAIL] Step 7: GET /habits/archived failed.', data);
      process.exit(1);
    }

    const found = data.habits.some((h) => h.id === habitId);
    if (found) {
      console.error(`[FAIL] Step 7: Habit ${habitId} should NOT be in archived list.`, data.habits);
      process.exit(1);
    }

    console.log('[PASS] Step 7: Verified habit no longer appears in GET /habits/archived.');
  } catch (err) {
    console.error('[FAIL] Step 7: Exception during GET archived habits after unarchive.', err.message);
    process.exit(1);
  }

  console.log('\n----------------------------------------');
  console.log('ALL PAUSE & ARCHIVE TESTS PASSED!');
  console.log('----------------------------------------');
  process.exit(0);
}

runTests();
