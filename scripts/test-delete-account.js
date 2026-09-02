/**
 * Test script for verifying account deletion and email anonymization workflow.
 *
 * Steps covered:
 * 1. Register a test user.
 * 2. Verify login works for the user.
 * 3. Attempt account deletion with an incorrect password (should fail with 401).
 * 4. Perform account deletion with the correct password (should succeed with 200).
 * 5. Verify login fails for the deleted account (should return 401).
 * 6. Verify the same email can immediately register a NEW account (confirms email anonymization).
 *
 * Usage: node scripts/test-delete-account.js
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

async function runTests() {
  console.log(`Starting DELETE /auth/account test suite against ${BASE_URL}...\n`);

  const testEmail = `delete_test_${Date.now()}@example.com`;
  const originalPassword = 'Password123!';
  const wrongPassword = 'IncorrectPassword999!';
  const newAccountPassword = 'NewPassword456!';

  let accessToken;

  // Step 1: Register initial test user
  try {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Account Deletion Test User',
        email: testEmail,
        password: originalPassword,
        timezone: 'UTC',
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.accessToken) {
      console.error('[FAIL] Step 1: Registration failed.', data);
      process.exitCode = 1;
      return;
    }

    accessToken = data.accessToken;
    console.log(`[PASS] Step 1: User registered successfully (${testEmail}).`);
  } catch (err) {
    console.error('[FAIL] Step 1: Exception during registration.', err.message);
    process.exitCode = 1;
    return;
  }

  // Step 2: Verify login works
  try {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: originalPassword,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.accessToken || !data.refreshToken) {
      console.error('[FAIL] Step 2: Login verification failed.', data);
      process.exitCode = 1;
      return;
    }

    // Refresh accessToken from login
    accessToken = data.accessToken;
    console.log('[PASS] Step 2: Login verified successfully.');
  } catch (err) {
    console.error('[FAIL] Step 2: Exception during login.', err.message);
    process.exitCode = 1;
    return;
  }

  // Step 3: Attempt account deletion with WRONG password (must fail with 401)
  try {
    const res = await fetch(`${BASE_URL}/auth/account`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        password: wrongPassword,
      }),
    });

    const data = await res.json();
    if (res.status !== 401 || !data.error) {
      console.error(`[FAIL] Step 3: Expected 401 for wrong password, got ${res.status}.`, data);
      process.exitCode = 1;
      return;
    }

    console.log(`[PASS] Step 3: Deletion with wrong password rejected with 401 (${data.error}).`);
  } catch (err) {
    console.error('[FAIL] Step 3: Exception during wrong password deletion test.', err.message);
    process.exitCode = 1;
    return;
  }

  // Step 4: Perform account deletion with CORRECT password (must succeed with 200)
  try {
    const res = await fetch(`${BASE_URL}/auth/account`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        password: originalPassword,
      }),
    });

    const data = await res.json();
    if (res.status !== 200 || !data.message) {
      console.error(`[FAIL] Step 4: Expected 200 for account deletion, got ${res.status}.`, data);
      process.exitCode = 1;
      return;
    }

    console.log(`[PASS] Step 4: Account deleted successfully (${data.message}).`);
  } catch (err) {
    console.error('[FAIL] Step 4: Exception during account deletion.', err.message);
    process.exitCode = 1;
    return;
  }

  // Step 5: Verify login now fails for the deleted account
  try {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: originalPassword,
      }),
    });

    const data = await res.json();
    if (res.status !== 401) {
      console.error(`[FAIL] Step 5: Expected 401 logging into deleted account, got ${res.status}.`, data);
      process.exitCode = 1;
      return;
    }

    console.log('[PASS] Step 5: Login for deleted account correctly rejected with 401.');
  } catch (err) {
    console.error('[FAIL] Step 5: Exception during deleted user login check.', err.message);
    process.exitCode = 1;
    return;
  }

  // Step 6: Verify the same email can register a NEW account (confirms email anonymization)
  try {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'New Re-registered User',
        email: testEmail,
        password: newAccountPassword,
        timezone: 'America/New_York',
      }),
    });

    const data = await res.json();
    if (res.status !== 201 || !data.accessToken || data.user?.email !== testEmail) {
      console.error(`[FAIL] Step 6: Expected 201 re-registering released email, got ${res.status}.`, data);
      process.exitCode = 1;
      return;
    }

    console.log(`[PASS] Step 6: Same email (${testEmail}) registered as a NEW account successfully.`);
  } catch (err) {
    console.error('[FAIL] Step 6: Exception during re-registration with recycled email.', err.message);
    process.exitCode = 1;
    return;
  }

  console.log('\n========================================');
  console.log('ACCOUNT DELETION TESTS PASSED SUCCESSFULLY!');
  console.log('========================================');
  process.exitCode = 0;
}

runTests();
