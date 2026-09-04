require('dotenv').config();
const argon2 = require('argon2');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const email = process.argv[2] || 'samarthahg2004@gmail.com';
  const password = process.argv[3] || 'Samarth@582004';
  const name = process.argv[4] || 'Samarth';

  try {
    const password_hash = await argon2.hash(password);

    // Check if user exists
    const checkRes = await pool.query(`SELECT id, email, role FROM users WHERE email = $1`, [email]);

    if (checkRes.rows.length > 0) {
      // User exists, update role and password
      const updateRes = await pool.query(
        `UPDATE users
         SET role = 'admin',
             password_hash = $1,
             deleted_at = NULL,
             updated_at = NOW()
         WHERE email = $2
         RETURNING id, name, email, role, created_at`,
        [password_hash, email]
      );
      console.log('Successfully updated user to admin:');
      console.log(updateRes.rows[0]);
    } else {
      // User does not exist, insert new admin user
      const insertRes = await pool.query(
        `INSERT INTO users (name, email, password_hash, role, timezone)
         VALUES ($1, $2, $3, 'admin', 'UTC')
         RETURNING id, name, email, role, created_at`,
        [name, email, password_hash]
      );
      console.log('Successfully created admin user:');
      console.log(insertRes.rows[0]);
    }
  } catch (err) {
    console.error('Error creating/updating admin user:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
