const { pool } = require('./db');
const { logActivity } = require('./activityService');

/**
 * Retrieves experiment record by name from the database.
 * Dynamic database configuration is the single source of truth.
 *
 * @param {string} name
 * @returns {Promise<object|null>}
 */
async function getExperiment(name) {
  const { rows } = await pool.query(
    `SELECT id, name, description, status, allocation, variants, primary_metric,
            experiment_type, target_sample_size, start_at, end_at, created_at, updated_at
     FROM experiments
     WHERE name = $1`,
    [name]
  );
  return rows[0] || null;
}

/**
 * Lists all registered experiments with high-level statistics.
 */
async function listExperiments() {
  const { rows } = await pool.query(
    `SELECT e.*,
            COUNT(ue.id)::int AS total_assigned,
            COUNT(CASE WHEN ue.variant = 'A' THEN 1 END)::int AS control_assigned,
            COUNT(CASE WHEN ue.variant = 'B' THEN 1 END)::int AS treatment_assigned
     FROM experiments e
     LEFT JOIN user_experiments ue ON ue.experiment_id = e.id
     LEFT JOIN users u ON u.id = ue.user_id AND u.deleted_at IS NULL AND u.created_at >= e.start_at
     GROUP BY e.id
     ORDER BY e.created_at DESC`
  );
  return rows;
}

/**
 * Deterministically chooses a variant from an allocation object (e.g. { "A": 0.5, "B": 0.5 }).
 *
 * @param {object} allocation
 * @param {Array<string>} variants
 * @returns {string}
 */
function selectVariantFromAllocation(allocation = { A: 0.5, B: 0.5 }, variants = ['A', 'B']) {
  const rand = Math.random();
  let cumulative = 0;

  for (const variant of variants) {
    const weight = Number(allocation[variant] ?? 0);
    cumulative += weight;
    if (rand < cumulative) {
      return variant;
    }
  }

  // Fallback to first variant if rounding edge occurs
  return variants[0] || 'A';
}

/**
 * Stable, randomized experiment assignment service.
 *
 * Behavior:
 * 1. Checks whether user already has an assignment in user_experiments.
 * 2. If yes, returns the existing variant.
 * 3. If no, verifies experiment eligibility (user created_at >= experiment.start_at, not deleted, experiment status = RUNNING).
 * 4. Randomly assigns variant according to database configured allocation.
 * 5. Atomically persists assignment handling concurrency safely.
 * 6. Does NOT record exposure (assignment != exposure).
 *
 * @param {string} userId
 * @param {string} [experimentName='friends_feature_v1']
 * @returns {Promise<{ experiment: string, experimentId: string|null, variant: string|null, friendsEnabled: boolean, assigned: boolean, preExisting?: boolean }>}
 */
async function getOrAssignExperimentVariant(userId, experimentName = 'friends_feature_v1') {
  if (!userId) {
    return {
      experiment: experimentName,
      experimentId: null,
      variant: null,
      friendsEnabled: false,
      assigned: false,
    };
  }

  const experiment = await getExperiment(experimentName);
  if (!experiment || experiment.status !== 'RUNNING') {
    // If experiment does not exist or is not running, default feature availability applies
    return {
      experiment: experimentName,
      experimentId: experiment?.id || null,
      variant: null,
      friendsEnabled: true,
      assigned: false,
      active: false,
    };
  }

  // 1. Check existing assignment
  const { rows: existingRows } = await pool.query(
    `SELECT variant, assigned_at
     FROM user_experiments
     WHERE user_id = $1 AND experiment_id = $2`,
    [userId, experiment.id]
  );

  if (existingRows.length > 0) {
    const assignedVariant = existingRows[0].variant;
    return {
      experiment: experiment.name,
      experimentId: experiment.id,
      variant: assignedVariant,
      friendsEnabled: assignedVariant === 'B',
      assigned: true,
    };
  }

  // 2. Check user eligibility
  const { rows: userRows } = await pool.query(
    `SELECT id, created_at, deleted_at FROM users WHERE id = $1`,
    [userId]
  );
  const user = userRows[0];
  if (!user || user.deleted_at) {
    return {
      experiment: experiment.name,
      experimentId: experiment.id,
      variant: null,
      friendsEnabled: false,
      assigned: false,
    };
  }

  // Eligibility check: newly registered users who register after the experiment starts
  const experimentStartTime = new Date(experiment.start_at).getTime();
  const userRegistrationTime = new Date(user.created_at).getTime();

  if (userRegistrationTime < experimentStartTime) {
    // Existing users registered before experiment start are not part of this randomized cohort
    return {
      experiment: experiment.name,
      experimentId: experiment.id,
      variant: null,
      friendsEnabled: true, // Pre-existing users keep standard experience
      assigned: false,
      preExisting: true,
    };
  }

  // 3. Randomly assign variant based on DB allocation
  const assignedVariant = selectVariantFromAllocation(
    experiment.allocation,
    experiment.variants || ['A', 'B']
  );

  // 4. Safe concurrent insertion
  const { rows: insertRows } = await pool.query(
    `INSERT INTO user_experiments (user_id, experiment_id, variant)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, experiment_id) DO NOTHING
     RETURNING variant`,
    [userId, experiment.id, assignedVariant]
  );

  let finalVariant = assignedVariant;
  if (insertRows.length > 0) {
    finalVariant = insertRows[0].variant;
  } else {
    // If a concurrent request inserted first, read the saved variant
    const { rows: recheckRows } = await pool.query(
      `SELECT variant FROM user_experiments WHERE user_id = $1 AND experiment_id = $2`,
      [userId, experiment.id]
    );
    if (recheckRows.length > 0) {
      finalVariant = recheckRows[0].variant;
    }
  }

  return {
    experiment: experiment.name,
    experimentId: experiment.id,
    variant: finalVariant,
    friendsEnabled: finalVariant === 'B',
    assigned: true,
  };
}

/**
 * Tracks experiment exposure when a user actually views/experiences the feature.
 *
 * @param {string} userId
 * @param {string} [experimentName='friends_feature_v1']
 */
async function recordExperimentExposure(userId, experimentName = 'friends_feature_v1') {
  if (!userId) return { ok: false, message: 'User ID required' };

  const experiment = await getExperiment(experimentName);
  if (!experiment) return { ok: false, message: 'Experiment not found' };

  const { rows } = await pool.query(
    `SELECT variant FROM user_experiments WHERE user_id = $1 AND experiment_id = $2`,
    [userId, experiment.id]
  );

  if (rows.length === 0) {
    return { ok: false, message: 'User not assigned to experiment' };
  }

  const variant = rows[0].variant;

  // Log exposure event with sanitized metadata
  await logActivity(userId, 'FRIENDS_EXPERIMENT_EXPOSED', {
    experiment: experiment.name,
    variant,
    experiment_id: experiment.id,
  });

  return {
    ok: true,
    exposed: true,
    experiment: experiment.name,
    variant,
  };
}

module.exports = {
  getExperiment,
  listExperiments,
  selectVariantFromAllocation,
  getOrAssignExperimentVariant,
  recordExperimentExposure,
};
