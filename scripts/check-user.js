require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.log('Usage: node scripts/check-user.js <email>');
    process.exit(1);
  }
  const result = await pool.query('SELECT id, email, created_at FROM users WHERE email = $1', [email]);
  console.log('Found', result.rows.length, 'user(s):');
  console.log(result.rows);
  await pool.end();
}

main();
