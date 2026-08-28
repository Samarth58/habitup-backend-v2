/**
 * One-off cleanup script to reset test@example.com account data.
 * 
 * Usage: node scripts/cleanup-test-data.js
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function cleanup() {
  console.log('Starting cleanup of test@example.com data...\n');

  try {
    // 1. Find user by email
    const { rows: userRows } = await pool.query(
      `SELECT id, email FROM users WHERE email = $1`,
      ['test@example.com']
    );

    if (userRows.length === 0) {
      console.log('User test@example.com not found. Nothing to clean up.');
      await pool.end();
      process.exit(0);
    }

    const userId = userRows[0].id;

    // 2. Count habits before deletion
    const { rows: beforeRows } = await pool.query(
      `SELECT COUNT(*)::int AS count FROM habits WHERE user_id = $1`,
      [userId]
    );
    const countBefore = beforeRows[0].count;
    console.log(`Habit count before cleanup for test@example.com: ${countBefore}`);

    // 3. Delete all habits belonging to test@example.com (cascades to completions, schedules, reminders)
    await pool.query(`DELETE FROM habits WHERE user_id = $1`, [userId]);

    // 4. Count habits after deletion
    const { rows: afterRows } = await pool.query(
      `SELECT COUNT(*)::int AS count FROM habits WHERE user_id = $1`,
      [userId]
    );
    const countAfter = afterRows[0].count;
    console.log(`Habit count after cleanup for test@example.com: ${countAfter}`);
    console.log(`Successfully deleted ${countBefore - countAfter} habit(s) and associated data.`);

    console.log('\n----------------------------------------');
    console.log('CLEANUP COMPLETED SUCCESSFULLY!');
    console.log('----------------------------------------');
  } catch (err) {
    console.error('Error during cleanup:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

cleanup();
