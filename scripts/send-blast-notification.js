require('dotenv').config();
const { sendTopicPushNotification, isFirebaseConfigured } = require('../services/notificationService');

async function main() {
  console.log('Checking Firebase configuration...');
  if (!isFirebaseConfigured()) {
    console.error('ERROR: Firebase Admin SDK is not configured in .env');
    process.exit(1);
  }

  const topic = 'all-users';
  const title = '🪔 Ganpati Bappa Morya! 🙏';
  const body = 'This Ganesh Chaturthi, remove the obstacles standing between you and your goals. Complete today’s habits and take one step closer to becoming your best self! 💪✨';
  const data = {
    type: 'engagement_broadcast',
    audience: topic,
    category: 'motivation',
  };

  console.log(`Sending blast notification to topic "${topic}"...`);
  console.log(`Title: ${title}`);
  console.log(`Body: ${body}`);

  try {
    const result = await sendTopicPushNotification(topic, {
      title,
      body,
      data,
    });
    console.log('SUCCESS: Broadcast notification sent successfully!');
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('FAILED to send broadcast notification:', error);
    process.exit(1);
  }
}

main();
