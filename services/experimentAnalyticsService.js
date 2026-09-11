const { pool } = require('./db');
const { getExperiment } = require('./experimentService');

/**
 * Standard normal error function erf(x) approximation.
 * Abramowitz and Stegun formula 7.1.26 (max error ~1.5e-7).
 */
function erf(x) {
  const sign = x >= 0 ? 1 : -1;
  const absX = Math.abs(x);

  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-absX * absX);

  return sign * y;
}

/**
 * Standard Normal Cumulative Distribution Function (CDF).
 */
function normalCdf(z) {
  return 0.5 * (1.0 + erf(z / Math.SQRT2));
}

/**
 * Performs a two-proportion Z-test for statistical significance.
 *
 * @param {number} n1 Control sample size (denominator)
 * @param {number} x1 Control success count (numerator)
 * @param {number} n2 Treatment sample size (denominator)
 * @param {number} x2 Treatment success count (numerator)
 * @param {number} [alpha=0.05] Significance level
 * @returns {object}
 */
function calculateTwoProportionZTest(n1, x1, n2, x2, alpha = 0.05) {
  const p1 = n1 > 0 ? x1 / n1 : 0;
  const p2 = n2 > 0 ? x2 / n2 : 0;

  const absoluteLift = p2 - p1;
  const relativeLift = p1 > 0 ? (p2 - p1) / p1 : 0;

  // 1. Minimum sample size requirement (at least 5 eligible participants in each group)
  if (n1 < 5 || n2 < 5) {
    return {
      controlProportion: Number(p1.toFixed(4)),
      treatmentProportion: Number(p2.toFixed(4)),
      absoluteLift: Number(absoluteLift.toFixed(4)),
      relativeLift: Number(relativeLift.toFixed(4)),
      zScore: 0,
      pValue: 1.0,
      confidenceInterval: [0, 0],
      significant: false,
      hasSufficientData: false,
      verdict: 'Sample size too small for reliable statistical analysis (minimum 5 eligible users per variant required).',
    };
  }

  // Pooled proportion for hypothesis testing (H0: p1 = p2)
  const pooledP = (x1 + x2) / (n1 + n2);
  const pooledSe = Math.sqrt(pooledP * (1 - pooledP) * (1 / n1 + 1 / n2));

  // 2. Success-Failure Condition for Two-Proportion Z-Test:
  // The sampling distribution is approximately normal only if expected successes AND failures >= 5 in both groups.
  const expSuccess1 = n1 * pooledP;
  const expFailure1 = n1 * (1 - pooledP);
  const expSuccess2 = n2 * pooledP;
  const expFailure2 = n2 * (1 - pooledP);

  const meetsSuccessFailure = expSuccess1 >= 5 && expFailure1 >= 5 && expSuccess2 >= 5 && expFailure2 >= 5;

  if (!meetsSuccessFailure || pooledSe === 0) {
    return {
      controlProportion: Number(p1.toFixed(4)),
      treatmentProportion: Number(p2.toFixed(4)),
      absoluteLift: Number(absoluteLift.toFixed(4)),
      relativeLift: Number(relativeLift.toFixed(4)),
      zScore: 0,
      pValue: 1.0,
      confidenceInterval: [0, 0],
      significant: false,
      hasSufficientData: false,
      verdict: 'Success-failure condition not met (expected successes and failures must both be >= 5 in each group under the pooled proportion). Continue collecting data.',
    };
  }

  let zScore = (p2 - p1) / pooledSe;
  // Two-tailed p-value
  let pValue = 2 * (1 - normalCdf(Math.abs(zScore)));

  // Unpooled standard error for 95% confidence interval of difference
  const unpooledSe = Math.sqrt((p1 * (1 - p1)) / n1 + (p2 * (1 - p2)) / n2);
  const zAlphaHalf = 1.95996; // 95% CI (z_crit for alpha = 0.05)
  const ciLower = absoluteLift - zAlphaHalf * unpooledSe;
  const ciUpper = absoluteLift + zAlphaHalf * unpooledSe;

  const significant = pValue < alpha && Math.abs(zScore) > 1.96;

  let verdict;
  if (!significant) {
    verdict = pValue >= 0.05
      ? 'Difference is not statistically significant (p >= 0.05). Continue collecting data.'
      : 'Insufficient sample power.';
  } else if (absoluteLift > 0) {
    verdict = 'Treatment is statistically significantly better than Control (p < 0.05).';
  } else {
    verdict = 'Treatment is statistically significantly worse than Control (p < 0.05).';
  }

  return {
    controlProportion: Number(p1.toFixed(4)),
    treatmentProportion: Number(p2.toFixed(4)),
    absoluteLift: Number(absoluteLift.toFixed(4)),
    relativeLift: Number(relativeLift.toFixed(4)),
    zScore: Number(zScore.toFixed(4)),
    pValue: Number(pValue.toFixed(4)),
    confidenceInterval: [Number(ciLower.toFixed(4)), Number(ciUpper.toFixed(4))],
    significant,
    hasSufficientData: true,
    verdict,
  };
}

