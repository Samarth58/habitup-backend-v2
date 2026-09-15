require('dotenv').config();
const { pool } = require('../services/db');
const { sendPushNotification } = require('../services/notificationService');
const firebaseService = require('../services/firebaseService');

async function testTokens() {
  const res = await pool.query(
    "SELECT dt.token, u.email, dt.platform, dt.updated_at FROM device_tokens dt JOIN users u ON dt.user_id = u.id WHERE u.email NOT LIKE 'test_%'"
  );

  console.log(`Found ${res.rows.length} real user tokens.`);

  for (const row of res.rows) {
    console.log(`\nChecking user: ${row.email} (platform: ${row.platform}, updated: ${row.updated_at})`);
    
    // Check direct push
    try {
      const pushRes = await sendPushNotification(row.token, {
        title: '🪔 Ganpati Bappa Morya! 🙏',
        body: 'This Ganesh Chaturthi, remove the obstacles standing between you and your goals. Complete today’s habits and take one step closer to becoming your best self! 💪✨',
        data: { type: 'engagement_broadcast' },
      });
      console.log(`  -> Direct FCM Push SUCCESS! Message ID: ${pushRes.messageId}`);
    } catch (err) {
      console.error(`  -> Direct FCM Push FAILED: code=${err.code}, message=${err.message}`);
    }

    // Ensure subscribed to all-users
    try {
      const subRes = await firebaseService.subscribeTokenToTopic(row.token, 'all-users');
      console.log(`  -> Topic subscription status:`, subRes);
    } catch (err) {
      console.error(`  -> Topic subscription FAILED: code=${err.code}, message=${err.message}`);
    }
  }

  await pool.end();
}

testTokens().catch(console.error);
