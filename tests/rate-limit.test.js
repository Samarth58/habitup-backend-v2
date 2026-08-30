const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { BASE_URL } = require('./helpers');

/**
 * NOTE: This test requires a fresh server instance/restart or standalone execution
 * (node --test tests/rate-limit.test.js), because express-rate-limit is IP-based
 * and enforces a max of 10 requests per 15 minutes across /auth/login and /auth/register.
 */
describe('Auth Rate Limiting', () => {
  const isStandalone = process.argv.some((arg) => arg.includes('rate-limit'));

  test(
    '11th login attempt within window returns 429 Too Many Requests',
    { skip: !isStandalone && !process.env.TEST_RATE_LIMIT ? 'Skipped during full suite run to prevent rate-limit budget exhaustion for other tests. Run standalone with: node --test tests/rate-limit.test.js' : false },
    async () => {
      const testEmail = `ratelimit_suite_${Date.now()}@example.com`;
      const wrongPassword = 'WrongPassword999!';

      let lastStatus = null;
      let lastBody = null;

      for (let i = 1; i <= 11; i++) {
        const res = await fetch(`${BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: testEmail, password: wrongPassword }),
        });

        lastStatus = res.status;
        lastBody = await res.json();

        if (i <= 10) {
          assert.equal(res.status, 401, `Request ${i} should return 401 Unauthorized`);
        }
      }

      assert.equal(lastStatus, 429, '11th request must return 429 Too Many Requests');
      assert.ok(lastBody.error, 'Response body must contain rate limit error message');
      assert.ok(lastBody.error.includes('Too many attempts'), 'Error message should indicate rate limit exceeded');
    }
  );
});
