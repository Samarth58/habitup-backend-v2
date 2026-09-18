const { test, describe, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { pool } = require('../services/db');
const firebaseService = require('../services/firebaseService');
const notificationService = require('../services/notificationService');
const { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, isValidLanguage, normalizeLanguage } = require('../constants/languages');
const { translate, interpolate, getLocalizedNotification, NOTIFICATION_TRANSLATIONS } = require('../services/translationService');
const { getUserNotificationLanguage, getUserLanguagePreference, updateUserLanguage } = require('../services/userLanguageService');
const { buildMorningContent, buildAfternoonContent, buildEveningContent, getPersonalizedContent } = require('../services/personalizedNotificationService');
const { sendFriendRequest, sendNudge } = require('../services/friendService');
const { upsertDeviceToken } = require('../services/deviceTokenService');
const { processSingleNotification } = require('../services/notificationSchedulerService');

afterEach(() => {
  mock.restoreAll();
});

describe('Multilingual System — Central Constants & Translation Engine', () => {
  test('1. Supported languages list contains all 9 required languages and English is default', () => {
    assert.equal(DEFAULT_LANGUAGE, 'en');
    assert.deepEqual(SUPPORTED_LANGUAGES, ['en', 'hi', 'te', 'ta', 'kn', 'ml', 'bn', 'mr', 'gu']);
    for (const lang of ['en', 'hi', 'te', 'ta', 'kn', 'ml', 'bn', 'mr', 'gu']) {
      assert.equal(isValidLanguage(lang), true, `${lang} should be valid`);
    }
    assert.equal(isValidLanguage('fr'), false);
    assert.equal(isValidLanguage('es'), false);
    assert.equal(isValidLanguage(''), false);
    assert.equal(isValidLanguage(null), false);
  });

  test('2. normalizeLanguage returns valid code or falls back to "en"', () => {
    assert.equal(normalizeLanguage('kn'), 'kn');
    assert.equal(normalizeLanguage('HI'), 'hi');
    assert.equal(normalizeLanguage('te '), 'te');
    assert.equal(normalizeLanguage('invalid'), 'en');
    assert.equal(normalizeLanguage(null), 'en');
    assert.equal(normalizeLanguage(undefined), 'en');
  });

  test('3. Translation dictionary has complete coverage for all 9 languages', () => {
    const requiredKeys = [
      'morning_reminder_title',
      'morning_reminder_body',
      'afternoon_reminder_title',
      'afternoon_reminder_body',
      'evening_reminder_title',
      'evening_reminder_body',
      'personalized_morning_zero_title',
      'personalized_morning_zero_body',
      'personalized_morning_one_title',
      'personalized_morning_one_body',
      'personalized_morning_multiple_title',
      'personalized_morning_multiple_body',
      'personalized_afternoon_zero_title',
      'personalized_afternoon_zero_body',
      'personalized_afternoon_all_one_title',
      'personalized_afternoon_all_one_body',
      'personalized_afternoon_all_multiple_title',
      'personalized_afternoon_all_multiple_body',
      'personalized_afternoon_none_one_title',
      'personalized_afternoon_none_one_body',
      'personalized_afternoon_none_multiple_title',
      'personalized_afternoon_none_multiple_body',
      'personalized_afternoon_partial_title',
      'personalized_afternoon_partial_body',
      'personalized_evening_zero_title',
      'personalized_evening_zero_body',
      'personalized_evening_all_one_title',
      'personalized_evening_all_one_body',
      'personalized_evening_all_multiple_title',
      'personalized_evening_all_multiple_body',
      'personalized_evening_one_left_title',
      'personalized_evening_one_left_body',
      'personalized_evening_multiple_left_title',
      'personalized_evening_multiple_left_body',
      'friend_request_title',
      'friend_request_body',
      'friend_request_accepted_title',
      'friend_request_accepted_body',
      'friend_nudge_habit_title',
      'friend_nudge_habit_body',
      'friend_nudge_general_title',
      'friend_nudge_general_body',
      'streak_milestone_title',
      'streak_milestone_body',
    ];

    for (const lang of SUPPORTED_LANGUAGES) {
      assert.ok(NOTIFICATION_TRANSLATIONS[lang], `Translations dictionary missing for ${lang}`);
      for (const key of requiredKeys) {
        assert.ok(
          NOTIFICATION_TRANSLATIONS[lang][key],
          `Missing translation key "${key}" for language "${lang}"`
        );
      }
    }
  });

  test('4. Missing translation safely falls back to English', () => {
    const translated = translate('non_existent_key', 'kn');
    assert.equal(typeof translated, 'string');
    // If not in Kannada or English dictionary, returns '' safely without throwing
    const fallback = translate('morning_reminder_title', 'unknown_lang');
    assert.equal(fallback, 'Good morning! 🌅');
  });

  test('5. Dynamic user names and habit names remain unchanged during interpolation', () => {
    const rawName = 'Rahul Sharma';
    const rawHabit = 'Morning 5km Run';

    // English
    const enText = translate('friend_nudge_habit_body', 'en', { name: rawName, habitName: rawHabit });
    assert.ok(enText.includes(rawName), 'English body must include raw user name');
    assert.ok(enText.includes(rawHabit), 'English body must include raw habit name');

    // Kannada
    const knText = translate('friend_nudge_habit_body', 'kn', { name: rawName, habitName: rawHabit });
    assert.ok(knText.includes(rawName), 'Kannada body must include raw user name');
    assert.ok(knText.includes(rawHabit), 'Kannada body must include raw habit name');

    // Hindi
    const hiText = translate('friend_nudge_habit_body', 'hi', { name: rawName, habitName: rawHabit });
    assert.ok(hiText.includes(rawName), 'Hindi body must include raw user name');
    assert.ok(hiText.includes(rawHabit), 'Hindi body must include raw habit name');
  });
});

describe('Multilingual System — User Language Resolution & API Services', () => {
  const testUserId = '123e4567-e89b-12d3-a456-426614174000';

  test('1. Existing users receive "en" after migration and default is "en"', async () => {
    mock.method(pool, 'query', async (q) => {
      if (q.includes('FROM users WHERE id = $1')) {
        return { rows: [{ preferred_language: 'en' }] };
      }
      return { rows: [] };
    });

    const lang = await getUserNotificationLanguage(testUserId);
    assert.equal(lang, 'en');

    const pref = await getUserLanguagePreference(testUserId);
    assert.deepEqual(pref, { language: 'en' });
  });

  test('2. Missing or null preferred_language resolves safely to "en"', async () => {
    mock.method(pool, 'query', async () => ({ rows: [{ preferred_language: null }] }));
    const lang = await getUserNotificationLanguage(testUserId);
    assert.equal(lang, 'en');
  });

  test('3. Non-existent user resolves safely to "en"', async () => {
    mock.method(pool, 'query', async () => ({ rows: [] }));
    const lang = await getUserNotificationLanguage('non-existent-user');
    assert.equal(lang, 'en');
  });

  test('4. PUT language updates language preference to supported language', async () => {
    mock.method(firebaseService, 'isFirebaseConfigured', () => false);
    mock.method(pool, 'query', async (q, params) => {
      if (q.includes('SELECT preferred_language FROM users')) {
        return { rows: [{ preferred_language: 'en' }] };
      }
      if (q.includes('UPDATE users')) {
        assert.equal(params[0], 'kn');
        assert.equal(params[1], testUserId);
        return { rows: [{ preferred_language: 'kn' }] };
      }
      return { rows: [] };
    });

    const result = await updateUserLanguage(testUserId, 'kn');
    assert.deepEqual(result, { language: 'kn' });
  });

  test('5. PUT language with unsupported language rejects with 400 and supported list', async () => {
    await assert.rejects(
      async () => updateUserLanguage(testUserId, 'fr'),
      (err) => {
        assert.equal(err.status, 400);
        assert.equal(err.message, 'Unsupported language');
        assert.deepEqual(err.supportedLanguages, SUPPORTED_LANGUAGES);
        return true;
      }
    );
  });

  test('6. PUT language with empty/null language rejects with 400', async () => {
    await assert.rejects(
      async () => updateUserLanguage(testUserId, ''),
      (err) => {
        assert.equal(err.status, 400);
        return true;
      }
    );
  });

  test('7. Changing language updates FCM topic subscription correctly (unsubscribes old, subscribes new)', async () => {
    mock.method(firebaseService, 'isFirebaseConfigured', () => true);

    const unsubMock = mock.method(firebaseService, 'unsubscribeTokenFromTopic', async () => ({ success: true }));
    const subMock = mock.method(firebaseService, 'subscribeTokenToTopic', async () => ({ success: true }));

    mock.method(pool, 'query', async (q) => {
      if (q.includes('SELECT preferred_language FROM users')) {
        return { rows: [{ preferred_language: 'en' }] };
      }
      if (q.includes('UPDATE users')) {
        return { rows: [{ preferred_language: 'te' }] };
      }
      if (q.includes('FROM device_tokens')) {
        return { rows: [{ token: 'device_token_abc' }] };
      }
      return { rows: [] };
    });

    const result = await updateUserLanguage(testUserId, 'te');
    assert.deepEqual(result, { language: 'te' });

    assert.equal(unsubMock.mock.callCount(), 1);
    assert.deepEqual(unsubMock.mock.calls[0].arguments, ['device_token_abc', 'all-users-en']);

    assert.equal(subMock.mock.callCount(), 1);
    assert.deepEqual(subMock.mock.calls[0].arguments, ['device_token_abc', 'all-users-te']);
  });
});

describe('Multilingual System — Personalized Notifications', () => {
  test('1. Morning personalized notification uses recipient language (Kannada)', () => {
    const zeroKn = buildMorningContent(0, 'kn');
    assert.equal(zeroKn.title, 'ಶುಭೋದಯ! 🌅');
    assert.ok(zeroKn.body.includes('ಅಭ್ಯಾಸಗಳು'));

    const oneKn = buildMorningContent(1, 'kn');
    assert.equal(oneKn.title, 'ಶುಭೋದಯ! 🌅');
    assert.ok(oneKn.body.includes('1 ಅಭ್ಯಾಸ'));

    const multiKn = buildMorningContent(3, 'kn');
    assert.ok(multiKn.body.includes('3 ಅಭ್ಯಾಸಗಳು'));
  });

  test('2. Afternoon personalized notification uses recipient language (Hindi)', () => {
    const allHi = buildAfternoonContent(3, 3, 'hi');
    assert.equal(allHi.title, 'HabitUp चेक-इन 🎉');
    assert.ok(allHi.body.includes('3 आदतें'));

    const partialHi = buildAfternoonContent(4, 2, 'hi');
    assert.equal(partialHi.title, 'HabitUp चेक-इन 💪');
    assert.ok(partialHi.body.includes('2') && partialHi.body.includes('4'));
  });

  test('3. Evening personalized notification uses recipient language (Telugu)', () => {
    const oneLeftTe = buildEveningContent(3, 2, 1, 'te');
    assert.equal(oneLeftTe.title, 'సాయంత్రం చెక్-ఇన్ 🌙');
    assert.ok(oneLeftTe.body.includes('1 అలవాటు'));

    const allCompletedTe = buildEveningContent(3, 3, 0, 'te');
    assert.ok(allCompletedTe.body.includes('3 అలవాట్లను'));
  });

  test('4. Existing English users continue receiving exact English default content', () => {
    const morningEn = buildMorningContent(1, 'en');
    assert.equal(morningEn.title, 'Good morning! 🌅');
    assert.equal(morningEn.body, "You have 1 habit planned today. You've got this!");

    const eveningEn = buildEveningContent(3, 2, 1, 'en');
    assert.equal(eveningEn.title, 'Evening check-in 🌙');
    assert.equal(eveningEn.body, "You're almost there! Just 1 habit left today. 🔥");
  });
});

describe('Multilingual System — Friend Notifications', () => {
  const requesterId = '11111111-1111-1111-1111-111111111111';
  const recipientId = '22222222-2222-2222-2222-222222222222';

  test('1. Friend request notification uses recipient language (Gujarati)', async () => {
    mock.method(firebaseService, 'isFirebaseConfigured', () => true);
    const pushMock = mock.method(notificationService, 'sendPushNotification', async () => ({ messageId: 'msg-1' }));

    mock.method(pool, 'query', async (q) => {
      if (q.includes('FROM users') && q.includes('LOWER(username) = LOWER($1)')) {
        return { rows: [{ id: recipientId, username: 'ayush_g', email: 'ayush@example.com' }] };
      }
      if (q.includes('FROM friend_requests')) {
        return { rows: [] };
      }
      if (q.includes('FROM friendships')) {
        return { rowCount: 0, rows: [] };
      }
      if (q.includes('INSERT INTO friend_requests')) {
        return {
          rows: [{ request_id: 'req-1', from_user_id: requesterId, to_user_id: recipientId, status: 'pending' }],
        };
      }
      if (q.includes('FROM device_tokens')) {
        return { rows: [{ id: 'dt-1', token: 'fcm_tok_recipient' }] };
      }
      if (q.includes('SELECT name, username FROM users WHERE id = $1')) {
        return { rows: [{ name: 'Rahul Patel', username: 'rahul_p' }] };
      }
      if (q.includes('SELECT preferred_language FROM users WHERE id = $1')) {
        return { rows: [{ preferred_language: 'gu' }] };
      }
      return { rows: [] };
    });

    await sendFriendRequest(requesterId, 'ayush_g');

    assert.equal(pushMock.mock.callCount(), 1);
    const pushPayload = pushMock.mock.calls[0].arguments[1];
    assert.equal(pushPayload.title, 'નવી મિત્ર વિનંતી');
    assert.ok(pushPayload.body.includes('Rahul Patel'));
    assert.ok(pushPayload.body.includes('મિત્ર વિનંતી'));
  });

  test('2. Friend nudge notification uses recipient language (Marathi)', async () => {
    mock.method(firebaseService, 'isFirebaseConfigured', () => true);
    const pushMock = mock.method(notificationService, 'sendPushNotification', async () => ({ messageId: 'msg-2' }));

    mock.method(pool, 'query', async (q) => {
      if (q.includes('FROM friendships')) {
        return { rowCount: 1, rows: [{ id: 'f-1' }] };
      }
      if (q.includes('SELECT name, username FROM users WHERE id = $1')) {
        return { rows: [{ name: 'Sneha Rao', username: 'sneha_r' }] };
      }
      if (q.includes('FROM device_tokens')) {
        return { rows: [{ id: 'dt-2', token: 'fcm_tok_friend' }] };
      }
      if (q.includes('SELECT preferred_language FROM users WHERE id = $1')) {
        return { rows: [{ preferred_language: 'mr' }] };
      }
      return { rows: [] };
    });

    await sendNudge(requesterId, recipientId, 'Daily Meditation');

    assert.equal(pushMock.mock.callCount(), 1);
    const pushPayload = pushMock.mock.calls[0].arguments[1];
    assert.equal(pushPayload.title, 'सवय आठवण 👋');
    assert.ok(pushPayload.body.includes('Sneha Rao'));
    assert.ok(pushPayload.body.includes('Daily Meditation'));
  });
});

describe('Multilingual System — Device Token Topic Subscriptions', () => {
  const userId = '123e4567-e89b-12d3-a456-426614174000';

  test('1. Registering device token subscribes to all-users and all-users-<lang>', async () => {
    mock.method(firebaseService, 'isFirebaseConfigured', () => true);
    const subMock = mock.method(firebaseService, 'subscribeTokenToTopic', async () => ({ success: true }));

    mock.method(pool, 'query', async (q) => {
      if (q.includes('INSERT INTO device_tokens')) {
        return { rows: [{ id: 1, token: 'fcm_tok_123', platform: 'android', timezone: 'UTC' }] };
      }
      if (q.includes('INSERT INTO notification_preferences')) {
        return { rows: [{ id: 1 }] };
      }
      if (q.includes('SELECT preferred_language FROM users')) {
        return { rows: [{ preferred_language: 'ta' }] };
      }
      return { rows: [] };
    });

    await upsertDeviceToken(userId, { token: 'fcm_tok_123', platform: 'android', timezone: 'UTC' });

    assert.equal(subMock.mock.callCount(), 2);
    assert.deepEqual(subMock.mock.calls[0].arguments, ['fcm_tok_123', 'all-users']);
    assert.deepEqual(subMock.mock.calls[1].arguments, ['fcm_tok_123', 'all-users-ta']);
  });
});

describe('Multilingual Broadcast & No-Duplicate Delivery Verification', () => {
  const { processAutomatedBroadcasts } = require('../services/broadcastScheduleService');

  test('1. Kannada user does not receive both all-users English and all-users-kn Kannada broadcast', async () => {
    mock.method(firebaseService, 'isFirebaseConfigured', () => true);
    mock.method(notificationService, 'isFirebaseConfigured', () => true);

    const sentTopicDispatches = [];
    mock.method(notificationService, 'sendTopicPushNotification', async (topic, payload) => {
      sentTopicDispatches.push({ topic, payload });
      return { success: true, messageId: `msg-${topic}` };
    });

    mock.method(pool, 'query', async (q) => {
      if (q.includes('INSERT INTO broadcast_deliveries')) {
        return { rows: [{ id: 'b-deliv-101' }] };
      }
      if (q.includes('UPDATE broadcast_deliveries')) {
        return { rows: [] };
      }
      return { rows: [] };
    });

    // Run automated broadcast slot at 10:30 AM IST
    const morningSlotTime = new Date('2099-06-15T05:00:00.000Z'); // 10:30 IST
    const res = await processAutomatedBroadcasts(morningSlotTime, 'Asia/Kolkata');

    assert.equal(res.attempted, true);
    assert.equal(res.status, 'sent');

    // 1. Verify broadcast dispatches were sent to each language topic
    const dispatchedTopics = sentTopicDispatches.map((d) => d.topic);
    assert.ok(dispatchedTopics.includes('all-users-kn'), 'Must dispatch to all-users-kn');
    assert.ok(dispatchedTopics.includes('all-users-en'), 'Must dispatch to all-users-en');

    // 2. PROOF: Verify NO broadcast was sent to legacy 'all-users' topic
    assert.ok(
      !dispatchedTopics.includes('all-users'),
      'CRITICAL: Must NOT dispatch automated broadcast to all-users to prevent duplicate delivery'
    );

    // 3. User device simulation:
    // A Kannada user device is subscribed to ['all-users', 'all-users-kn']
    const kannadaUserSubscriptions = new Set(['all-users', 'all-users-kn']);
    const messagesReceivedByKannadaUser = sentTopicDispatches.filter((d) =>
      kannadaUserSubscriptions.has(d.topic)
    );

    // Assert that the Kannada user receives EXACTLY ONE broadcast, exclusively from 'all-users-kn'
    assert.equal(
      messagesReceivedByKannadaUser.length,
      1,
      'Kannada user must receive exactly 1 broadcast, not duplicate messages'
    );
    assert.equal(messagesReceivedByKannadaUser[0].topic, 'all-users-kn');

    // 4. English user device simulation:
    // An English user device is subscribed to ['all-users', 'all-users-en']
    const englishUserSubscriptions = new Set(['all-users', 'all-users-en']);
    const messagesReceivedByEnglishUser = sentTopicDispatches.filter((d) =>
      englishUserSubscriptions.has(d.topic)
    );

    assert.equal(
      messagesReceivedByEnglishUser.length,
      1,
      'English user must receive exactly 1 broadcast, not duplicate messages'
    );
    assert.equal(messagesReceivedByEnglishUser[0].topic, 'all-users-en');
  });
});

