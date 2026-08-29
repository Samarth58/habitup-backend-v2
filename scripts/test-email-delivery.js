/**
 * Manual email delivery verification script.
 *
 * Usage:
 *   node scripts/test-email-delivery.js <real-email-address>
 *
 * Example:
 *   node scripts/test-email-delivery.js samarths362@gmail.com
 *
 * This script:
 *   1. Registers a fresh user with the given email address.
 *   2. Requests a password reset for that email.
 *   3. Logs the server responses.
 *   4. Tells you to check the inbox to confirm delivery.
 *
 * Actual email delivery must be confirmed by a human — check the inbox
 * (and spam folder) for "Reset your HabitUp password".
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

async function main() {
  const email = process.argv[2];

  if (!email) {
    console.error('ERROR: No email address provided.');
    console.error('Usage: node scripts/test-email-delivery.js <real-email-address>');
    process.exit(1);
  }

  const password = `TestPass_${Date.now()}`;

  console.log('='.repeat(60));
  console.log('HabitUp — Email Delivery Verification');
  console.log('='.repeat(60));
  console.log(`Target email : ${email}`);
  console.log(`Server       : ${BASE_URL}`);
  console.log('='.repeat(60));
  console.log();

  // ── Step 1: Register ────────────────────────────────────────────
  console.log('Step 1: Registering new user...');

  let registerRes, registerBody;
  try {
    registerRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Email Delivery Test',
        email,
        password,
        timezone: 'Asia/Kolkata',
      }),
    });
    registerBody = await registerRes.json();
  } catch (err) {
    console.error(`FAIL: Could not reach server at ${BASE_URL}.`);
    console.error(`      ${err.message}`);
    process.exit(1);
  }

  console.log(`  Status : ${registerRes.status} ${registerRes.statusText}`);
  console.log('  Body   :', JSON.stringify(registerBody, null, 2));

  if (!registerRes.ok) {
    console.error('\nFAIL: Registration did not return a 2xx status.');
    console.error('      Fix the error above before re-running.');
    process.exit(1);
  }

  console.log('  ✓ Registration successful.\n');

  // ── Step 2: Request password reset ─────────────────────────────
  console.log('Step 2: Requesting password reset...');

  let resetRes, resetBody;
  try {
    resetRes = await fetch(`${BASE_URL}/auth/reset-password/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    resetBody = await resetRes.json();
  } catch (err) {
    console.error(`FAIL: Could not reach server at ${BASE_URL}.`);
    console.error(`      ${err.message}`);
    process.exit(1);
  }

  console.log(`  Status : ${resetRes.status} ${resetRes.statusText}`);
  console.log('  Body   :', JSON.stringify(resetBody, null, 2));

  if (!resetRes.ok) {
    console.error('\nFAIL: Reset request did not return a 2xx status.');
    console.error('      Check your server terminal for nodemailer errors.');
    process.exit(1);
  }

  console.log('  ✓ Reset request accepted.\n');

  // ── Final instructions ──────────────────────────────────────────
  console.log('='.repeat(60));
  console.log('Registration and reset request sent successfully.');
  console.log(`Now check the inbox for ${email} (including spam folder)`);
  console.log('to confirm the email arrived.');
  console.log('Check your server terminal for any nodemailer errors.');
  console.log('='.repeat(60));
}

main();
