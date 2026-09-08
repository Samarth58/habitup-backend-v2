const { Router } = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const { getVariant, recordExposure } = require('../controllers/experimentController');

const router = Router();
router.use(requireAuth);

/**
 * @swagger
 * /experiments/{name}:
 *   get:
 *     tags: [Experiments]
 *     summary: Get the current user's experiment variant and feature flags
 *     description: |
 *       Returns the user's assigned variant for the named experiment.
 *       Assignment happens automatically on the first call for newly eligible users.
 *       Pre-experiment existing users receive `preExisting: true` and full feature access.
 *       **Does NOT record exposure.** Call POST /{name}/exposure separately when the feature UI is shown.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema: { type: string }
 *         example: friends_feature_v1
 *     responses:
 *       200:
 *         description: Experiment assignment result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 experiment: { type: string, example: friends_feature_v1 }
 *                 variant: { type: string, example: B, nullable: true }
 *                 friendsEnabled: { type: boolean }
 *                 assigned: { type: boolean }
 *                 preExisting: { type: boolean }
 *       401: { description: Unauthorized }
 */
router.get('/:name', getVariant);

/**
 * @swagger
 * /experiments/{name}/exposure:
 *   post:
 *     tags: [Experiments]
 *     summary: Record exposure when the feature UI is actually shown to the user
 *     description: |
 *       Records a `FRIENDS_EXPERIMENT_EXPOSED` activity event for the user.
 *       Must be called from the frontend *after* the Friends feature is rendered —
 *       not simply because the user received a Treatment variant.
 *       Requires an existing experiment assignment (call GET /{name} first).
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema: { type: string }
 *         example: friends_feature_v1
 *     responses:
 *       200:
 *         description: Exposure recorded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean }
 *                 experiment: { type: string }
 *                 variant: { type: string }
 *       400: { description: User not assigned or invalid experiment }
 *       401: { description: Unauthorized }
 */
router.post('/:name/exposure', recordExposure);

module.exports = router;
