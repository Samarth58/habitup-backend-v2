require('dotenv').config();
const { Pool } = require('pg');

const email = process.argv[2];

if (!email) {
  console.error('Usage: node scripts/promote-admin.js <user-email>');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  try {
    const res = await pool.query(
      `UPDATE users SET role = 'admin' WHERE email = $1 AND deleted_at IS NULL RETURNING id, name, email, role`,
      [email]
    );

    if (res.rowCount === 0) {
      console.error(`User with email "${email}" not found or deleted.`);
    } else {
      console.log('Successfully promoted user to admin:', res.rows[0]);
    }
  } catch (err) {
    console.error('Failed to promote user:', err);
  } finally {
    await pool.end();
  }
}

main();
