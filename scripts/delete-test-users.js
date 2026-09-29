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
    // 1. Identify test users to delete (any example.com, test domain, or test-named users)
    const testUsersRes = await pool.query(`
      SELECT id, name, email, username, created_at 
      FROM users 
      WHERE (
        email LIKE '%@example.com'
        OR email LIKE '%@example.net'
        OR email LIKE '%@example.org'
        OR email LIKE '%@habitup.test'
        OR email LIKE '%@test.com'
        OR email = 'test@example.com'
        OR name LIKE 'Suite %' 
        OR name LIKE 'Test %'
        OR name LIKE 'Tester%'
        OR name LIKE 'Migration %'
        OR name LIKE 'Auth Test %'
      )
      ORDER BY created_at ASC
    `);

    // Identify real users to be preserved
    const realUsersRes = await pool.query(`
      SELECT id, name, email, username, role, created_at 
      FROM users 
      WHERE NOT (
        email LIKE '%@example.com'
        OR email LIKE '%@example.net'
        OR email LIKE '%@example.org'
        OR email LIKE '%@habitup.test'
        OR email LIKE '%@test.com'
        OR email = 'test@example.com'
        OR name LIKE 'Suite %' 
        OR name LIKE 'Test %'
        OR name LIKE 'Tester%'
        OR name LIKE 'Migration %'
        OR name LIKE 'Auth Test %'
      )
      ORDER BY created_at ASC
    `);

    console.log(`\nPreserving ${realUsersRes.rows.length} real user accounts:`);
    realUsersRes.rows.forEach((u) => {
      console.log(`  ✓ [${u.role}] ${u.name} (@${u.username || 'no-handle'}) - ${u.email}`);
    });

    console.log(`\nFound ${testUsersRes.rows.length} test accounts to delete.`);

    if (testUsersRes.rows.length === 0) {
      console.log('No test accounts found. Database is already clean.');
      return;
    }

    const testUserIds = testUsersRes.rows.map((u) => u.id);

    // Delete records from child/related tables
    await pool.query(`DELETE FROM habit_completions WHERE user_id = ANY($1::uuid[])`, [testUserIds]);
    await pool.query(`DELETE FROM reminders WHERE user_id = ANY($1::uuid[])`, [testUserIds]);
    await pool.query(`DELETE FROM habit_schedules WHERE habit_id IN (SELECT id FROM habits WHERE user_id = ANY($1::uuid[]))`, [testUserIds]);
    await pool.query(`DELETE FROM habits WHERE user_id = ANY($1::uuid[])`, [testUserIds]);
    await pool.query(`DELETE FROM user_activity WHERE user_id = ANY($1::uuid[])`, [testUserIds]);
    await pool.query(`DELETE FROM device_tokens WHERE user_id = ANY($1::uuid[])`, [testUserIds]);
    await pool.query(`DELETE FROM notification_deliveries WHERE user_id = ANY($1::uuid[])`, [testUserIds]);
    await pool.query(`DELETE FROM notification_preferences WHERE user_id = ANY($1::uuid[])`, [testUserIds]);
    await pool.query(`DELETE FROM user_experiments WHERE user_id = ANY($1::uuid[])`, [testUserIds]);
    await pool.query(`DELETE FROM bamboo_transactions WHERE user_id = ANY($1::uuid[])`, [testUserIds]);
    await pool.query(`DELETE FROM user_inventory WHERE user_id = ANY($1::uuid[])`, [testUserIds]);
    await pool.query(`DELETE FROM user_bamboo_wallets WHERE user_id = ANY($1::uuid[])`, [testUserIds]);
    await pool.query(`DELETE FROM friend_requests WHERE requester_id = ANY($1::uuid[]) OR recipient_id = ANY($1::uuid[])`, [testUserIds]);
    await pool.query(`DELETE FROM friendships WHERE user_a_id = ANY($1::uuid[]) OR user_b_id = ANY($1::uuid[])`, [testUserIds]);
    await pool.query(`DELETE FROM ai_messages WHERE conversation_id IN (SELECT id FROM ai_conversations WHERE user_id = ANY($1::uuid[]))`, [testUserIds]);
    await pool.query(`DELETE FROM ai_conversations WHERE user_id = ANY($1::uuid[])`, [testUserIds]);
    await pool.query(`DELETE FROM password_reset_tokens WHERE user_id = ANY($1::uuid[])`, [testUserIds]);
    await pool.query(`DELETE FROM sessions WHERE user_id = ANY($1::uuid[])`, [testUserIds]);

    // Delete test users
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
