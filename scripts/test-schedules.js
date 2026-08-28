/**
 * Test script for verifying habit schedules API endpoints.
 * 
 * Usage: node scripts/test-schedules.js
 * 
 * Environment variables:
 * - BASE_URL: Target API server URL (default: http://localhost:5000)
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

function arraysEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  return a.every((val, idx) => val === b[idx]);
}

async function runTests() {
  console.log(`Starting habit schedule tests against ${BASE_URL}...\n`);

  const uniqueEmail = `testuser_schedules_${Date.now()}@example.com`;
  const password = 'testpass123';

  // Step 1: Register fresh unique user
  let accessToken;
  try {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Schedules Test User',
        email: uniqueEmail,
        password: password,
        timezone: 'Asia/Kolkata',
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.accessToken) {
      console.error('[FAIL] Step 1: Registration failed.', data);
      process.exitCode = 1;
      return;
    }

    accessToken = data.accessToken;
    console.log(`[PASS] Step 1: Registered fresh user ${uniqueEmail}.`);
  } catch (err) {
    console.error('[FAIL] Step 1: Exception during registration.', err.message);
    process.exitCode = 1;
    return;
  }

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };

  let habitId;

  // Step 2: Create a scheduled habit with days [0, 2, 4]
  try {
    const res = await fetch(`${BASE_URL}/habits`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'Read 20 pages',
        frequency_type: 'scheduled',
        days: [0, 2, 4],
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.habit || !data.habit.id) {
      console.error('[FAIL] Step 2: Create habit failed.', data);
      process.exitCode = 1;
      return;
    }

    habitId = data.habit.id;
    console.log(`[PASS] Step 2: Created habit "Read 20 pages" (ID: ${habitId}).`);
  } catch (err) {
    console.error('[FAIL] Step 2: Exception during habit creation.', err.message);
    process.exitCode = 1;
    return;
  }

  // Step 3: Fetch the habit by ID and assert schedule equals [0, 2, 4]
  try {
    const res = await fetch(`${BASE_URL}/habits/${habitId}`, {
      method: 'GET',
      headers: authHeaders,
    });

    const data = await res.json();
    if (!res.ok || !data.habit) {
      console.error('[FAIL] Step 3: Fetch habit failed.', data);
      process.exitCode = 1;
      return;
    }

    const schedule = data.habit.schedule;
    const expected = [0, 2, 4];
    if (!arraysEqual(schedule, expected)) {
      console.error(`[FAIL] Step 3: Expected schedule ${JSON.stringify(expected)}, got ${JSON.stringify(schedule)}`);
      process.exitCode = 1;
      return;
    }

    console.log(`[PASS] Step 3: Fetched habit and verified initial schedule is ${JSON.stringify(schedule)}.`);
  } catch (err) {
    console.error('[FAIL] Step 3: Exception during fetch habit.', err.message);
    process.exitCode = 1;
    return;
  }

  // Step 4: Update the habit schedule with days: [1, 3, 5]
  try {
    const res = await fetch(`${BASE_URL}/habits/${habitId}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        days: [1, 3, 5],
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.habit) {
      console.error('[FAIL] Step 4: Update habit failed.', data);
      process.exitCode = 1;
      return;
    }

    console.log('[PASS] Step 4: Updated habit schedule with days [1, 3, 5].');
  } catch (err) {
    console.error('[FAIL] Step 4: Exception during update habit.', err.message);
    process.exitCode = 1;
    return;
  }

  // Step 5: Fetch habit again and assert schedule equals [1, 3, 5] exactly (replaces, not appends)
  try {
    const res = await fetch(`${BASE_URL}/habits/${habitId}`, {
      method: 'GET',
      headers: authHeaders,
    });

    const data = await res.json();
    if (!res.ok || !data.habit) {
      console.error('[FAIL] Step 5: Fetch updated habit failed.', data);
      process.exitCode = 1;
      return;
    }

    const schedule = data.habit.schedule;
    const expected = [1, 3, 5];
    if (!arraysEqual(schedule, expected)) {
      console.error(`[FAIL] Step 5: Expected schedule ${JSON.stringify(expected)}, got ${JSON.stringify(schedule)} (replaces check failed).`);
      process.exitCode = 1;
      return;
    }

    console.log(`[PASS] Step 5: Fetched habit and verified schedule was replaced to ${JSON.stringify(schedule)}.`);
  } catch (err) {
    console.error('[FAIL] Step 5: Exception during fetch updated habit.', err.message);
    process.exitCode = 1;
    return;
  }

  console.log('\n----------------------------------------');
  console.log('ALL SCHEDULE TESTS PASSED SUCCESSFULLY!');
  console.log('----------------------------------------');
  process.exitCode = 0;
}

runTests();
