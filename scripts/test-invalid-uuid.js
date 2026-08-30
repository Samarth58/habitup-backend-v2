/**
 * Test script for verifying malformed UUID path parameter validation middleware.
 *
 * Usage: node scripts/test-invalid-uuid.js
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

async function runTest() {
  console.log('='.repeat(60));
  console.log('HabitUp — Malformed UUID Validation Test');
  console.log('='.repeat(60));
  console.log(`Target server : ${BASE_URL}\n`);

  // Step 1: Register temporary test user to acquire valid access token
  const testEmail = `uuid_test_${Date.now()}@example.com`;
  const testPass = 'Password123!';

  let accessToken;
  try {
    const regRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'UUID Test User',
        email: testEmail,
        password: testPass,
        timezone: 'UTC',
      }),
    });
    const regData = await regRes.json();
    if (!regRes.ok || !regData.accessToken) {
      console.error('[FAIL] Registration failed:', regData);
      process.exitCode = 1;
      return;
    }
    accessToken = regData.accessToken;
    console.log('[PASS] Registered temporary test user.');
  } catch (err) {
    console.error('[FAIL] Exception during setup registration:', err.message);
    process.exitCode = 1;
    return;
  }

  // Step 2: Send request with malformed UUID path parameter
  const invalidId = 'not-a-uuid';
  console.log(`\nTesting GET /habits/${invalidId} with invalid UUID format...`);

  try {
    const res = await fetch(`${BASE_URL}/habits/${invalidId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const body = await res.json();

    if (res.status === 400 && body.error === 'Invalid ID format.') {
      console.log(`[PASS] Received expected 400 Bad Request with error: "${body.error}"`);
      process.exitCode = 0;
    } else {
      console.error(`[FAIL] Unexpected response! Status: ${res.status}, Body:`, body);
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('[FAIL] Exception during request:', err.message);
    process.exitCode = 1;
  }
}

runTest();
