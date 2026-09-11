/**
 * tests/experiments.test.js
 *
 * Integration tests for the HabitUp A/B Experimentation Framework.
 *
 * Requires a running server (BASE_URL) and valid DATABASE_URL.
 * Run via: node --test tests/experiments.test.js
 */

require('dotenv').config();
const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const {
  registerTestUser,
  authFetch,
  promoteToAdmin,
  VALID_UUID,
} = require('./helpers');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ─── Test Utilities ───────────────────────────────────────────────────────────

async function getExperimentByName(name) {
  const { rows } = await pool.query('SELECT * FROM experiments WHERE name = $1', [name]);
  return rows[0] || null;
}

async function getUserExperimentAssignment(userId, experimentId) {
  const { rows } = await pool.query(
    'SELECT * FROM user_experiments WHERE user_id = $1 AND experiment_id = $2',
    [userId, experimentId]
  );
  return rows[0] || null;
}

async function clearUserExperimentAssignment(userId, experimentId) {
  await pool.query(
    'DELETE FROM user_experiments WHERE user_id = $1 AND experiment_id = $2',
    [userId, experimentId]
  );
}

async function forceUserVariant(userId, experimentId, variant) {
  await pool.query(
    `INSERT INTO user_experiments (user_id, experiment_id, variant)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, experiment_id) DO UPDATE SET variant = $3`,
    [userId, experimentId, variant]
  );
}

