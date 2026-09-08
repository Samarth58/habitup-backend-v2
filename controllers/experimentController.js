const {
  getOrAssignExperimentVariant,
  recordExperimentExposure,
  listExperiments,
  getExperiment,
} = require('../services/experimentService');

/**
 * GET /experiments/:name
 * Returns the current user's experiment variant and feature flags.
 * Assignment occurs here if the user hasn't been assigned yet.
 * Does NOT record exposure — exposure is a separate explicit action.
 */
async function getVariant(req, res) {
  const userId = req.userId;
  const experimentName = req.params.name;

  try {
    const result = await getOrAssignExperimentVariant(userId, experimentName);
    return res.json(result);
  } catch (err) {
    console.error('[getVariant]', err);
    return res.status(500).json({ error: 'Failed to retrieve experiment variant.' });
  }
}

/**
 * POST /experiments/:name/exposure
 * Records that the user actually viewed / experienced the feature.
 * Should be called by the frontend once the feature UI is rendered.
 * Assignment must already exist — this does not create a new assignment.
 */
async function recordExposure(req, res) {
  const userId = req.userId;
  const experimentName = req.params.name;

  try {
    const result = await recordExperimentExposure(userId, experimentName);
    if (!result.ok) {
      return res.status(400).json({ error: result.message || 'Failed to record exposure.' });
    }
    return res.json({ ok: true, experiment: result.experiment, variant: result.variant });
  } catch (err) {
    console.error('[recordExposure]', err);
    return res.status(500).json({ error: 'Failed to record experiment exposure.' });
  }
}

module.exports = { getVariant, recordExposure };
