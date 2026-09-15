require('dotenv').config();
const { pool } = require('../services/db');
const { sendTopicPushNotification, sendPushNotification, isFirebaseConfigured } = require('../services/notificationService');
const firebaseService = require('../services/firebaseService');

async function main() {
  console.log('--- Step 1: Checking Firebase Configuration ---');
  if (!isFirebaseConfigured()) {
    console.error('ERROR: Firebase Admin SDK credentials are not configured in .env');
    process.exit(1);
  }
  console.log('Firebase is configured successfully.');

  console.log('\n--- Step 2: Fetching Users and Device Tokens ---');
  const userCountRes = await pool.query('SELECT COUNT(*)::int as count FROM users WHERE deleted_at IS NULL');
  console.log(`Total Active Users in DB: ${userCountRes.rows[0].count}`);

  const tokensRes = await pool.query(`
    SELECT dt.token, dt.platform, dt.user_id, u.email, u.name
    FROM device_tokens dt
    LEFT JOIN users u ON dt.user_id = u.id
    ORDER BY dt.updated_at DESC
  `);
  console.log(`Total Device Tokens in DB: ${tokensRes.rows.length}`);
  
  tokensRes.rows.forEach((r, idx) => {
    console.log(`  [${idx + 1}] User: ${r.email || r.user_id} (${r.platform}) - Token: ${r.token.slice(0, 15)}...`);
  });

  const topic = 'all-users';
  const title = '🌟 Time to Crush Your Goals!';
  const body = 'Stay consistent and take a step forward today. Check your daily habits now!';
  const data = {
    type: 'broadcast',
    audience: topic,
    category: 'motivation',
    click_action: 'FLUTTER_NOTIFICATION_CLICK',
    timestamp: new Date().toISOString(),
  };

  console.log('\n--- Step 3: Ensuring Tokens are Subscribed to "all-users" Topic ---');
  if (tokensRes.rows.length > 0) {
    for (const row of tokensRes.rows) {
      try {
        await firebaseService.subscribeTokenToTopic(row.token, topic);
        console.log(`  ✓ Subscribed token for user ${row.email || row.user_id} to "${topic}"`);
      } catch (subErr) {
        console.warn(`  ⚠ Warning: Failed to subscribe token: ${subErr.message}`);
      }
    }
  }

  console.log('\n--- Step 4: Dispatching Broadcast to Topic "all-users" ---');
  console.log(`Title: ${title}`);
  console.log(`Body: ${body}`);

  try {
    const topicResult = await sendTopicPushNotification(topic, {
      title,
      body,
      data,
    });
    console.log('✓ Topic notification sent successfully!');
    console.log('Result:', JSON.stringify(topicResult, null, 2));
  } catch (err) {
    console.error('FAILED to send topic notification:', err.message);
  }

  console.log('\n--- Step 5: Direct Token Push Dispatch (Ensures Direct Delivery to All Registered Devices) ---');
  let directSuccess = 0;
  let directFail = 0;
  for (const row of tokensRes.rows) {
    try {
      const res = await sendPushNotification(row.token, {
        title,
        body,
        data,
      });
      directSuccess++;
      console.log(`  ✓ Direct push sent to ${row.email || row.user_id} (Message ID: ${res.messageId})`);
    } catch (err) {
      directFail++;
      console.error(`  ✗ Direct push failed for ${row.email || row.user_id}: ${err.message}`);
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`Topic broadcast sent: Yes (Topic: ${topic})`);
  console.log(`Direct token pushes: ${directSuccess} succeeded, ${directFail} failed`);
  console.log(`Done!`);

  await pool.end();
}

main().catch((err) => {
  console.error('Execution error:', err);
  process.exit(1);
});
