require('dotenv').config();
const { Pool } = require('pg');

const email = process.argv[2];

if (!email) {
  console.error('Usage: node scripts/make-admin.js <user-email>');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  try {
    const { rows } = await pool.query(
      `UPDATE users
       SET role = 'admin', updated_at = NOW()
       WHERE email = $1 AND deleted_at IS NULL
       RETURNING id, name, email, role`,
      [email]
    );

    if (rows.length === 0) {
      console.error(`User with email "${email}" not found or deleted.`);
      process.exit(1);
    }

    console.log('Successfully promoted user to admin:');
    console.log(rows[0]);
  } catch (err) {
    console.error('Error promoting user:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();