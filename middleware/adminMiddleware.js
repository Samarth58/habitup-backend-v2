const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

/**
 * Express middleware that enforces a database-confirmed admin role.
 *
 * MUST be placed after requireAuth middleware (expects req.userId to be set).
 * Always queries the database to verify the role, never trusting token payloads.
 *
 * On success: calls next()
 * On unauthenticated/deleted user: responds 401
 * On authenticated non-admin: responds 403 Forbidden
 */
async function requireAdmin(req, res, next) {
  const userId = req.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT role FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [userId]
    );

    const user = rows[0];

    if (!user) {
      return res.status(401).json({ error: 'User account not found or deleted.' });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Admin access required.' });
    }

    next();
  } catch (err) {
    console.error('[requireAdmin]', err);
    return res.status(500).json({ error: 'Authorization check failed.' });
  }
}

module.exports = { requireAdmin };
