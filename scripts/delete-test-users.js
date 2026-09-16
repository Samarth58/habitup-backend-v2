/**
 * Script to delete all test users and associated temporary test data
 * while preserving all real user accounts.
 *
 * Usage: node scripts/delete-test-users.js
 */

require('dotenv').config();
const { pool } = require('../services/db');

async function deleteTestUsers() {
  console.log('--- HabitUp Test Users Cleanup ---');

  try {
    // 1. Identify real users to be preserved
    const realUsersRes = await pool.query(`
      SELECT id, name, email, username, role, created_at 
      FROM users 
      WHERE NOT (
        email LIKE 'test_%@example.com%' 
        OR email LIKE '%@habitup.test%' 
        OR email = 'test@example.com'
        OR name LIKE 'Suite %' 
        OR name LIKE 'Test %'
        OR name LIKE 'Tester%'
      )
      ORDER BY created_at ASC
    `);

    console.log(`\nPreserving ${realUsersRes.rows.length} real user accounts:`);
    realUsersRes.rows.forEach((u) => {
      console.log(`  ✓ [${u.role}] ${u.name} (@${u.username || 'no-handle'}) - ${u.email}`);
    });

    // 2. Identify test users to delete
    const testUsersRes = await pool.query(`
      SELECT id, name, email, username, created_at 
      FROM users 
      WHERE (
        email LIKE 'test_%@example.com%' 
        OR email LIKE '%@habitup.test%' 
        OR email = 'test@example.com'
        OR name LIKE 'Suite %' 
        OR name LIKE 'Test %'
        OR name LIKE 'Tester%'
      )
    `);

    console.log(`\nFound ${testUsersRes.rows.length} test accounts to delete.`);

    if (testUsersRes.rows.length === 0) {
      console.log('No test accounts found. Database is already clean.');
      return;
    }

    const testUserIds = testUsersRes.rows.map((u) => u.id);

    // 3. Delete habits and child records
    const delHabits = await pool.query(`
      DELETE FROM habits WHERE user_id = ANY($1::uuid[])
    `, [testUserIds]);
    console.log(`Deleted ${delHabits.rowCount || 0} associated habit records.`);

    // 4. Delete user activity
    const delActivity = await pool.query(`
      DELETE FROM user_activity WHERE user_id = ANY($1::uuid[])
    `, [testUserIds]);
    console.log(`Deleted ${delActivity.rowCount || 0} activity audit log records.`);

    // 5. Delete test users
    const delUsers = await pool.query(`
      DELETE FROM users WHERE id = ANY($1::uuid[])
    `, [testUserIds]);
    console.log(`Deleted ${delUsers.rowCount || 0} test user accounts.`);

    console.log('\n========================================');
    console.log('CLEANUP COMPLETED SUCCESSFULLY!');
    console.log('========================================');
  } catch (err) {
    console.error('Error during test users cleanup:', err);
  } finally {
    await pool.end();
  }
}

deleteTestUsers();
