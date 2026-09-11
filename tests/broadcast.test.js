const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const firebaseService = require('../services/firebaseService');

const originalFirebaseConfig = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY,
};

process.env.FIREBASE_PROJECT_ID ||= 'test-project';
process.env.FIREBASE_CLIENT_EMAIL ||= 'test@example.com';
process.env.FIREBASE_PRIVATE_KEY ||= 'test-key';

const sentMessages = [];
const messagingStub = {
  send: async (message) => {
    sentMessages.push(message);
    return 'test-message-id';
  },
};
const firebaseMock = firebaseService.getFirebaseMessaging;
firebaseService.getFirebaseMessaging = () => messagingStub;

const { sendBroadcast } = require('../controllers/broadcastController');
const { sendTopicPushNotification } = require('../services/notificationService');

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

after(() => {
  firebaseService.getFirebaseMessaging = firebaseMock;
  for (const [key, value] of Object.entries(originalFirebaseConfig)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test('topic sender uses the all-users topic and preserves engagement payload', async () => {
  sentMessages.length = 0;
  const result = await sendTopicPushNotification('all-users', {
    title: 'Keep Going!',
    body: 'Small progress is still progress.',
    data: { category: 'motivation' },
  });

  assert.deepEqual(result, { success: true, messageId: 'test-message-id' });
  assert.equal(sentMessages[0].topic, 'all-users');
  assert.deepEqual(sentMessages[0].notification, {
    title: 'Keep Going!',
    body: 'Small progress is still progress.',
  });
  assert.equal(sentMessages[0].data.category, 'motivation');
});

test('broadcast controller validates required fields and category', async () => {
  const missingTitle = responseRecorder();
  await sendBroadcast({ body: { body: 'Body' } }, missingTitle);
  assert.equal(missingTitle.statusCode, 400);

  const emptyBody = responseRecorder();
  await sendBroadcast({ body: { title: 'Title', body: '  ' } }, emptyBody);
  assert.equal(emptyBody.statusCode, 400);

  const invalidCategory = responseRecorder();
  await sendBroadcast({ body: { title: 'Title', body: 'Body', category: 'unknown' } }, invalidCategory);
  assert.equal(invalidCategory.statusCode, 400);
});

test('broadcast controller returns the FCM result without personalized delivery', async () => {
  sentMessages.length = 0;
  const response = responseRecorder();
  await sendBroadcast({
    body: { title: 'Challenge', body: 'Take one small step.', category: 'challenge' },
  }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.topic, 'all-users');
  assert.equal(response.body.messageId, 'test-message-id');
});

test('broadcast controller maps Firebase failures to a safe response', async () => {
  const originalSend = messagingStub.send;
  messagingStub.send = async () => {
    const error = new Error('provider details must not leak');
    error.code = 'messaging/internal-error';
    throw error;
  };

  const response = responseRecorder();
  await sendBroadcast({ body: { title: 'Title', body: 'Body' } }, response);
  assert.equal(response.statusCode, 502);
  assert.deepEqual(response.body, { error: 'Failed to send broadcast notification.' });
  messagingStub.send = originalSend;
});