/**
 * Calculates exact D1 and D7 cohort retention and engagement metrics for an experiment.
 *
 * Metric Definitions:
 * - Eligibility: Non-deleted assigned users who registered AT OR AFTER experiment.start_at.
 * - D1 Retention:
 *   - Denominator (Eligible): Users with NOW() >= created_at + 48h (completed 48h window).
 *   - Numerator (Retained): Eligible users with at least 1 meaningful authenticated activity in [created_at + 24h, created_at + 48h).
 * - D7 Retention (Primary Metric):
 *   - Denominator (Eligible): Users with NOW() >= created_at + 192h (completed Day-7 8-day window).
 *   - Numerator (Retained): Eligible users with at least 1 meaningful authenticated activity in [created_at + 168h, created_at + 192h).
 *
 * @param {string} experimentName
 * @returns {Promise<object>}
 */
async function getExperimentAnalytics(experimentName = 'friends_feature_v1') {
  const experiment = await getExperiment(experimentName);
  if (!experiment) {
    throw new Error(`Experiment '${experimentName}' not found.`);
  }

  // 1. Total assigned user counts per variant (strictly post-launch users)
  const assignedQuery = `
    SELECT
      ue.variant,
      COUNT(*)::int AS total_users
    FROM user_experiments ue
    JOIN users u ON u.id = ue.user_id AND u.deleted_at IS NULL
    JOIN experiments e ON e.id = ue.experiment_id
    WHERE ue.experiment_id = $1
      AND u.created_at >= e.start_at
    GROUP BY ue.variant
  `;
  const { rows: assignedRows } = await pool.query(assignedQuery, [experiment.id]);

  const totalAssignedMap = { A: 0, B: 0 };
  for (const r of assignedRows) {
    totalAssignedMap[r.variant] = r.total_users;
  }

  // 2. Exact D1 & D7 Retention Metrics per Variant
  // Meaningful activity includes user_activity & habit_completions
  const retentionQuery = `
    WITH cohort AS (
      SELECT
        ue.user_id,
        ue.variant,
        u.created_at AS reg_time
      FROM user_experiments ue
      JOIN users u ON u.id = ue.user_id AND u.deleted_at IS NULL
      JOIN experiments e ON e.id = ue.experiment_id
      WHERE ue.experiment_id = $1
        AND u.created_at >= e.start_at
    ),
    user_metrics AS (
      SELECT
        c.variant,
        c.user_id,
        (NOW() >= c.reg_time + INTERVAL '48 hours') AS d1_eligible,
        ((NOW() >= c.reg_time + INTERVAL '48 hours') AND EXISTS (
          SELECT 1 FROM user_activity ua
          WHERE ua.user_id = c.user_id
            AND ua.created_at >= c.reg_time + INTERVAL '24 hours'
            AND ua.created_at < c.reg_time + INTERVAL '48 hours'
          UNION ALL
          SELECT 1 FROM habit_completions hc
          WHERE hc.user_id = c.user_id
            AND hc.completed_at >= c.reg_time + INTERVAL '24 hours'
            AND hc.completed_at < c.reg_time + INTERVAL '48 hours'
        )) AS d1_retained,
        (NOW() >= c.reg_time + INTERVAL '192 hours') AS d7_eligible,
        ((NOW() >= c.reg_time + INTERVAL '192 hours') AND EXISTS (
          SELECT 1 FROM user_activity ua
          WHERE ua.user_id = c.user_id
            AND ua.created_at >= c.reg_time + INTERVAL '168 hours'
            AND ua.created_at < c.reg_time + INTERVAL '192 hours'
          UNION ALL
          SELECT 1 FROM habit_completions hc
          WHERE hc.user_id = c.user_id
            AND hc.completed_at >= c.reg_time + INTERVAL '168 hours'
            AND hc.completed_at < c.reg_time + INTERVAL '192 hours'
        )) AS d7_retained
      FROM cohort c
    )
    SELECT
      v.variant,
      COALESCE(COUNT(m.user_id) FILTER (WHERE m.d1_eligible), 0)::int AS d1_eligible_users,
      COALESCE(COUNT(m.user_id) FILTER (WHERE m.d1_retained), 0)::int AS d1_retained_users,
      COALESCE(COUNT(m.user_id) FILTER (WHERE m.d7_eligible), 0)::int AS d7_eligible_users,
      COALESCE(COUNT(m.user_id) FILTER (WHERE m.d7_retained), 0)::int AS d7_retained_users
    FROM (VALUES ('A'), ('B')) AS v(variant)
    LEFT JOIN user_metrics m ON m.variant = v.variant
    GROUP BY v.variant
  `;
  const { rows: retentionRows } = await pool.query(retentionQuery, [experiment.id]);

  const retentionMap = {
    A: { d1Eligible: 0, d1Retained: 0, d7Eligible: 0, d7Retained: 0 },
    B: { d1Eligible: 0, d1Retained: 0, d7Eligible: 0, d7Retained: 0 },
  };

  for (const r of retentionRows) {
    retentionMap[r.variant] = {
      d1Eligible: r.d1_eligible_users,
      d1Retained: r.d1_retained_users,
      d7Eligible: r.d7_eligible_users,
      d7Retained: r.d7_retained_users,
    };
  }

  // 3. Habit Engagement Metrics per Variant (excluding pre-existing users)
  const habitEngagementQuery = `
    SELECT
      ue.variant,
      COUNT(DISTINCT h.id)::int AS total_habits_created,
      COUNT(hc.id)::int AS total_completions,
      COUNT(DISTINCT ue.user_id)::int AS users_count
    FROM user_experiments ue
    JOIN users u ON u.id = ue.user_id AND u.deleted_at IS NULL
    JOIN experiments e ON e.id = ue.experiment_id
    LEFT JOIN habits h ON h.user_id = ue.user_id AND h.deleted_at IS NULL
    LEFT JOIN habit_completions hc ON hc.user_id = ue.user_id
    WHERE ue.experiment_id = $1
      AND u.created_at >= e.start_at
    GROUP BY ue.variant
  `;
  const { rows: habitRows } = await pool.query(habitEngagementQuery, [experiment.id]);

  const habitMap = {
    A: { totalHabits: 0, totalCompletions: 0, avgHabits: 0, avgCompletions: 0, completionRate: 0 },
    B: { totalHabits: 0, totalCompletions: 0, avgHabits: 0, avgCompletions: 0, completionRate: 0 },
  };

  for (const r of habitRows) {
    const totalUsers = totalAssignedMap[r.variant] || 1;
    const avgHabits = Number((r.total_habits_created / totalUsers).toFixed(2));
    const avgCompletions = Number((r.total_completions / totalUsers).toFixed(2));
    const completionRate = r.total_habits_created > 0
      ? Number((r.total_completions / (r.total_habits_created * 7)).toFixed(4))
      : 0;

    habitMap[r.variant] = {
      totalHabits: r.total_habits_created,
      totalCompletions: r.total_completions,
      avgHabits,
      avgCompletions,
      completionRate: Math.min(1.0, completionRate),
    };
  }

  // 4. Friends Engagement Metrics (Treatment Variant B, excluding pre-existing users)
  const friendsEngagementQuery = `
    SELECT
      -- Exposure count for Treatment
      (
        SELECT COUNT(DISTINCT ua.user_id)::int
        FROM user_activity ua
        JOIN user_experiments ue ON ue.user_id = ua.user_id AND ue.experiment_id = $1 AND ue.variant = 'B'
        JOIN users u ON u.id = ue.user_id AND u.deleted_at IS NULL
        JOIN experiments e ON e.id = ue.experiment_id
        WHERE ua.activity_type = 'FRIENDS_EXPERIMENT_EXPOSED'
          AND u.created_at >= e.start_at
      ) AS treatment_exposures,
      -- Friend requests sent by Treatment users
      (
        SELECT COUNT(*)::int
        FROM friend_requests fr
        JOIN user_experiments ue ON ue.user_id = fr.requester_id AND ue.experiment_id = $1 AND ue.variant = 'B'
        JOIN users u ON u.id = ue.user_id AND u.deleted_at IS NULL
        JOIN experiments e ON e.id = ue.experiment_id
        WHERE u.created_at >= e.start_at
      ) AS requests_sent,
      -- Distinct treatment users who sent at least 1 request
      (
        SELECT COUNT(DISTINCT fr.requester_id)::int
        FROM friend_requests fr
        JOIN user_experiments ue ON ue.user_id = fr.requester_id AND ue.experiment_id = $1 AND ue.variant = 'B'
        JOIN users u ON u.id = ue.user_id AND u.deleted_at IS NULL
        JOIN experiments e ON e.id = ue.experiment_id
        WHERE u.created_at >= e.start_at
      ) AS users_sent_requests,
      -- Accepted requests involving Treatment users as requester
      (
        SELECT COUNT(*)::int
        FROM friend_requests fr
        JOIN user_experiments ue ON ue.user_id = fr.requester_id AND ue.experiment_id = $1 AND ue.variant = 'B'
        JOIN users u ON u.id = ue.user_id AND u.deleted_at IS NULL
        JOIN experiments e ON e.id = ue.experiment_id
        WHERE fr.status = 'accepted'
          AND u.created_at >= e.start_at
      ) AS requests_accepted,
      -- Treatment users with at least 1 accepted friend
      (
        SELECT COUNT(DISTINCT ue.user_id)::int
        FROM user_experiments ue
        JOIN users u ON u.id = ue.user_id AND u.deleted_at IS NULL
        JOIN experiments e ON e.id = ue.experiment_id
        JOIN friendships f ON (f.user_a_id = ue.user_id OR f.user_b_id = ue.user_id) AND f.status = 'accepted'
        WHERE ue.experiment_id = $1 AND ue.variant = 'B'
          AND u.created_at >= e.start_at
      ) AS users_with_friends,
      -- Total friendship links formed by Treatment users
      (
        SELECT COUNT(*)::int
        FROM friendships f
        JOIN user_experiments ue ON (ue.user_id = f.user_a_id OR ue.user_id = f.user_b_id)
        JOIN users u ON u.id = ue.user_id AND u.deleted_at IS NULL
        JOIN experiments e ON e.id = ue.experiment_id
        WHERE ue.experiment_id = $1 AND ue.variant = 'B' AND f.status = 'accepted'
          AND u.created_at >= e.start_at
      ) AS total_friendships
  `;
  const { rows: friendsRows } = await pool.query(friendsEngagementQuery, [experiment.id]);
  const fr = friendsRows[0] || {};

  const treatmentTotal = totalAssignedMap.B || 1;
  const requestsSent = fr.requests_sent || 0;
  const requestsAccepted = fr.requests_accepted || 0;
  const usersWithFriends = fr.users_with_friends || 0;
  const treatmentExposures = fr.treatment_exposures || 0;

  const friendsMetrics = {
    exposureCount: treatmentExposures,
    exposureRate: Number((treatmentExposures / treatmentTotal).toFixed(4)),
    requestsSent,
    requestSentRate: Number(((fr.users_sent_requests || 0) / treatmentTotal).toFixed(4)),
    requestsAccepted,
    requestAcceptanceRate: requestsSent > 0 ? Number((requestsAccepted / requestsSent).toFixed(4)) : 0,
    usersWithFriends,
    usersWithFriendsRate: Number((usersWithFriends / treatmentTotal).toFixed(4)),
    avgFriendsPerUser: Number(((fr.total_friendships || 0) / treatmentTotal).toFixed(2)),
  };

  // 5. Statistical Significance Test (Primary Metric: D7 Retention)
  const cD7Eligible = retentionMap.A.d7Eligible;
  const cD7Retained = retentionMap.A.d7Retained;
  const tD7Eligible = retentionMap.B.d7Eligible;
  const tD7Retained = retentionMap.B.d7Retained;

  const statResult = calculateTwoProportionZTest(
    cD7Eligible,
    cD7Retained,
    tD7Eligible,
    tD7Retained,
    0.05
  );

  const controlD1Rate = retentionMap.A.d1Eligible > 0
    ? Number((retentionMap.A.d1Retained / retentionMap.A.d1Eligible).toFixed(4))
    : 0;
  const treatmentD1Rate = retentionMap.B.d1Eligible > 0
    ? Number((retentionMap.B.d1Retained / retentionMap.B.d1Eligible).toFixed(4))
    : 0;

  const controlD7Rate = retentionMap.A.d7Eligible > 0
    ? Number((retentionMap.A.d7Retained / retentionMap.A.d7Eligible).toFixed(4))
    : 0;
  const treatmentD7Rate = retentionMap.B.d7Eligible > 0
    ? Number((retentionMap.B.d7Retained / retentionMap.B.d7Eligible).toFixed(4))
    : 0;

  return {
    experiment: {
      id: experiment.id,
      name: experiment.name,
      description: experiment.description,
      status: experiment.status,
      allocation: experiment.allocation,
      primaryMetric: experiment.primary_metric,
      targetSampleSize: experiment.target_sample_size,
      totalAssigned: totalAssignedMap.A + totalAssignedMap.B,
      startAt: experiment.start_at,
      endAt: experiment.end_at,
    },
    control: {
      variant: 'A',
      name: 'Control (Friends Disabled)',
      users: totalAssignedMap.A,
      d1Eligible: retentionMap.A.d1Eligible,
      d1Retained: retentionMap.A.d1Retained,
      d1Retention: controlD1Rate,
      d7Eligible: retentionMap.A.d7Eligible,
      d7Retained: retentionMap.A.d7Retained,
      d7Retention: controlD7Rate,
      totalHabits: habitMap.A.totalHabits,
      avgHabitsCreated: habitMap.A.avgHabits,
      totalCompletions: habitMap.A.totalCompletions,
      avgHabitsCompleted: habitMap.A.avgCompletions,
      habitCompletionRate: habitMap.A.completionRate,
    },
    treatment: {
      variant: 'B',
      name: 'Treatment (Friends Enabled)',
      users: totalAssignedMap.B,
      d1Eligible: retentionMap.B.d1Eligible,
      d1Retained: retentionMap.B.d1Retained,
      d1Retention: treatmentD1Rate,
      d7Eligible: retentionMap.B.d7Eligible,
      d7Retained: retentionMap.B.d7Retained,
      d7Retention: treatmentD7Rate,
      totalHabits: habitMap.B.totalHabits,
      avgHabitsCreated: habitMap.B.avgHabits,
      totalCompletions: habitMap.B.totalCompletions,
      avgHabitsCompleted: habitMap.B.avgCompletions,
      habitCompletionRate: habitMap.B.completionRate,
      exposureCount: friendsMetrics.exposureCount,
      exposureRate: friendsMetrics.exposureRate,
    },
    comparison: {
      primaryMetric: experiment.primary_metric,
      controlValue: statResult.controlProportion,
      treatmentValue: statResult.treatmentProportion,
      absoluteLift: statResult.absoluteLift,
      relativeLift: statResult.relativeLift,
      zScore: statResult.zScore,
      pValue: statResult.pValue,
      confidenceInterval: statResult.confidenceInterval,
      significant: statResult.significant,
      hasSufficientData: statResult.hasSufficientData,
      verdict: statResult.verdict,
    },
    friends: friendsMetrics,
  };
}

module.exports = {
  erf,
  normalCdf,
  calculateTwoProportionZTest,
  getExperimentAnalytics,
};
