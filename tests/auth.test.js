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
      const res = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Auth Test User',
          email,
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
      const res = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Duplicate User',
          email: sharedUser.email,
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
});
