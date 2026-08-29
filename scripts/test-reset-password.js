/**
 * Test script for verifying password reset workflow.
 *
 * NOTE: Email delivery is now handled via real Gmail SMTP (nodemailer).
 * The reset token is emailed to the user's registered address — there is no sandbox
 * restriction on the recipient, so you can use ANY real email address you own.
 * After running Step 3, check the inbox of whatever email you registered with
 * to obtain the token, then supply it to Step 4 manually if needed.
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
  // The server will email the reset token to the registered address via Gmail SMTP.
  // No token is returned in the API response (prevents token leakage).
  // To verify end-to-end delivery, check the inbox of the address used above.
  try {
    const res = await fetch(`${BASE_URL}/auth/reset-password/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: uniqueEmail }),
    });

    const data = await res.json();
    if (!res.ok || !data.message) {
      console.error('[FAIL] Step 3: Request reset password failed.', data);
      process.exitCode = 1;
      return;
    }

    console.log(`[PASS] Step 3: Password reset requested. Generic message received (no token in response).`);
    console.log(`       → To verify email delivery, check the inbox for ${uniqueEmail}.`);
    console.log(`       → This script cannot auto-confirm Step 4 without retrieving the emailed token.`);
  } catch (err) {
    console.error('[FAIL] Step 3: Exception during request reset password.', err.message);
    process.exitCode = 1;
    return;
  }

  // Step 4: Confirm password reset with new password
  // IMPORTANT: Obtain the reset token from the email sent to uniqueEmail above.
  // This step requires manual intervention — pass the token via RESET_TOKEN env var:
  //   RESET_TOKEN=<token_from_email> node scripts/test-reset-password.js
  const manualToken = process.env.RESET_TOKEN;
  if (!manualToken) {
    console.log('\n[SKIP] Step 4–7: Set RESET_TOKEN=<token_from_email> to continue automated testing.');
    console.log('       Retrieve the token from the inbox and re-run with RESET_TOKEN set.');
    return;
  }

  const devToken = manualToken;
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