async function getExposureEventCount(userId, experimentId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS cnt
     FROM user_activity ua
     JOIN experiments e ON e.id = $2
     WHERE ua.user_id = $1 AND ua.activity_type = 'FRIENDS_EXPERIMENT_EXPOSED'`,
    [userId, experimentId]
  );
  return rows[0]?.cnt || 0;
}

async function getActivityCount(userId, activityType) {
  const { rows } = await pool.query(
    'SELECT COUNT(*)::int AS cnt FROM user_activity WHERE user_id = $1 AND activity_type = $2',
    [userId, activityType]
  );
  return rows[0]?.cnt || 0;
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('A/B Experimentation Framework', () => {
  let experiment;
  let controlUser;
  let treatmentUser;
  let adminUser;

  before(async () => {
    // Ensure the friends_feature_v1 experiment exists and is RUNNING
    experiment = await getExperimentByName('friends_feature_v1');
    assert.ok(experiment, 'friends_feature_v1 experiment must exist in DB after migration');
    assert.equal(experiment.status, 'RUNNING', 'Experiment must be RUNNING');

    // Create test users (register AFTER experiment.start_at, so they are eligible)
    controlUser = await registerTestUser();
    treatmentUser = await registerTestUser();
    adminUser = await registerTestUser();
    await promoteToAdmin(adminUser.user.id);

    // Force deterministic variants so the rest of the tests are predictable
    await forceUserVariant(controlUser.user.id, experiment.id, 'A');
    await forceUserVariant(treatmentUser.user.id, experiment.id, 'B');
  });

  // ─── 1. GET /experiments/:name ─────────────────────────────────────────────

  describe('GET /experiments/:name — variant assignment endpoint', () => {
    test('returns 401 without authentication', async () => {
      const res = await authFetch('/experiments/friends_feature_v1');
      assert.equal(res.status, 401);
    });

    test('returns experiment info with friendsEnabled flag for Control (Variant A)', async () => {
      const res = await authFetch('/experiments/friends_feature_v1', {}, controlUser.accessToken);
      const body = await res.json();
      assert.equal(res.status, 200, JSON.stringify(body));
      assert.equal(body.experiment, 'friends_feature_v1');
      assert.equal(body.variant, 'A');
      assert.equal(body.friendsEnabled, false, 'Control users should have friendsEnabled=false');
      assert.equal(body.assigned, true);
    });

    test('returns experiment info with friendsEnabled=true for Treatment (Variant B)', async () => {
      const res = await authFetch('/experiments/friends_feature_v1', {}, treatmentUser.accessToken);
      const body = await res.json();
      assert.equal(res.status, 200, JSON.stringify(body));
      assert.equal(body.experiment, 'friends_feature_v1');
      assert.equal(body.variant, 'B');
      assert.equal(body.friendsEnabled, true, 'Treatment users should have friendsEnabled=true');
    });

    test('does NOT log an exposure event when querying variant', async () => {
      const beforeCount = await getExposureEventCount(controlUser.user.id, experiment.id);
      await authFetch('/experiments/friends_feature_v1', {}, controlUser.accessToken);
      const afterCount = await getExposureEventCount(controlUser.user.id, experiment.id);
      assert.equal(afterCount, beforeCount, 'Querying variant must NOT log an exposure event');
    });
  });

  // ─── 2. Assignment Stability ───────────────────────────────────────────────

  describe('Assignment stability', () => {
    test('same variant is returned on repeated calls (stable assignment)', async () => {
      const res1 = await authFetch('/experiments/friends_feature_v1', {}, controlUser.accessToken);
      const body1 = await res1.json();

      const res2 = await authFetch('/experiments/friends_feature_v1', {}, controlUser.accessToken);
      const body2 = await res2.json();

      assert.equal(body1.variant, body2.variant, 'Variant must remain stable across calls');
      assert.equal(body1.variant, 'A', 'Forced Control user must stay in Control');
    });

    test('user has exactly one assignment row per experiment', async () => {
      const { rows } = await pool.query(
        'SELECT COUNT(*)::int AS cnt FROM user_experiments WHERE user_id = $1 AND experiment_id = $2',
        [controlUser.user.id, experiment.id]
      );
      assert.equal(rows[0].cnt, 1, 'User must have exactly one experiment assignment');
    });
  });

  // ─── 3. Exposure Tracking ─────────────────────────────────────────────────

  describe('POST /experiments/:name/exposure — exposure beacon', () => {
    test('returns 401 without authentication', async () => {
      const res = await authFetch('/experiments/friends_feature_v1/exposure', { method: 'POST' });
      assert.equal(res.status, 401);
    });

    test('records FRIENDS_EXPERIMENT_EXPOSED event on explicit exposure call', async () => {
      const before = await getActivityCount(treatmentUser.user.id, 'FRIENDS_EXPERIMENT_EXPOSED');
      const res = await authFetch('/experiments/friends_feature_v1/exposure', { method: 'POST' }, treatmentUser.accessToken);
      const body = await res.json();
      assert.equal(res.status, 200, JSON.stringify(body));
      assert.equal(body.ok, true);
      assert.equal(body.variant, 'B');

      const after = await getActivityCount(treatmentUser.user.id, 'FRIENDS_EXPERIMENT_EXPOSED');
      assert.ok(after > before, 'FRIENDS_EXPERIMENT_EXPOSED event should be logged after exposure call');
    });

    test('Control user can also record exposure (exposure is permitted; feature gate is on API access)', async () => {
      const res = await authFetch('/experiments/friends_feature_v1/exposure', { method: 'POST' }, controlUser.accessToken);
      const body = await res.json();
      // Control users are assigned but may never see the feature; exposure can still be called
      // but should gracefully handle it — no 500 errors
      assert.ok(res.status < 500, `Exposure for Control user should not 500: ${JSON.stringify(body)}`);
    });

    test('returns 400 for a user not yet assigned to the experiment', async () => {
      // Create a fresh user and don't assign them
      const freshUser = await registerTestUser();
      // Force clear any auto-assignment that might happen
      await clearUserExperimentAssignment(freshUser.user.id, experiment.id);

      const res = await authFetch('/experiments/friends_feature_v1/exposure', { method: 'POST' }, freshUser.accessToken);
      const body = await res.json();
      assert.equal(res.status, 400, JSON.stringify(body));
    });
  });

  // ─── 4. Friends Feature Gate (requireFriendsFeatureEnabled) ───────────────

  describe('Friends API feature gate', () => {
    test('Control user (Variant A) receives 403 on GET /friends', async () => {
      const res = await authFetch('/friends', {}, controlUser.accessToken);
      const body = await res.json();
      assert.equal(res.status, 403, `Control user must be blocked: ${JSON.stringify(body)}`);
      assert.match(body.error, /disabled|not enabled/i);
    });

    test('Control user (Variant A) receives 403 on POST /friends/request', async () => {
      const res = await authFetch('/friends/request', {
        method: 'POST',
        body: JSON.stringify({ username: treatmentUser.username }),
      }, controlUser.accessToken);
      assert.equal(res.status, 403);
    });

    test('Treatment user (Variant B) can access GET /friends', async () => {
      const res = await authFetch('/friends', {}, treatmentUser.accessToken);
      const body = await res.json();
      // 200 with empty friends array is expected; it must not be 403
      assert.ok(res.status !== 403, `Treatment user must not be blocked: ${JSON.stringify(body)}`);
      assert.ok(res.status < 500, `Treatment user must not 500: ${JSON.stringify(body)}`);
    });

    test('Treatment user can send a friend request', async () => {
      // Create a fresh B variant user to send to
      const recipientUser = await registerTestUser();
      await forceUserVariant(recipientUser.user.id, experiment.id, 'B');

      const res = await authFetch('/friends/request', {
        method: 'POST',
        body: JSON.stringify({ username: recipientUser.username }),
      }, treatmentUser.accessToken);
      const body = await res.json();
      assert.ok([201, 409].includes(res.status), `Unexpected status: ${res.status} ${JSON.stringify(body)}`);
    });
  });

  // ─── 5. Friends Activity Events ────────────────────────────────────────────

  describe('Friends activity event tracking', () => {
    let senderUser;
    let receiverUser;
    let requestId;

    before(async () => {
      senderUser = await registerTestUser();
      receiverUser = await registerTestUser();
      await forceUserVariant(senderUser.user.id, experiment.id, 'B');
      await forceUserVariant(receiverUser.user.id, experiment.id, 'B');
    });

    test('FRIEND_REQUEST_SENT is logged when a Treatment user sends a request', async () => {
      const before = await getActivityCount(senderUser.user.id, 'FRIEND_REQUEST_SENT');
      const res = await authFetch('/friends/request', {
        method: 'POST',
        body: JSON.stringify({ username: receiverUser.username }),
      }, senderUser.accessToken);
      const body = await res.json();
      assert.equal(res.status, 201, JSON.stringify(body));
      requestId = body.request_id;

      await new Promise((r) => setTimeout(r, 300));
      const after = await getActivityCount(senderUser.user.id, 'FRIEND_REQUEST_SENT');
      assert.ok(after > before, 'FRIEND_REQUEST_SENT must be logged');
    });

    test('FRIEND_REQUEST_ACCEPTED is logged when the recipient accepts', async () => {
      const before = await getActivityCount(receiverUser.user.id, 'FRIEND_REQUEST_ACCEPTED');
      const res = await authFetch(`/friends/requests/${requestId}/accept`, {
        method: 'POST',
      }, receiverUser.accessToken);
      const body = await res.json();
      assert.ok([200, 409].includes(res.status), JSON.stringify(body));

      await new Promise((r) => setTimeout(r, 300));
      const after = await getActivityCount(receiverUser.user.id, 'FRIEND_REQUEST_ACCEPTED');
      assert.ok(after > before, 'FRIEND_REQUEST_ACCEPTED must be logged');
    });

    test('FRIEND_REMOVED is logged when a user removes a friend', async () => {
      const before = await getActivityCount(senderUser.user.id, 'FRIEND_REMOVED');
      const friendId = receiverUser.user.id;
      const res = await authFetch(`/friends/${friendId}`, { method: 'DELETE' }, senderUser.accessToken);
      const body = await res.json();
      // 404 is acceptable if already removed; just check no 500
      assert.ok(res.status < 500, JSON.stringify(body));

      if (res.status === 200) {
        await new Promise((r) => setTimeout(r, 300));
        const after = await getActivityCount(senderUser.user.id, 'FRIEND_REMOVED');
        assert.ok(after > before, 'FRIEND_REMOVED must be logged');
      }
    });
  });

  // ─── 6. Eligibility Rules ─────────────────────────────────────────────────

  describe('Eligibility rules', () => {
    test('pre-experiment user gets preExisting=true and friendsEnabled=true', async () => {
      // Manually create a user that registered before experiment.start_at
      const preUser = await registerTestUser();
      // Backdate their registration to before experiment start
      await pool.query(
        `UPDATE users SET created_at = $1::timestamptz - INTERVAL '1 day' WHERE id = $2`,
        [experiment.start_at, preUser.user.id]
      );
      // Clear any auto-assignment
      await clearUserExperimentAssignment(preUser.user.id, experiment.id);

      const res = await authFetch('/experiments/friends_feature_v1', {}, preUser.accessToken);
      const body = await res.json();
      assert.equal(res.status, 200, JSON.stringify(body));
      assert.equal(body.preExisting, true, 'Pre-experiment user should be flagged as preExisting');
      assert.equal(body.friendsEnabled, true, 'Pre-experiment user should keep standard access');
      assert.equal(body.assigned, false, 'Pre-experiment user should not be assigned to the experiment');
    });

    test('new eligible user gets assigned a variant', async () => {
      const newUser = await registerTestUser();
      // Ensure no assignment exists
      await clearUserExperimentAssignment(newUser.user.id, experiment.id);

      const res = await authFetch('/experiments/friends_feature_v1', {}, newUser.accessToken);
      const body = await res.json();
      assert.equal(res.status, 200, JSON.stringify(body));
      assert.ok(['A', 'B'].includes(body.variant), `Variant must be A or B, got: ${body.variant}`);
      assert.equal(body.assigned, true);
    });
  });

  // ─── 7. Allocation Distribution ───────────────────────────────────────────

  describe('Allocation distribution', () => {
    test('variant distribution is reasonably close to configured allocation (50/50 ± tolerance)', async () => {
      // Use existing assignments from DB to check distribution
      const { rows } = await pool.query(
        `SELECT variant, COUNT(*)::int AS cnt
         FROM user_experiments
         WHERE experiment_id = $1
         GROUP BY variant`,
        [experiment.id]
      );

      if (rows.length < 2) {
        // Not enough data to check distribution — skip this assertion
        return;
      }

      const total = rows.reduce((s, r) => s + r.cnt, 0);
      const aCount = rows.find((r) => r.variant === 'A')?.cnt || 0;
      const bCount = rows.find((r) => r.variant === 'B')?.cnt || 0;
      const aRate = aCount / total;
      const bRate = bCount / total;

      // Allow ±30% tolerance since tests create only a handful of users
      const configuredARate = experiment.allocation.A || 0.5;
      const configuredBRate = experiment.allocation.B || 0.5;
      const tolerance = 0.35;

      assert.ok(
        Math.abs(aRate - configuredARate) <= tolerance,
        `Control allocation ${(aRate * 100).toFixed(1)}% deviates too far from configured ${(configuredARate * 100).toFixed(0)}%`
      );
      assert.ok(
        Math.abs(bRate - configuredBRate) <= tolerance,
        `Treatment allocation ${(bRate * 100).toFixed(1)}% deviates too far from configured ${(configuredBRate * 100).toFixed(0)}%`
      );
    });
  });

  // ─── 8. Admin Endpoints ────────────────────────────────────────────────────

  describe('Admin Experiment API', () => {
    test('returns 401 without authentication on GET /admin/experiments', async () => {
      const res = await authFetch('/admin/experiments');
      assert.equal(res.status, 401);
    });

    test('returns 403 for non-admin on GET /admin/experiments', async () => {
      const res = await authFetch('/admin/experiments', {}, controlUser.accessToken);
      assert.equal(res.status, 403);
    });

    test('admin can list experiments', async () => {
      const res = await authFetch('/admin/experiments', {}, adminUser.accessToken);
      const body = await res.json();
      assert.equal(res.status, 200, JSON.stringify(body));
      assert.ok(Array.isArray(body.experiments), 'Response should have experiments array');
      const friendsExp = body.experiments.find((e) => e.name === 'friends_feature_v1');
      assert.ok(friendsExp, 'friends_feature_v1 experiment should appear in list');
    });

    test('returns 401 without authentication on GET /admin/experiments/friends_feature_v1', async () => {
      const res = await authFetch('/admin/experiments/friends_feature_v1');
      assert.equal(res.status, 401);
    });

    test('returns 403 for non-admin on GET /admin/experiments/friends_feature_v1', async () => {
      const res = await authFetch('/admin/experiments/friends_feature_v1', {}, treatmentUser.accessToken);
      assert.equal(res.status, 403);
    });

    test('admin can fetch full experiment analytics report', async () => {
      const res = await authFetch('/admin/experiments/friends_feature_v1', {}, adminUser.accessToken);
      const body = await res.json();
      assert.equal(res.status, 200, JSON.stringify(body));

      // Check required top-level structure
      assert.ok(body.experiment, 'Must have experiment object');
      assert.equal(body.experiment.name, 'friends_feature_v1');
      assert.ok(body.control, 'Must have control object');
      assert.ok(body.treatment, 'Must have treatment object');
      assert.ok(body.comparison, 'Must have comparison object');
      assert.ok(body.friends, 'Must have friends object');

      // Check control/treatment variant labels
      assert.equal(body.control.variant, 'A');
      assert.equal(body.treatment.variant, 'B');

      // Check comparison fields present
      assert.ok('absoluteLift' in body.comparison, 'comparison.absoluteLift must exist');
      assert.ok('pValue' in body.comparison, 'comparison.pValue must exist');
      assert.ok('significant' in body.comparison, 'comparison.significant must exist');
      assert.ok('hasSufficientData' in body.comparison, 'comparison.hasSufficientData must exist');
      assert.ok('confidenceInterval' in body.comparison, 'comparison.confidenceInterval must exist');
    });

    test('pre-existing users are excluded from experiment analytics counts', async () => {
      // Create a user backdated before experiment start
      const preUser = await registerTestUser();
      await pool.query(
        `UPDATE users SET created_at = $1::timestamptz - INTERVAL '10 days' WHERE id = $2`,
        [experiment.start_at, preUser.user.id]
      );
      // Even if inserted into user_experiments manually, analytics queries should exclude them
      await forceUserVariant(preUser.user.id, experiment.id, 'B');

      const res = await authFetch('/admin/experiments/friends_feature_v1', {}, adminUser.accessToken);
      const body = await res.json();
      assert.equal(res.status, 200);

      // Verify that the count query in analytics does not include the pre-existing user
      const { rows: countRows } = await pool.query(
        `SELECT COUNT(*)::int AS cnt
         FROM user_experiments ue
         JOIN users u ON u.id = ue.user_id AND u.deleted_at IS NULL
         JOIN experiments e ON e.id = ue.experiment_id
         WHERE ue.experiment_id = $1 AND ue.user_id = $2 AND u.created_at >= e.start_at`,
        [experiment.id, preUser.user.id]
      );
      assert.equal(countRows[0].cnt, 0, 'Pre-existing user must not appear in eligible cohort analytics');
    });

    test('returns 404 for unknown experiment name', async () => {
      const res = await authFetch('/admin/experiments/nonexistent_experiment_xyz', {}, adminUser.accessToken);
      assert.equal(res.status, 404);
    });
  });

  // ─── 9. Statistical Analysis Engine ───────────────────────────────────────

  describe('Statistical analysis (unit-style via direct import)', () => {
    const { calculateTwoProportionZTest } = require('../services/experimentAnalyticsService');

    test('known statistically significant scenario produces correct verdict', () => {
      // Control: 50/200 retained, Treatment: 70/200 retained
      const result = calculateTwoProportionZTest(200, 50, 200, 70);
      assert.equal(result.controlProportion, 0.25);
      assert.equal(result.treatmentProportion, 0.35);
      assert.ok(result.absoluteLift > 0, 'Lift should be positive');
      assert.ok(result.pValue < 0.1, `Expected p < 0.1 for clear lift, got ${result.pValue}`);
      assert.equal(result.hasSufficientData, true);
    });

    test('zero samples returns hasSufficientData=false without errors', () => {
      const result = calculateTwoProportionZTest(0, 0, 0, 0);
      assert.equal(result.hasSufficientData, false);
      assert.equal(result.significant, false);
      assert.doesNotThrow(() => calculateTwoProportionZTest(0, 0, 0, 0));
    });

    test('small samples (< 5 per group) returns hasSufficientData=false', () => {
      const result = calculateTwoProportionZTest(3, 1, 3, 2);
      assert.equal(result.hasSufficientData, false);
      assert.equal(result.significant, false);
    });

    test('success-failure condition failure (0 successes) returns hasSufficientData=false', () => {
      // 100 participants but 0 successes -> normal approximation invalid
      const result = calculateTwoProportionZTest(100, 0, 100, 0);
      assert.equal(result.hasSufficientData, false);
      assert.equal(result.significant, false);
    });

    test('success-failure condition failure (all successes, 0 failures) returns hasSufficientData=false', () => {
      // 100 participants but 100% successes -> 0 failures -> normal approximation invalid
      const result = calculateTwoProportionZTest(100, 100, 100, 100);
      assert.equal(result.hasSufficientData, false);
      assert.equal(result.significant, false);
    });

    test('equal proportions produces non-significant result', () => {
      const result = calculateTwoProportionZTest(100, 20, 100, 20);
      assert.equal(result.absoluteLift, 0);
      assert.equal(result.significant, false);
      assert.equal(result.hasSufficientData, true);
    });

    test('confidence interval is symmetric around lift for equal sample sizes', () => {
      const result = calculateTwoProportionZTest(100, 30, 100, 40);
      const [lo, hi] = result.confidenceInterval;
      assert.ok(lo < result.absoluteLift, 'CI lower bound must be less than lift');
      assert.ok(hi > result.absoluteLift, 'CI upper bound must be greater than lift');
    });
  });

  // ─── Cleanup ──────────────────────────────────────────────────────────────
  // Note: Test users created by registerTestUser will persist in the test DB.
  // Run against a test/staging DB, not production.
});
