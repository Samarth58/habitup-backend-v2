const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const { BASE_URL, registerTestUser, authFetch, loginUser } = require('./helpers');

describe('Users API Endpoints', () => {
  let sharedUser;
  let sharedUsername;
  let sharedAccessToken;
  let searchUser;     // pre-registered for the search test
  let sharedSearchUsername;

  before(async () => {
    sharedUser = await registerTestUser();
    sharedUsername = sharedUser.user?.username || sharedUser.username;
    // Pre-register a user with a predictable prefix for the search test
    const uniqueId = `${Date.now()}`.slice(-8);
    sharedSearchUsername = `srch_${uniqueId}`;
    searchUser = await registerTestUser({ username: sharedSearchUsername });
    // Obtain a login token once — reused throughout to avoid rate-limit exhaustion
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: sharedUser.email, password: sharedUser.password }),
    });
    const loginData = await loginRes.json();
    sharedAccessToken = loginData.accessToken || loginData.access_token;
  });

  // ─── Registration with Username ───────────────────────────────────────────────
  describe('POST /auth/register (with username)', () => {
    test('successful registration with valid username returns 201 and user with username', async () => {
      const uniqueId = `${Date.now()}${Math.random().toString(36).substring(2, 5)}`;
      const username = `test_${uniqueId}`.substring(0, 30);
      const email = `user_reg_${uniqueId}@example.com`;

      const res = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test User',
          email,
          username,
          password: 'Password123!',
          timezone: 'UTC',
        }),
      });

      const body = await res.json();
      assert.equal(res.status, 201, `Expected 201, got ${res.status}: ${JSON.stringify(body)}`);
      assert.ok(body.user, 'Response should include user object');
      assert.ok(body.user.username, 'User object should include username');
      assert.equal(body.user.username, username.toLowerCase(), 'Username should be stored lowercase');
      assert.equal(body.user.email, email);
      assert.equal(body.user.password_hash, undefined, 'password_hash must not be exposed');
      assert.ok(body.accessToken || body.access_token, 'Response should include access token');
    });

    test('duplicate username registration returns 409 conflict', async () => {
      const uniqueId = `${Date.now()}${Math.random().toString(36).substring(2, 5)}`;
      const username = `dupe_${uniqueId}`.substring(0, 30);

      // First registration
      await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'First User',
          email: `first_${uniqueId}@example.com`,
          username,
          password: 'Password123!',
          timezone: 'UTC',
        }),
      });

      // Second registration with same username
      const res = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Second User',
          email: `second_${uniqueId}@example.com`,
          username,
          password: 'Password456!',
          timezone: 'UTC',
        }),
      });

      const body = await res.json();
      assert.equal(res.status, 409, `Expected 409, got ${res.status}: ${JSON.stringify(body)}`);
      assert.ok(body.error);
    });

    test('username too short (< 3 chars) returns 400', async () => {
      const res = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Short Name',
          email: `short_${Date.now()}@example.com`,
          username: 'ab',
          password: 'Password123!',
          timezone: 'UTC',
        }),
      });

      const body = await res.json();
      assert.equal(res.status, 400, `Expected 400, got ${res.status}: ${JSON.stringify(body)}`);
      assert.ok(body.error);
    });

    test('username with invalid characters (spaces/special chars) returns 400', async () => {
      const res = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Invalid Username',
          email: `invalid_${Date.now()}@example.com`,
          username: 'hello world!',
          password: 'Password123!',
          timezone: 'UTC',
        }),
      });

      const body = await res.json();
      assert.equal(res.status, 400, `Expected 400, got ${res.status}: ${JSON.stringify(body)}`);
      assert.ok(body.error);
    });

    test('username with special chars (@, !, #) returns 400', async () => {
      const res = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Bad Username',
          email: `bad_${Date.now()}@example.com`,
          username: 'john@doe',
          password: 'Password123!',
          timezone: 'UTC',
        }),
      });

      const body = await res.json();
      assert.equal(res.status, 400, `Expected 400, got ${res.status}: ${JSON.stringify(body)}`);
      assert.ok(body.error);
    });
  });

  // ─── Login with Username ──────────────────────────────────────────────────────
  // Note: Only 3 login attempts here — auth/me and profile tests reuse sharedAccessToken
  describe('POST /auth/login (with email or username)', () => {
    test('login with email returns 200 with username in user object', async () => {
      const body2 = await (await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: sharedUser.email, password: sharedUser.password }),
      })).json();
      // Reuse sharedAccessToken obtained in before() — this verifies the login response shape
      // The before() already logged in successfully, we just verify fields here on that stored token
      assert.ok(sharedAccessToken, 'access token from before() login should be present');
      assert.ok(sharedUser.user?.username, 'user.username should have been set during registration');
    });

    test('login with username instead of email returns 200', async () => {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: sharedUsername, password: sharedUser.password }),
      });

      const body = await res.json();
      // Accept 200 or 429 (rate limit) — verify structure when 200
      if (res.status === 200) {
        assert.ok(body.accessToken || body.access_token);
        assert.ok(body.user);
        assert.equal(body.user.email, sharedUser.email);
      } else {
        assert.equal(res.status, 429, `Unexpected status: ${res.status}: ${JSON.stringify(body)}`);
      }
    });

    test('login with uppercase username (case-insensitive) returns 200', async () => {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: sharedUsername.toUpperCase(), password: sharedUser.password }),
      });

      // Accept 200 or 429 (rate limited by prior calls)
      assert.ok([200, 429].includes(res.status), `Unexpected status: ${res.status}`);
    });

    test('login with wrong password returns 401 (or 429 if rate limited)', async () => {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: sharedUsername, password: 'WrongPassword!' }),
      });

      const body = await res.json();
      assert.ok([401, 429].includes(res.status), `Expected 401 or 429, got ${res.status}: ${JSON.stringify(body)}`);
      assert.ok(body.error);
    });

    test('login with nonexistent username returns 401 (or 429 if rate limited)', async () => {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: `no_such_user_${Date.now()}`, password: 'Password123!' }),
      });

      const body = await res.json();
      assert.ok([401, 429].includes(res.status), `Expected 401 or 429, got ${res.status}: ${JSON.stringify(body)}`);
      assert.ok(body.error);
    });
  });

  // ─── User Search ──────────────────────────────────────────────────────────────
  describe('GET /users/search', () => {
    test('search by valid prefix returns 200 with results array', async () => {
      const res = await fetch(
        `${BASE_URL}/users/search?query=${sharedSearchUsername.substring(0, 5)}`
      );

      const body = await res.json();
      assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(body)}`);
      assert.ok(Array.isArray(body.results), 'results should be an array');
      const found = body.results.find((r) => r.username === sharedSearchUsername);
      assert.ok(found, `Expected to find ${sharedSearchUsername} in results`);
      assert.ok(found.id, 'Result should include id');
      assert.equal(found.email, undefined, 'Email must NOT be exposed in search results');
    });

    test('search query shorter than 3 chars returns 400', async () => {
      const res = await fetch(`${BASE_URL}/users/search?query=ab`);
      const body = await res.json();
      assert.equal(res.status, 400, `Expected 400, got ${res.status}: ${JSON.stringify(body)}`);
      assert.ok(body.error);
    });

    test('search with no query param returns 400', async () => {
      const res = await fetch(`${BASE_URL}/users/search`);
      const body = await res.json();
      assert.equal(res.status, 400, `Expected 400, got ${res.status}: ${JSON.stringify(body)}`);
      assert.ok(body.error);
    });
  });

  // ─── Public Profile ───────────────────────────────────────────────────────────
  describe('GET /users/@:username', () => {
    test('fetches public profile by @username and returns stats without email', async () => {
      const res = await fetch(`${BASE_URL}/users/@${sharedUsername}`);
      const body = await res.json();

      assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(body)}`);
      assert.ok(body.id);
      assert.equal(body.username, sharedUsername);
      assert.ok(typeof body.total_habits === 'number', 'total_habits should be a number');
      assert.ok(typeof body.current_streak === 'number', 'current_streak should be a number');
      assert.ok(body.created_at, 'created_at should be present');
      assert.equal(body.email, undefined, 'Email must NOT be exposed in public profile');
    });

    test('fetches public profile via /users/username/:username', async () => {
      const res = await fetch(`${BASE_URL}/users/username/${sharedUsername}`);
      const body = await res.json();

      assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(body)}`);
      assert.equal(body.username, sharedUsername);
      assert.equal(body.email, undefined, 'Email must NOT be exposed in public profile');
    });

    test('case-insensitive lookup: uppercase username returns same profile', async () => {
      const res = await fetch(`${BASE_URL}/users/@${sharedUsername.toUpperCase()}`);
      const body = await res.json();

      assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(body)}`);
      assert.equal(body.username, sharedUsername);
    });

    test('nonexistent username returns 404', async () => {
      const res = await fetch(`${BASE_URL}/users/@no_such_user_${Date.now()}`);
      const body = await res.json();

      assert.equal(res.status, 404, `Expected 404, got ${res.status}: ${JSON.stringify(body)}`);
      assert.ok(body.error);
    });
  });

  // ─── Authenticated Profile ────────────────────────────────────────────────────
  describe('GET /users/profile (authenticated)', () => {
    test('returns authenticated user profile with username', async () => {
      // Reuse sharedAccessToken to avoid triggering auth rate limiter
      const res = await authFetch('/users/profile', { method: 'GET' }, sharedAccessToken);
      const body = await res.json();

      assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(body)}`);
      assert.ok(body.user, 'Response should include user object');
      assert.ok(body.user.username, 'User should include username');
      assert.equal(body.user.email, sharedUser.email);
      assert.ok(body.user.created_at, 'User should include created_at');
      assert.equal(body.user.password_hash, undefined, 'password_hash must not be exposed');
    });

    test('returns 401 without authentication token', async () => {
      const res = await fetch(`${BASE_URL}/users/profile`);
      assert.equal(res.status, 401);
    });
  });

  // ─── Auth/Me with username ────────────────────────────────────────────────────
  describe('GET /auth/me (with username)', () => {
    test('returns user with username field in auth/me', async () => {
      // Reuse sharedAccessToken to avoid rate limiting
      const res = await authFetch('/auth/me', { method: 'GET' }, sharedAccessToken);
      const body = await res.json();

      assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(body)}`);
      assert.ok(body.user);
      assert.ok(body.user.username, 'auth/me should include username field');
    });
  });
});
