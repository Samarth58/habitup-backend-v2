/**
 * Test script for verifying auth endpoint rate limiting.
 *
 * Usage: node scripts/test-rate-limit.js
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

async function runTest() {
  console.log('='.repeat(60));
  console.log('HabitUp — Auth Rate Limiting Verification');
  console.log('='.repeat(60));
  console.log(`Target server : ${BASE_URL}\n`);

  const testEmail = `ratelimit_test_${Date.now()}@example.com`;
  const wrongPassword = 'WrongPassword123!';

  console.log(`Sending 11 rapid login requests with wrong credentials...`);
  console.log(`Test Email: ${testEmail}\n`);

  let allFirst10Are401 = true;
  let eleventhIs429 = false;
  let errorMsgMatches = false;

  for (let i = 1; i <= 11; i++) {
    try {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          password: wrongPassword,
        }),
      });

      const body = await res.json();

      if (i <= 10) {
        if (res.status === 401) {
          console.log(`  Request ${i}/11: Status ${res.status} (Expected 401 Unauthorized) ✓`);
        } else {
          console.error(`  Request ${i}/11: Status ${res.status} (Unexpected! Expected 401) ✗`);
          allFirst10Are401 = false;
        }
      } else {
        // 11th request
        if (res.status === 429) {
          eleventhIs429 = true;
          console.log(`  Request ${i}/11: Status ${res.status} (Expected 429 Too Many Requests) ✓`);
          console.log(`  Response Body:`, JSON.stringify(body));

          if (body.error === 'Too many attempts. Please try again in 15 minutes.') {
            errorMsgMatches = true;
            console.log(`  Error Message Check: Match ✓`);
          } else {
            console.error(`  Error Message Check: Expected "Too many attempts. Please try again in 15 minutes.", got "${body.error}" ✗`);
          }
        } else {
          console.error(`  Request ${i}/11: Status ${res.status} (Unexpected! Expected 429) ✗`);
        }
      }
    } catch (err) {
      console.error(`  Request ${i}/11: Exception - ${err.message} ✗`);
      allFirst10Are401 = false;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY:');
  console.log('='.repeat(60));

  if (allFirst10Are401) {
    console.log('[PASS] First 10 requests returned 401 (invalid credentials).');
  } else {
    console.log('[FAIL] Not all of the first 10 requests returned 401.');
  }

  if (eleventhIs429 && errorMsgMatches) {
    console.log('[PASS] 11th request returned 429 with expected rate limit error message.');
  } else {
    console.log('[FAIL] 11th request did not return 429 with expected rate limit error message.');
  }

  console.log('='.repeat(60));

  if (allFirst10Are401 && eleventhIs429 && errorMsgMatches) {
    process.exitCode = 0;
  } else {
    process.exitCode = 1;
  }
}

runTest();
