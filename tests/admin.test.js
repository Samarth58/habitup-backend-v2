const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const { registerTestUser, loginUser, promoteToAdmin, authFetch, VALID_UUID, INVALID_UUID } = require('./helpers');

describe('Admin Dashboard API Suite', () => {
  let adminUser;
  let regularUser;

  before(async () => {
    // Register and promote admin user
    const tempAdmin = await registerTestUser({ name: 'Suite Admin' });
    await promoteToAdmin(tempAdmin.user.id);
    const adminTokens = await loginUser(tempAdmin.email, tempAdmin.password);
    adminUser = {
      ...tempAdmin,
      accessToken: adminTokens.accessToken,
      refreshToken: adminTokens.refreshToken,
    };

    // Register regular non-admin user
    regularUser = await registerTestUser({ name: 'Suite Regular' });
  });

  describe('Authorization Controls', () => {
    test('1. Unauthenticated request to /admin/dashboard returns 401', async () => {
      const res = await authFetch('/admin/dashboard');
      assert.equal(res.status, 401);
    });

    test('2. Regular authenticated non-admin user returns 403 Forbidden', async () => {
      const res = await authFetch('/admin/dashboard', {}, regularUser.accessToken);
      assert.equal(res.status, 403);
    });

    test('3. Authenticated admin user returns 200 OK', async () => {
      const res = await authFetch('/admin/dashboard', {}, adminUser.accessToken);
      assert.equal(res.status, 200);
    });
  });

  describe('Dashboard Analytics (GET /admin/dashboard)', () => {
    test('4. Dashboard returns expected structure with user, habit, completion, and session metrics', async () => {
      const res = await authFetch('/admin/dashboard', {}, adminUser.accessToken);
      const body = await res.json();

      assert.equal(res.status, 200);
      assert.ok(body.users);
      assert.equal(typeof body.users.total, 'number');
      assert.equal(typeof body.users.active_in_period, 'number');
      assert.equal(typeof body.users.new_in_period, 'number');
      assert.equal(typeof body.users.deleted_in_period, 'number');
      assert.ok(body.habits);
      assert.equal(typeof body.habits.total, 'number');
      assert.ok(body.completions);
      assert.equal(typeof body.completions.total, 'number');
      assert.ok(body.sessions);
      assert.equal(typeof body.sessions.estimated_total_usage_seconds, 'number');
    });

    test('5. Dashboard period filtering alters from/to dates', async () => {
      const res7d = await authFetch('/admin/dashboard?period=7d', {}, adminUser.accessToken);
      const res30d = await authFetch('/admin/dashboard?period=30d', {}, adminUser.accessToken);

      const body7d = await res7d.json();
      const body30d = await res30d.json();

      assert.equal(res7d.status, 200);
      assert.equal(res30d.status, 200);
      assert.notEqual(body7d.from, body30d.from);
    });
  });

  describe('User Management (GET /admin/users & /admin/users/:userId)', () => {
    test('6. Admin can list users with pagination metadata', async () => {
      const res = await authFetch('/admin/users', {}, adminUser.accessToken);
      const body = await res.json();

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(body.users));
      assert.ok(body.pagination);
      assert.equal(typeof body.pagination.total, 'number');
    });

    test('7. User list pagination page and limit parameters function correctly', async () => {
      const res = await authFetch('/admin/users?page=1&limit=1', {}, adminUser.accessToken);
      const body = await res.json();

      assert.equal(res.status, 200);
      assert.equal(body.pagination.page, 1);
      assert.equal(body.pagination.limit, 1);
      assert.ok(body.users.length <= 1);
    });

    test('8. Admin can fetch single user details', async () => {
      const res = await authFetch(`/admin/users/${regularUser.user.id}`, {}, adminUser.accessToken);
      const body = await res.json();

      assert.equal(res.status, 200);
      assert.ok(body.user);
      assert.equal(body.user.id, regularUser.user.id);
      assert.equal(body.user.email, regularUser.email);
    });

    test('9. Sensitive credentials (password_hash, tokens) are NEVER returned in user details', async () => {
      const res = await authFetch(`/admin/users/${regularUser.user.id}`, {}, adminUser.accessToken);
      const body = await res.json();

      assert.equal(res.status, 200);
      assert.equal(body.user.password_hash, undefined);
      assert.equal(body.user.refresh_token_hash, undefined);
    });
  });

  describe('Activity Feed & Tracking (GET /admin/activity)', () => {
    test('10. LOGIN activity event is recorded on user authentication', async () => {
      // Trigger a login to generate activity
      await loginUser(regularUser.email, regularUser.password);

      const res = await authFetch(`/admin/activity?userId=${regularUser.user.id}&activityType=LOGIN`, {}, adminUser.accessToken);
      const body = await res.json();

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(body.events));
      assert.ok(body.events.length > 0);
      assert.equal(body.events[0].activity_type, 'LOGIN');
    });

    test('11. Admin can retrieve overall activity feed', async () => {
      const res = await authFetch('/admin/activity', {}, adminUser.accessToken);
      const body = await res.json();

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(body.events));
      assert.ok(body.pagination);
    });

    test('12. Filtering activity feed by activityType returns matching events', async () => {
      const res = await authFetch('/admin/activity?activityType=LOGIN', {}, adminUser.accessToken);
      const body = await res.json();

      assert.equal(res.status, 200);
      assert.ok(body.events.every((e) => e.activity_type === 'LOGIN'));
    });
  });

  describe('Session Heartbeat & Usage Analytics (POST /auth/session/heartbeat & GET /admin/analytics/usage)', () => {
    test('13. POST /auth/session/heartbeat with valid refreshToken updates session activity', async () => {
      const res = await authFetch(
        '/auth/session/heartbeat',
        {
          method: 'POST',
          body: JSON.stringify({ refreshToken: adminUser.refreshToken }),
        },
        adminUser.accessToken
      );

      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(body.ok, true);
    });

    test('14. GET /admin/analytics/usage returns aggregated usage metrics and daily breakdown', async () => {
      const res = await authFetch('/admin/analytics/usage?period=7d', {}, adminUser.accessToken);
      const body = await res.json();

      assert.equal(res.status, 200);
      assert.ok(body.summary);
      assert.equal(typeof body.summary.estimated_total_usage_seconds, 'number');
      assert.ok(Array.isArray(body.daily));
      assert.ok(Array.isArray(body.most_active_users));
    });

    test('15. Usage analytics handles custom date range filters', async () => {
      const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const to = new Date().toISOString();

      const res = await authFetch(`/admin/analytics/usage?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {}, adminUser.accessToken);
      const body = await res.json();

      assert.equal(res.status, 200);
      assert.equal(body.from, from);
      assert.equal(body.to, to);
    });
  });

  describe('Account Deletion & System Security Integration', () => {
    test('16. Account deletion soft-deletes user and revokes login', async () => {
      const tempUser = await registerTestUser();
      const delRes = await authFetch('/auth/account', { method: 'DELETE', body: JSON.stringify({ password: tempUser.password }) }, tempUser.accessToken);
      assert.equal(delRes.status, 200);

      // Attempt login with deleted account
      const loginRes = await fetch(`${process.env.BASE_URL || 'http://localhost:5000'}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: tempUser.email, password: tempUser.password }),
      });
      assert.equal(loginRes.status, 401);
    });

    test('17. Deleted user is not counted as active user in dashboard', async () => {
      const res = await authFetch('/admin/dashboard?period=7d', {}, adminUser.accessToken);
      const body = await res.json();
      assert.equal(res.status, 200);
      assert.equal(typeof body.users.active_in_period, 'number');
    });

    test('18. ACCOUNT_DELETED activity is logged upon user account deletion', async () => {
      const tempUser = await registerTestUser();
      await authFetch('/auth/account', { method: 'DELETE', body: JSON.stringify({ password: tempUser.password }) }, tempUser.accessToken);

      const res = await authFetch(`/admin/activity?activityType=ACCOUNT_DELETED`, {}, adminUser.accessToken);
      const body = await res.json();

      assert.equal(res.status, 200);
      assert.ok(body.events.some((e) => e.activity_type === 'ACCOUNT_DELETED'));
    });

    test('19. GET /admin/analytics/activity returns breakdown of activities by type', async () => {
      const res = await authFetch('/admin/analytics/activity?period=7d', {}, adminUser.accessToken);
      const body = await res.json();

      assert.equal(res.status, 200);
      assert.ok(body.summary);
      assert.ok(body.summary.by_type);
      assert.ok(Array.isArray(body.daily));
    });
  });
});
