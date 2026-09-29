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
      const username = process.argv[5] || 'samarth';
      // User does not exist, insert new admin user
      const insertRes = await pool.query(
        `INSERT INTO users (name, email, username, password_hash, role, timezone, preferred_language)
         VALUES ($1, $2, $3, $4, 'admin', 'UTC', 'en')
         RETURNING id, name, email, username, role, created_at`,
        [name, email, username, password_hash]
      );
      const newAdmin = insertRes.rows[0];
      
      // Initialize bamboo wallet and notification preferences
      await pool.query(
        `INSERT INTO user_bamboo_wallets (user_id, balance, total_earned, total_spent)
         VALUES ($1, 500, 500, 0)
         ON CONFLICT (user_id) DO NOTHING`,
        [newAdmin.id]
      );
      await pool.query(
        `INSERT INTO notification_preferences (user_id, timezone)
         VALUES ($1, 'UTC')
         ON CONFLICT (user_id) DO NOTHING`,
        [newAdmin.id]
      );

      console.log('Successfully created admin user:');
      console.log(newAdmin);
    }
  } catch (err) {
    console.error('Error creating/updating admin user:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
