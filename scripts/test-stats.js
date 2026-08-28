/**
 * Test script for habit and overall statistics endpoints.
 * 
 * Usage: node scripts/test-stats.js
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

async function runTests() {
  console.log(`Starting statistics API tests against ${BASE_URL}...\n`);

  const uniqueEmail = `stats_user_${Date.now()}@example.com`;
  const password = 'testpass123';

  // Step 1: Register a fresh test user (so they start with exactly 0 habits)
  let accessToken;
  try {
    const regRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Stats Test User',
        email: uniqueEmail,
        password: password,
        timezone: 'Asia/Kolkata',
      }),
    });

    const regData = await regRes.json();
    if (!regRes.ok || !regData.accessToken) {
      console.error('[FAIL] Step 1: Registration failed.', regData);
      process.exitCode = 1;
      return;
    }

    accessToken = regData.accessToken;
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

  // Step 2: Create habit
  try {
    const res = await fetch(`${BASE_URL}/habits`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'Daily Reading',
        frequency_type: 'daily',
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.habit || !data.habit.id) {
      console.error('[FAIL] Step 2: Create habit failed.', data);
      process.exitCode = 1;
      return;
    }

    habitId = data.habit.id;
    console.log(`[PASS] Step 2: Created daily habit "Daily Reading" (ID: ${habitId}).`);
  } catch (err) {
    console.error('[FAIL] Step 2: Exception during habit creation.', err.message);
    process.exitCode = 1;
    return;
  }

  // Step 3: Complete habit for today
  try {
    const res = await fetch(`${BASE_URL}/habits/${habitId}/completions`, {
      method: 'POST',
      headers: authHeaders,
    });

    const data = await res.json();
    if (!res.ok || !data.completion) {
      console.error('[FAIL] Step 3: Complete habit failed.', data);
      process.exitCode = 1;
      return;
    }

    console.log(`[PASS] Step 3: Marked habit complete for today.`);
  } catch (err) {
    console.error('[FAIL] Step 3: Exception during completion.', err.message);
    process.exitCode = 1;
    return;
  }

  let habitCompletionRate;

  // Step 4: GET /habits/:id/stats
  try {
    const res = await fetch(`${BASE_URL}/habits/${habitId}/stats?period=month`, {
      method: 'GET',
      headers: authHeaders,
    });

    const data = await res.json();
    if (
      !res.ok ||
      data.current_streak === undefined ||
      data.best_streak === undefined ||
      data.completion_rate === undefined
    ) {
      console.error('[FAIL] Step 4: GET /habits/:id/stats failed.', data);
      process.exitCode = 1;
      return;
    }

    habitCompletionRate = data.completion_rate;
    console.log(`[PASS] Step 4: GET /habits/${habitId}/stats returned completion_rate: ${habitCompletionRate}.`);
    console.log(data);
  } catch (err) {
    console.error('[FAIL] Step 4: Exception during GET habit stats.', err.message);
    process.exitCode = 1;
    return;
  }

  // Step 5: GET /stats (assert overall_completion_rate equals single habit completion_rate)
  try {
    const res = await fetch(`${BASE_URL}/stats?period=month`, {
      method: 'GET',
      headers: authHeaders,
    });

    const data = await res.json();
    if (
      !res.ok ||
      data.overall_completion_rate === undefined ||
      data.total_completions === undefined ||
      !Array.isArray(data.habits)
    ) {
      console.error('[FAIL] Step 5: GET /stats failed.', data);
      process.exitCode = 1;
      return;
    }

    if (data.habits.length !== 1) {
      console.error(`[FAIL] Step 5: Expected 1 habit for user, got ${data.habits.length}.`);
      process.exitCode = 1;
      return;
    }

    if (data.overall_completion_rate !== habitCompletionRate) {
      console.error(
        `[FAIL] Step 5: overall_completion_rate (${data.overall_completion_rate}) does NOT match single habit completion_rate (${habitCompletionRate}).`
      );
      process.exitCode = 1;
      return;
    }

    console.log(
      `[PASS] Step 5: GET /stats returned overall_completion_rate: ${data.overall_completion_rate} matching single habit completion_rate (${habitCompletionRate}).`
    );
    console.log(data);
  } catch (err) {
    console.error('[FAIL] Step 5: Exception during GET overall stats.', err.message);
    process.exitCode = 1;
    return;
  }

  console.log('\n----------------------------------------');
  console.log('ALL STATS API TESTS PASSED SUCCESSFULLY!');
  console.log('----------------------------------------');
  process.exitCode = 0;
}

runTests();
