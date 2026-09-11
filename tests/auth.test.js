const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const { BASE_URL, registerTestUser, authFetch } = require('./helpers');

async function loginAsSharedUser(sharedUser) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: sharedUser.email, password: sharedUser.password }),
  });

  const body = await res.json();
  assert.equal(res.status, 200, `Login should succeed for shared user: ${JSON.stringify(body)}`);
  return body;
}

describe('Auth API Endpoints', () => {
  let sharedUser;

  before(async () => {
    sharedUser = await registerTestUser();
  });

  describe('POST /auth/register', () => {
    test('successful user registration returns 201 and access token', async () => {
      const email = `auth_reg_${Date.now()}@example.com`;
      const username = `user_${Date.now()}`.slice(0, 30);
      const res = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Auth Test User',
          email,
          username,
          password: 'Password123!',
          timezone: 'UTC',
        }),
      });

      const body = await res.json();
      assert.equal(res.status, 201);
      assert.ok(body.accessToken);
      assert.equal(typeof body.accessToken, 'string');
      assert.ok(body.user);
      assert.equal(body.user.email, email);
      assert.equal(body.user.name, 'Auth Test User');
      assert.equal(body.user.password_hash, undefined);
    });

    test('missing required fields returns 400', async () => {
      const res = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Missing Fields',
          email: 'incomplete@example.com',
        }),
      });

      const body = await res.json();
      assert.equal(res.status, 400);
      assert.ok(body.error);
    });

    test('duplicate email registration returns 409', async () => {
      const uniqueUsername = `uniq_${Date.now()}`.slice(0, 30);
      const res = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Duplicate User',
          email: sharedUser.email,
          username: uniqueUsername,
          password: 'Password123!',
          timezone: 'UTC',
        }),
      });

      const body = await res.json();
      assert.equal(res.status, 409);
      assert.ok(body.error);
    });
  });

  describe('POST /auth/login', () => {
    test('successful login returns access token, refresh token, and user', async () => {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: sharedUser.email,
          password: sharedUser.password,
        }),
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.ok(body.accessToken);
      assert.ok(body.refreshToken);
      assert.ok(body.user);
      assert.equal(body.user.email, sharedUser.email);
    });

    test('login with wrong password returns 401', async () => {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: sharedUser.email,
          password: 'WrongPassword999!',
        }),
      });

      const body = await res.json();
      assert.equal(res.status, 401);
      assert.ok(body.error);
    });

    test('login with nonexistent email returns 401', async () => {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `nonexistent_${Date.now()}@example.com`,
          password: 'Password123!',
        }),
      });

      const body = await res.json();
      assert.equal(res.status, 401);
      assert.ok(body.error);
    });
  });

  describe('POST /auth/refresh', () => {
    test('refresh token rotation returns new token pair and revokes old refresh token', async () => {
      const { refreshToken: oldRefreshToken } = await loginAsSharedUser(sharedUser);

      const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: oldRefreshToken }),
      });

      const refreshBody = await refreshRes.json();
      assert.equal(refreshRes.status, 200);
      assert.ok(refreshBody.accessToken);
      assert.ok(refreshBody.refreshToken);
      assert.notEqual(refreshBody.refreshToken, oldRefreshToken);

      const reuseRes = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: oldRefreshToken }),
      });

      assert.equal(reuseRes.status, 401);
    });
  });

  describe('POST /auth/logout', () => {
    test('logout revokes refresh token and prevents subsequent refresh', async () => {
      const { refreshToken } = await loginAsSharedUser(sharedUser);

      const logoutRes = await fetch(`${BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      const logoutBody = await logoutRes.json();
      assert.equal(logoutRes.status, 200);
      assert.equal(logoutBody.message, 'Logged out.');

      const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      assert.equal(refreshRes.status, 401);
    });
  });

  describe('POST /auth/logout-all', () => {
    test('logout-all revokes all sessions for the authenticated user', async () => {
      const { accessToken, refreshToken } = await loginAsSharedUser(sharedUser);

      const logoutAllRes = await authFetch('/auth/logout-all', { method: 'POST' }, accessToken);
      const logoutAllBody = await logoutAllRes.json();

      assert.equal(logoutAllRes.status, 200);
      assert.equal(logoutAllBody.message, 'All sessions revoked.');

      const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      assert.equal(refreshRes.status, 401);
    });
  });

  describe('GET /auth/me', () => {
    test('returns user profile without password_hash for authenticated request', async () => {
      const { accessToken } = await loginAsSharedUser(sharedUser);

      const res = await authFetch('/auth/me', { method: 'GET' }, accessToken);
      const body = await res.json();

      assert.equal(res.status, 200);
      assert.ok(body.user);
      assert.equal(body.user.email, sharedUser.email);
      assert.equal(body.user.password_hash, undefined);
    });

    test('returns 401 without authentication token', async () => {
      const res = await fetch(`${BASE_URL}/auth/me`);
      assert.equal(res.status, 401);
    });
  });

  describe('Password Reset Workflow', () => {
    const crypto = require('crypto');
    const { Pool } = require('pg');
    const testPool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

    test('POST /auth/reset-password/request returns generic 200 message', async () => {
      const res = await fetch(`${BASE_URL}/auth/reset-password/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: sharedUser.email }),
      });

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.ok(body.message);
      assert.match(body.message, /password reset link has been sent/i);
    });

    test('confirming with valid token resets password and revokes existing sessions', async () => {
      const resetUser = await registerTestUser({ password: 'InitialPass123!' });
      const { refreshToken: activeRefreshToken } = await loginAsSharedUser(resetUser);

      // Create raw token and insert SHA-256 hash into DB
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await testPool.query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
        [resetUser.user.id, tokenHash, expiresAt]
      );

      // Confirm password reset
      const resetRes = await fetch(`${BASE_URL}/auth/reset-password/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: rawToken, newPassword: 'BrandNewPassword456!' }),
      });

      const resetBody = await resetRes.json();
      assert.equal(resetRes.status, 200);
      assert.match(resetBody.message, /password has been reset/i);

      // Old password must fail
      const oldLoginRes = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetUser.email, password: 'InitialPass123!' }),
      });
      assert.equal(oldLoginRes.status, 401);

      // Old refresh token must be revoked
      const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: activeRefreshToken }),
      });
      assert.equal(refreshRes.status, 401);

      // New password must succeed
      const newLoginRes = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetUser.email, password: 'BrandNewPassword456!' }),
      });
      assert.equal(newLoginRes.status, 200);

      // Reusing the same token must fail (used_at is not null)
      const reuseRes = await fetch(`${BASE_URL}/auth/reset-password/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: rawToken, newPassword: 'AnotherPassword789!' }),
      });
      assert.equal(reuseRes.status, 400);
    });

    test('confirming with invalid or nonexistent token returns 400', async () => {
      const res = await fetch(`${BASE_URL}/auth/reset-password/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'completely_invalid_token_12345', newPassword: 'NewPass123!' }),
      });

      assert.equal(res.status, 400);
      const body = await res.json();
      assert.ok(body.error);
    });

    test('confirming with expired token returns 400', async () => {
      const expiredUser = await registerTestUser();
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiredAt = new Date(Date.now() - 60 * 1000); // 1 minute in the past

      await testPool.query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
        [expiredUser.user.id, tokenHash, expiredAt]
      );

      const res = await fetch(`${BASE_URL}/auth/reset-password/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: rawToken, newPassword: 'NewPass123!' }),
      });

      assert.equal(res.status, 400);
      await testPool.end();
    });
  });
});
