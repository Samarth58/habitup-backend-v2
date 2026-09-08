const { getOrAssignExperimentVariant } = require('../services/experimentService');

/**
 * Middleware that guards Friends endpoints.
 * Requires requireAuth to have run prior (attaches req.userId).
 *
 * Rules:
 * - If user is in Variant A (Control): 403 Forbidden.
 * - If user is in Variant B (Treatment), or a pre-experiment existing user, or experiment is inactive: next().
 */
async function requireFriendsFeatureEnabled(req, res, next) {
  const userId = req.userId || req.user?.sub;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  try {
    const result = await getOrAssignExperimentVariant(userId, 'friends_feature_v1');

    if (result.assigned && result.variant === 'A') {
      return res.status(403).json({
        error: 'Friends feature is disabled for your experiment group.',
        experiment: result.experiment,
        variant: result.variant,
      });
    }

    next();
  } catch (err) {
    console.error('[requireFriendsFeatureEnabled]', err);
    next(err);
  }
}

module.exports = { requireFriendsFeatureEnabled };
