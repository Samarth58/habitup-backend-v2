/**
 * Test script for verifying GET /auth/me endpoint.
 * 
 * Usage: node scripts/test-me.js
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

async function runTests() {
  console.log(`Starting GET /auth/me test against ${BASE_URL}...\n`);

  // Step 1: Login to get token
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
      console.error('[FAIL] Step 1: Login failed.', data);
      process.exitCode = 1;
      return;
    }

    accessToken = data.accessToken;
    console.log('[PASS] Step 1: Logged in successfully.');
  } catch (err) {
    console.error('[FAIL] Step 1: Exception during login.', err.message);
    process.exitCode = 1;
    return;
  }

  // Step 2: Fetch GET /auth/me
  try {
    const res = await fetch(`${BASE_URL}/auth/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await res.json();
    if (!res.ok || !data.user || !data.user.id || !data.user.email) {
      console.error('[FAIL] Step 2: GET /auth/me failed.', data);
      process.exitCode = 1;
      return;
    }

    if (data.user.password_hash !== undefined) {
      console.error('[FAIL] Step 2: password_hash was leaked in GET /auth/me output!');
      process.exitCode = 1;
      return;
    }

    console.log('[PASS] Step 2: GET /auth/me returned profile without password_hash:');
    console.log(data.user);
  } catch (err) {
    console.error('[FAIL] Step 2: Exception during GET /auth/me.', err.message);
    process.exitCode = 1;
    return;
  }

  console.log('\n----------------------------------------');
  console.log('GET /auth/me TEST PASSED SUCCESSFULLY!');
  console.log('----------------------------------------');
  process.exitCode = 0;
}

runTests();
