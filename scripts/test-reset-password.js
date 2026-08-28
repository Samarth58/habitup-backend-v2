/**
 * Test script for verifying password reset workflow.
 * 
 * Usage: node scripts/test-reset-password.js
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

async function runTests() {
  console.log(`Starting password reset tests against ${BASE_URL}...\n`);

  const uniqueEmail = `testuser_reset_${Date.now()}@example.com`;
  const oldPassword = 'oldpass123';
  const newPassword = 'newpass456';

  // Step 1: Register fresh unique user
  try {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Password Reset Test User',
        email: uniqueEmail,
        password: oldPassword,
        timezone: 'Asia/Kolkata',
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.accessToken) {
      console.error('[FAIL] Step 1: Registration failed.', data);
      process.exitCode = 1;
      return;
    }

    console.log(`[PASS] Step 1: Registered fresh user ${uniqueEmail}.`);
  } catch (err) {
    console.error('[FAIL] Step 1: Exception during registration.', err.message);
    process.exitCode = 1;
    return;
  }

  // Step 2: Login with old password to obtain initial refresh token
  let oldRefreshToken;
  try {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: uniqueEmail,
        password: oldPassword,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.accessToken || !data.refreshToken) {
      console.error('[FAIL] Step 2: Initial login failed.', data);
      process.exitCode = 1;
      return;
    }

    oldRefreshToken = data.refreshToken;
    console.log('[PASS] Step 2: Logged in with old password and obtained active session refresh token.');
  } catch (err) {
    console.error('[FAIL] Step 2: Exception during initial login.', err.message);
    process.exitCode = 1;
    return;
  }

  // Step 3: Request password reset
  let devToken;
  try {
    const res = await fetch(`${BASE_URL}/auth/reset-password/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: uniqueEmail }),
    });

    const data = await res.json();
    if (!res.ok || !data.devToken) {
      console.error('[FAIL] Step 3: Request reset password failed.', data);
      process.exitCode = 1;
      return;
    }

    devToken = data.devToken;
    console.log(`[PASS] Step 3: Requested password reset. Received devToken: ${devToken.slice(0, 10)}...`);
  } catch (err) {
    console.error('[FAIL] Step 3: Exception during request reset password.', err.message);
    process.exitCode = 1;
    return;
  }

  // Step 4: Confirm password reset with new password
  try {
    const res = await fetch(`${BASE_URL}/auth/reset-password/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: devToken,
        newPassword: newPassword,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.message) {
      console.error('[FAIL] Step 4: Confirm password reset failed.', data);
      process.exitCode = 1;
      return;
    }

    console.log('[PASS] Step 4: Confirmed password reset with new password.');
  } catch (err) {
    console.error('[FAIL] Step 4: Exception during confirm password reset.', err.message);
    process.exitCode = 1;
    return;
  }

  // Step 5: Verify login with OLD password fails (401)
  try {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: uniqueEmail,
        password: oldPassword,
      }),
    });

    if (res.status === 401) {
      console.log('[PASS] Step 5: Verified login with OLD password is rejected (401 Unauthorized).');
    } else {
      console.error(`[FAIL] Step 5: Expected 401 when logging in with old password, got status ${res.status}`);
      process.exitCode = 1;
      return;
    }
  } catch (err) {
    console.error('[FAIL] Step 5: Exception during old password login test.', err.message);
    process.exitCode = 1;
    return;
  }

  // Step 6: Verify old refresh token is revoked (401)
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refreshToken: oldRefreshToken,
      }),
    });

    if (res.status === 401) {
      console.log('[PASS] Step 6: Verified old active session refresh token was revoked (401 Unauthorized).');
    } else {
      console.error(`[FAIL] Step 6: Expected 401 when refreshing old session token, got status ${res.status}`);
      process.exitCode = 1;
      return;
    }
  } catch (err) {
    console.error('[FAIL] Step 6: Exception during old session refresh test.', err.message);
    process.exitCode = 1;
    return;
  }

  // Step 7: Login with NEW password succeeds (200)
  try {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: uniqueEmail,
        password: newPassword,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.accessToken) {
      console.error('[FAIL] Step 7: Login with new password failed.', data);
      process.exitCode = 1;
      return;
    }

    console.log('[PASS] Step 7: Logged in successfully with NEW password!');
  } catch (err) {
    console.error('[FAIL] Step 7: Exception during new password login test.', err.message);
    process.exitCode = 1;
    return;
  }

  console.log('\n----------------------------------------');
  console.log('ALL PASSWORD RESET TESTS PASSED!');
  console.log('----------------------------------------');
  process.exitCode = 0;
}

runTests();
