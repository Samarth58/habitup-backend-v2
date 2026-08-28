/**
 * Test script for verifying habit completions, idempotency, and streak calculation.
 * 
 * Usage: node scripts/test-completions.js
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

async function runTests() {
  console.log(`Starting habit completion & streak tests against ${BASE_URL}...\n`);

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

  // Step 1: Create a daily habit "Drink Water"
  try {
    const res = await fetch(`${BASE_URL}/habits`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'Drink Water',
        frequency_type: 'daily',
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.habit || !data.habit.id) {
      console.error('[FAIL] Step 1: Create habit failed.', data);
      process.exit(1);
    }

    habitId = data.habit.id;
    console.log(`[PASS] Step 1: Created daily habit "Drink Water" (ID: ${habitId}).`);
  } catch (err) {
    console.error('[FAIL] Step 1: Exception during habit creation.', err.message);
    process.exit(1);
  }

  let todayCompletionDate;

  // Step 2: Mark it complete (first time)
  try {
    const res = await fetch(`${BASE_URL}/habits/${habitId}/completions`, {
      method: 'POST',
      headers: authHeaders,
    });

    const data = await res.json();
    if (!res.ok || !data.completion || data.streak !== 1) {
      console.error(`[FAIL] Step 2: Expected streak 1, got data:`, data);
      process.exit(1);
    }

    todayCompletionDate = data.completion.completion_date;
    console.log(`[PASS] Step 2: Marked complete. Completion date: ${todayCompletionDate}, Streak: ${data.streak}.`);
  } catch (err) {
    console.error('[FAIL] Step 2: Exception during completion.', err.message);
    process.exit(1);
  }

  // Step 3: Mark it complete again (same day, idempotency check)
  try {
    const res = await fetch(`${BASE_URL}/habits/${habitId}/completions`, {
      method: 'POST',
      headers: authHeaders,
    });

    const data = await res.json();
    if (!res.ok || !data.completion || data.streak !== 1) {
      console.error(`[FAIL] Step 3: Idempotency check failed. Expected streak 1, got data:`, data);
      process.exit(1);
    }

    console.log(`[PASS] Step 3: Idempotency confirmed. Streak remains ${data.streak}.`);
  } catch (err) {
    console.error('[FAIL] Step 3: Exception during idempotent completion.', err.message);
    process.exit(1);
  }

  // Step 4: Confirm via GET /habits/:id
  try {
    const res = await fetch(`${BASE_URL}/habits/${habitId}`, {
      method: 'GET',
      headers: authHeaders,
    });

    const data = await res.json();
    if (!res.ok || !data.habit || data.habit.streak !== 1) {
      console.error(`[FAIL] Step 4: Confirm via GET failed. Expected streak 1, got data:`, data);
      process.exit(1);
    }

    console.log(`[PASS] Step 4: GET /habits/${habitId} confirmed streak is ${data.habit.streak}.`);
  } catch (err) {
    console.error('[FAIL] Step 4: Exception during GET habit.', err.message);
    process.exit(1);
  }

  // Step 5: Undo today's completion (DELETE /habits/:id/completions/:date)
  try {
    const res = await fetch(`${BASE_URL}/habits/${habitId}/completions/${todayCompletionDate}`, {
      method: 'DELETE',
      headers: authHeaders,
    });

    const data = await res.json();
    if (!res.ok || data.streak !== 0) {
      console.error(`[FAIL] Step 5: Undo completion failed. Expected streak 0, got data:`, data);
      process.exit(1);
    }

    console.log(`[PASS] Step 5: Undid completion for date ${todayCompletionDate}. New streak: ${data.streak}.`);
  } catch (err) {
    console.error('[FAIL] Step 5: Exception during delete completion.', err.message);
    process.exit(1);
  }

  // Step 6: Confirm via GET again (GET /habits/:id)
  try {
    const res = await fetch(`${BASE_URL}/habits/${habitId}`, {
      method: 'GET',
      headers: authHeaders,
    });

    const data = await res.json();
    if (!res.ok || !data.habit || data.habit.streak !== 0) {
      console.error(`[FAIL] Step 6: Final GET confirmation failed. Expected streak 0, got data:`, data);
      process.exit(1);
    }

    console.log(`[PASS] Step 6: Final GET /habits/${habitId} confirmed streak is ${data.habit.streak}.`);
  } catch (err) {
    console.error('[FAIL] Step 6: Exception during final GET habit.', err.message);
    process.exit(1);
  }

  console.log('\n----------------------------------------');
  console.log('ALL COMPLETION & STREAK TESTS PASSED!');
  console.log('----------------------------------------');
  process.exit(0);
}

runTests();
