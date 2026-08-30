const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const { BASE_URL, registerTestUser, authFetch, INVALID_UUID } = require('./helpers');

describe('Security & Authentication Enforcements', () => {
  let user;

  before(async () => {
    user = await registerTestUser();
  });

  describe('Malformed UUID Path Parameters', () => {
    test('malformed UUID in habit :id path returns 400 Bad Request', async () => {
      const res = await authFetch(`/habits/${INVALID_UUID}`, { method: 'GET' }, user.accessToken);

      assert.equal(res.status, 400);
      const body = await res.json();
      assert.ok(body.error);
    });

    test('malformed UUID in habit stats :id path returns 400 Bad Request', async () => {
      const res = await authFetch(`/habits/${INVALID_UUID}/stats`, { method: 'GET' }, user.accessToken);

      assert.equal(res.status, 400);
    });
  });

  describe('Unauthenticated Access Controls', () => {
    test('GET /habits without Authorization header returns 401', async () => {
      const res = await fetch(`${BASE_URL}/habits`);
      assert.equal(res.status, 401);
      const body = await res.json();
      assert.ok(body.error);
    });

    test('POST /habits without Authorization header returns 401', async () => {
      const res = await fetch(`${BASE_URL}/habits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Unauthorized Habit', frequency_type: 'daily' }),
      });
      assert.equal(res.status, 401);
    });

    test('GET /stats without Authorization header returns 401', async () => {
      const res = await fetch(`${BASE_URL}/stats`);
      assert.equal(res.status, 401);
    });
  });

  describe('Invalid Bearer Token Handlers', () => {
    test('request with malformed JWT token returns 401', async () => {
      const res = await fetch(`${BASE_URL}/habits`, {
        headers: {
          Authorization: 'Bearer invalid.jwt.token',
          'Content-Type': 'application/json',
        },
      });
      assert.equal(res.status, 401);
      const body = await res.json();
      assert.equal(body.error, 'Invalid access token.');
    });

    test('request with missing Bearer prefix returns 401', async () => {
      const res = await fetch(`${BASE_URL}/habits`, {
        headers: {
          Authorization: user.accessToken, // Missing 'Bearer '
          'Content-Type': 'application/json',
        },
      });
      assert.equal(res.status, 401);
      const body = await res.json();
      assert.equal(body.error, 'Authorization header missing or malformed.');
    });
  });
});
