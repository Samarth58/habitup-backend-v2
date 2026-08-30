const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

/**
 * Registers a fresh timestamped user for test isolation.
 * @param {object} overrides Custom field overrides (email, password, name, timezone).
 * @returns {Promise<{ email: string, password: string, name: string, timezone: string, accessToken: string, user: object }>}
 */
async function registerTestUser(overrides = {}) {
  const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const email = overrides.email || `test_${uniqueId}@example.com`;
  const password = overrides.password || 'Password123!';
  const name = overrides.name || 'Test User';
  const timezone = overrides.timezone || 'UTC';

  const res = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password, timezone }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Failed to register test user (${res.status}): ${JSON.stringify(data)}`);
  }

  return {
    email,
    password,
    name,
    timezone,
    accessToken: data.accessToken,
    user: data.user,
  };
}

/**
 * Makes an HTTP fetch request with optional Bearer Authorization token attached.
 * @param {string} pathOrUrl Path relative to BASE_URL or full URL.
 * @param {object} options standard fetch options.
 * @param {string} [token] Optional JWT access token.
 * @returns {Promise<Response>}
 */
async function authFetch(pathOrUrl, options = {}, token) {
  const url = pathOrUrl.startsWith('http')
    ? pathOrUrl
    : `${BASE_URL}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return fetch(url, { ...options, headers });
}

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';
const INVALID_UUID = 'not-a-uuid';

module.exports = {
  BASE_URL,
  registerTestUser,
  authFetch,
  VALID_UUID,
  INVALID_UUID,
};
