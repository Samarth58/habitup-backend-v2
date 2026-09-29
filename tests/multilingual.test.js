const { test, describe, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { pool } = require('../services/db');
const firebaseService = require('../services/firebaseService');
const notificationService = require('../services/notificationService');
const { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, isValidLanguage, normalizeLanguage } = require('../constants/languages');
const { translate, interpolate, getLocalizedNotification, NOTIFICATION_TRANSLATIONS, localizeHabitText } = require('../services/translationService');
const { getUserNotificationLanguage, getUserLanguagePreference, updateUserLanguage } = require('../services/userLanguageService');
const { buildMorningContent, buildAfternoonContent, buildEveningContent, getPersonalizedContent } = require('../services/personalizedNotificationService');
const { sendFriendRequest, sendNudge } = require('../services/friendService');
const { upsertDeviceToken } = require('../services/deviceTokenService');
const { processSingleNotification } = require('../services/notificationSchedulerService');
const { createHabit, updateHabit } = require('../services/habitService');

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
      'panda_happy_title',
      'panda_happy_body',
      'panda_celebrating_title',
      'panda_celebrating_body',
      'panda_encouraging_title',
      'panda_encouraging_body',
      'panda_excited_title',
      'panda_excited_body',
      'panda_sad_title',
      'panda_sad_body',
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

describe('Multilingual System — Habit Creation & Dynamic Localization', () => {
  const userEnId = '33333333-3333-3333-3333-333333333333';
  const userKnId = '44444444-4444-4444-4444-444444444444';
  const userHiId = '55555555-5555-5555-5555-555555555555';
  const userNullLangId = '66666666-6666-6666-6666-666666666666';

  test('1. localizeHabitText preserves original English text when language is "en"', async () => {
    const res = await localizeHabitText('Drink Water', 'en');
    assert.equal(res, 'Drink Water');
  });

  test('2. localizeHabitText falls back to original text when language is invalid or unsupported', async () => {
    const res1 = await localizeHabitText('Drink Water', 'fr');
    assert.equal(res1, 'Drink Water');

    const res2 = await localizeHabitText('Drink Water', null);
    assert.equal(res2, 'Drink Water');

    const res3 = await localizeHabitText('', 'kn');
    assert.equal(res3, '');
  });

  test('3. localizeHabitText gracefully falls back to original text when GEMINI_API_KEY is missing', async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      const res = await localizeHabitText('Drink Water', 'kn');
      assert.equal(res, 'Drink Water');
    } finally {
      if (originalKey) process.env.GEMINI_API_KEY = originalKey;
    }
  });

  test('4. English user creating habit preserves original English name', async () => {
    let insertedName = null;
    mock.method(pool, 'query', async (q, params) => {
      if (q.includes('SELECT preferred_language FROM users')) {
        return { rows: [{ preferred_language: 'en' }] };
      }
      if (q.includes('INSERT INTO habits')) {
        insertedName = params[1];
        return {
          rows: [{
            id: 'habit-en-1',
            user_id: userEnId,
            name: params[1],
            description: params[2],
            icon: params[3],
            color: params[4],
            frequency_type: params[5],
          }],
        };
      }
      return { rows: [] };
    });

    const habit = await createHabit(userEnId, {
      name: 'Drink Water',
      description: '2 liters per day',
      frequency_type: 'daily',
    });

    assert.equal(insertedName, 'Drink Water');
    assert.equal(habit.name, 'Drink Water');
  });

  test('5. Kannada user creating habit localizes name to Kannada', async () => {
    let insertedName = null;
    mock.method(pool, 'query', async (q, params) => {
      if (q.includes('SELECT preferred_language FROM users')) {
        return { rows: [{ preferred_language: 'kn' }] };
      }
      if (q.includes('INSERT INTO habits')) {
        insertedName = params[1];
        return {
          rows: [{
            id: 'habit-kn-1',
            user_id: userKnId,
            name: params[1],
            frequency_type: params[5],
          }],
        };
      }
      return { rows: [] };
    });

    // Mock translation service for Kannada
    const translationService = require('../services/translationService');
    const localizeMock = mock.method(translationService, 'localizeHabitText', async (text, lang) => {
      if (text === 'Drink Water' && lang === 'kn') {
        return 'ನೀರು ಕುಡಿಯಿರಿ';
      }
      return text;
    });

    const habit = await createHabit(userKnId, {
      name: 'Drink Water',
      frequency_type: 'daily',
    });

    assert.equal(localizeMock.mock.callCount(), 1);
    assert.equal(insertedName, 'ನೀರು ಕುಡಿಯಿರಿ');
    assert.equal(habit.name, 'ನೀರು ಕುಡಿಯಿರಿ');
  });

  test('6. Another supported-language user (Hindi) creates habit localized to Hindi', async () => {
    let insertedName = null;
    mock.method(pool, 'query', async (q, params) => {
      if (q.includes('SELECT preferred_language FROM users')) {
        return { rows: [{ preferred_language: 'hi' }] };
      }
      if (q.includes('INSERT INTO habits')) {
        insertedName = params[1];
        return {
          rows: [{
            id: 'habit-hi-1',
            user_id: userHiId,
            name: params[1],
            frequency_type: params[5],
          }],
        };
      }
      return { rows: [] };
    });

    const translationService = require('../services/translationService');
    const localizeMock = mock.method(translationService, 'localizeHabitText', async (text, lang) => {
      if (text === 'Morning Walk' && lang === 'hi') {
        return 'सुबह की सैर';
      }
      return text;
    });

    const habit = await createHabit(userHiId, {
      name: 'Morning Walk',
      frequency_type: 'daily',
    });

    assert.equal(localizeMock.mock.callCount(), 1);
    assert.equal(insertedName, 'सुबह की सैर');
    assert.equal(habit.name, 'सुबह की सैर');
  });

  test('7. Missing or null preferred_language falls back safely to English', async () => {
    let insertedName = null;
    mock.method(pool, 'query', async (q, params) => {
      if (q.includes('SELECT preferred_language FROM users')) {
        return { rows: [{ preferred_language: null }] };
      }
      if (q.includes('INSERT INTO habits')) {
        insertedName = params[1];
        return {
          rows: [{
            id: 'habit-null-1',
            user_id: userNullLangId,
            name: params[1],
            frequency_type: params[5],
          }],
        };
      }
      return { rows: [] };
    });

    const habit = await createHabit(userNullLangId, {
      name: 'Read 10 Pages',
      frequency_type: 'daily',
    });

    assert.equal(insertedName, 'Read 10 Pages');
    assert.equal(habit.name, 'Read 10 Pages');
  });

  test('8. Translation failure / exception does not break habit creation and falls back safely', async () => {
    let insertedName = null;
    mock.method(pool, 'query', async (q, params) => {
      if (q.includes('SELECT preferred_language FROM users')) {
        return { rows: [{ preferred_language: 'te' }] };
      }
      if (q.includes('INSERT INTO habits')) {
        insertedName = params[1];
        return {
          rows: [{
            id: 'habit-fallback-1',
            user_id: '77777777-7777-7777-7777-777777777777',
            name: params[1],
            frequency_type: params[5],
          }],
        };
      }
      return { rows: [] };
    });

    const translationService = require('../services/translationService');
    mock.method(translationService, 'localizeHabitText', async () => {
      throw new Error('Gemini upstream network timeout');
    });

    const habit = await createHabit('77777777-7777-7777-7777-777777777777', {
      name: 'Evening Stretch',
      frequency_type: 'daily',
    });

    // Successfully created despite translation service failure
    assert.equal(insertedName, 'Evening Stretch');
    assert.equal(habit.name, 'Evening Stretch');
  });

  test('9. Panda completion notifications produce localized FCM payloads for non-English users', async () => {
    const { handleHabitCompletionPandaNotification } = require('../services/pandaNotificationService');
    const deviceTokenService = require('../services/deviceTokenService');
    const userKnId = '88888888-8888-8888-8888-888888888888';

    mock.method(firebaseService, 'isFirebaseConfigured', () => true);
    mock.method(deviceTokenService, 'getDeviceTokensByUserId', async () => [
      { id: 1, token: 'fcm-kn-token-123', platform: 'android', timezone: 'Asia/Kolkata' },
    ]);
    mock.method(pool, 'query', async (q) => {
      if (q.includes('SELECT preferred_language FROM users')) {
        return { rows: [{ preferred_language: 'kn' }] };
      }
      if (q.includes('SELECT COUNT(h.id)::int AS planned')) {
        return { rows: [{ planned: 1 }] };
      }
      if (q.includes('SELECT COUNT(hc.id)::int AS completed')) {
        return { rows: [{ completed: 1 }] };
      }
      if (q.includes('INSERT INTO notification_deliveries')) {
        return { rows: [{ id: 'deliv-kn-1' }] };
      }
      if (q.includes('UPDATE notification_deliveries')) {
        return { rows: [] };
      }
      return { rows: [] };
    });

    const sendMock = mock.method(notificationService, 'sendPushNotification', async () => ({
      success: true,
      messageId: 'msg-kn-test',
    }));

    const res = await handleHabitCompletionPandaNotification({
      userId: userKnId,
      habitId: 'habit-kn-1',
      streak: 1,
      timezone: 'Asia/Kolkata',
    });

    assert.equal(res.sent, true);
    assert.equal(res.state, 'celebrating');
    assert.equal(sendMock.mock.callCount(), 1);
    const pushArg = sendMock.mock.calls[0].arguments[1];
    assert.equal(pushArg.title, 'HabitUp');
    assert.equal(pushArg.body, 'ಅದ್ಭುತ! ನೀವು ಇಂದು ನಿಮ್ಮ ಎಲ್ಲಾ ಅಭ್ಯಾಸಗಳನ್ನು ಪೂರ್ಣಗೊಳಿಸಿದ್ದೀರಿ!');
    assert.equal(pushArg.data.type, 'panda_notification');
    assert.equal(pushArg.data.pandaEmotion, 'celebrating');
  });
});

describe('Multilingual System — original_name Preservation & Language-Change Retranslation', () => {
  const translationService = require('../services/translationService');
  const habitUserId = '99999999-4444-4444-4444-444444444444';

  test('A. New habit in English: original_name preserved, name correct, no provider call', async () => {
    let insertParams = null;
    const localizeMock = mock.method(translationService, 'localizeHabitText', async (text) => text);

    mock.method(pool, 'query', async (q, params) => {
      if (q.includes('SELECT preferred_language FROM users')) {
        return { rows: [{ preferred_language: 'en' }] };
      }
      if (q.includes('INSERT INTO habits')) {
        insertParams = params;
        return {
          rows: [{
            id: 'habit-a-1',
            user_id: habitUserId,
            name: params[1],
            original_name: params[6],
            frequency_type: params[5],
          }],
        };
      }
      return { rows: [] };
    });

    const habit = await createHabit(habitUserId, {
      name: 'Morning Run',
      frequency_type: 'daily',
    });

    assert.equal(habit.name, 'Morning Run');
    assert.equal(habit.original_name, 'Morning Run');
    assert.equal(insertParams[1], 'Morning Run');
    assert.equal(insertParams[6], 'Morning Run');
    assert.equal(localizeMock.mock.callCount(), 0, 'English habit must not call the translation provider');
  });

  test('B. New habit in non-English language: original_name stays raw input, name is localized', async () => {
    let insertParams = null;

    mock.method(pool, 'query', async (q, params) => {
      if (q.includes('SELECT preferred_language FROM users')) {
        return { rows: [{ preferred_language: 'kn' }] };
      }
      if (q.includes('INSERT INTO habits')) {
        insertParams = params;
        return {
          rows: [{
            id: 'habit-b-1',
            user_id: habitUserId,
            name: params[1],
            original_name: params[6],
            frequency_type: params[5],
          }],
        };
      }
      return { rows: [] };
    });

    const localizeMock = mock.method(translationService, 'localizeHabitText', async (text, lang) => {
      if (text === 'Morning Run' && lang === 'kn') {
        return 'ಬೆಳಿಗ್ಗೆ ಓಟ';
      }
      return text;
    });

    const habit = await createHabit(habitUserId, {
      name: 'Morning Run',
      frequency_type: 'daily',
    });

    assert.equal(habit.original_name, 'Morning Run');
    assert.equal(habit.name, 'ಬೆಳಿಗ್ಗೆ ಓಟ');
    assert.equal(insertParams[6], 'Morning Run', 'original_name must store raw user input');
    assert.equal(insertParams[1], 'ಬೆಳಿಗ್ಗೆ ಓಟ', 'name must store the localized text');
    assert.equal(localizeMock.mock.callCount(), 1);
    assert.deepEqual(localizeMock.mock.calls[0].arguments, ['Morning Run', 'kn']);
  });

  test('C. Changing preferred language retranslates active habits from original_name', async () => {
    let selectHabitsQuery = '';
    let updateHabitsQuery = '';
    let updateHabitsParams = null;

    mock.method(firebaseService, 'isFirebaseConfigured', () => false);
    mock.method(pool, 'query', async (q, params) => {
      if (q.includes('SELECT preferred_language FROM users')) {
        return { rows: [{ preferred_language: 'en' }] };
      }
      if (q.includes('UPDATE users')) {
        return { rows: [{ preferred_language: params[0] }] };
      }
      if (q.includes('COALESCE(original_name, name) AS original_name')) {
        selectHabitsQuery = q;
        return { rows: [{ id: 'habit-c-1', name: 'Morning Run', original_name: 'Morning Run' }] };
      }
      if (q.includes('UPDATE habits') && q.includes('COALESCE(original_name, name) = $4')) {
        updateHabitsQuery = q;
        updateHabitsParams = params;
        return { rowCount: 1, rows: [] };
      }
      return { rows: [] };
    });

    const localizeMock = mock.method(translationService, 'localizeHabitText', async (text, lang) => {
      if (text === 'Morning Run' && lang === 'kn') {
        return 'ಬೆಳಿಗ್ಗೆ ಓಟ';
      }
      return text;
    });

    const result = await updateUserLanguage(habitUserId, 'kn');

    assert.deepEqual(result, { language: 'kn' });
    assert.equal(localizeMock.mock.callCount(), 1);
    assert.deepEqual(localizeMock.mock.calls[0].arguments, ['Morning Run', 'kn']);

    assert.ok(selectHabitsQuery.includes('user_id = $1'), 'retranslation must scope to the user');
    assert.ok(selectHabitsQuery.includes('deleted_at IS NULL'), 'deleted habits must be excluded');
    assert.ok(selectHabitsQuery.includes('archived_at IS NULL'), 'archived habits must be excluded');

    assert.ok(updateHabitsParams, 'habits.name must be updated after language change');
    assert.equal(updateHabitsParams[0], 'habit-c-1');
    assert.equal(updateHabitsParams[1], habitUserId);
    assert.equal(updateHabitsParams[2], 'ಬೆಳಿಗ್ಗೆ ಓಟ', 'name updated to new language');
    assert.equal(updateHabitsParams[3], 'Morning Run', 'original_name is the translation source and is preserved');
    assert.equal(updateHabitsParams[4], 'kn');
    assert.ok(updateHabitsQuery.includes('deleted_at IS NULL'), 'update must not touch deleted habits');
    assert.ok(updateHabitsQuery.includes('archived_at IS NULL'), 'update must not touch archived habits');
    assert.ok(updateHabitsQuery.includes('preferred_language = $5'), 'update guarded against a newer language selection');
  });

  test('D. Multiple language changes (en -> kn -> hi) always translate from original_name, never chained', async () => {
    const habitRow = { id: 'habit-d-1', name: 'Morning Run', original_name: 'Morning Run' };
    const localizedNames = {
      en: 'Morning Run',
      kn: 'ಬೆಳಿಗ್ಗೆ ಓಟ',
      hi: 'सुबह दौड़',
    };
    let currentLang = 'en';

    mock.method(firebaseService, 'isFirebaseConfigured', () => false);
    mock.method(pool, 'query', async (q, params) => {
      if (q.includes('SELECT preferred_language FROM users')) {
        return { rows: [{ preferred_language: currentLang }] };
      }
      if (q.includes('UPDATE users')) {
        currentLang = params[0];
        return { rows: [{ preferred_language: currentLang }] };
      }
      if (q.includes('COALESCE(original_name, name) AS original_name')) {
        return { rows: [{ ...habitRow }] };
      }
      if (q.includes('UPDATE habits') && q.includes('COALESCE(original_name, name) = $4')) {
        habitRow.name = params[2];
        return { rowCount: 1, rows: [] };
      }
      return { rows: [] };
    });

    const localizeMock = mock.method(translationService, 'localizeHabitText', async (text, lang) => {
      return localizedNames[lang] ?? text;
    });

    const first = await updateUserLanguage(habitUserId, 'kn');
    const second = await updateUserLanguage(habitUserId, 'hi');

    assert.deepEqual(first, { language: 'kn' });
    assert.deepEqual(second, { language: 'hi' });
    assert.equal(localizeMock.mock.callCount(), 2);

    assert.equal(localizeMock.mock.calls[0].arguments[0], 'Morning Run', 'first pass translates from original_name');
    assert.equal(localizeMock.mock.calls[1].arguments[0], 'Morning Run', 'second pass still translates from original_name');
    assert.equal(localizeMock.mock.calls[0].arguments[1], 'kn');
    assert.equal(localizeMock.mock.calls[1].arguments[1], 'hi');
    assert.equal(habitRow.name, 'सुबह दौड़', 'display name ends up in the latest language');
    assert.equal(habitRow.original_name, 'Morning Run', 'original_name never changes across language switches');
  });

  test('E. Habit name update: original_name changes and name is localized with current language', async () => {
    let updateQuery = '';
    let updateParams = null;

    mock.method(pool, 'query', async (q, params) => {
      if (q.includes('SELECT preferred_language FROM users')) {
        return { rows: [{ preferred_language: 'kn' }] };
      }
      if (q.includes('FROM habits') && q.includes('WHERE id = $1 AND user_id = $2')) {
        return {
          rows: [{
            id: 'habit-e-1',
            user_id: habitUserId,
            name: 'ಹಳೆಯ ಹೆಸರು',
            original_name: 'Old Habit Name',
            frequency_type: 'daily',
          }],
        };
      }
      if (q.includes('UPDATE habits')) {
        updateQuery = q;
        updateParams = params;
        return {
          rowCount: 1,
          rows: [{
            id: 'habit-e-1',
            user_id: habitUserId,
            name: params[2],
            original_name: params[3],
            frequency_type: 'daily',
          }],
        };
      }
      return { rows: [] };
    });

    const localizeMock = mock.method(translationService, 'localizeHabitText', async (text, lang) => {
      if (text === 'New Habit Name' && lang === 'kn') {
        return 'ಹೊಸ ಹೆಸರು';
      }
      return text;
    });

    const updated = await updateHabit(habitUserId, 'habit-e-1', {
      name: 'New Habit Name',
      color: '#e74c3c',
    });

    assert.equal(localizeMock.mock.callCount(), 1);
    assert.deepEqual(localizeMock.mock.calls[0].arguments, ['New Habit Name', 'kn']);
    assert.ok(updateQuery.includes('original_name = $4'), 'rename must write original_name');
    assert.equal(updateParams[0], 'habit-e-1');
    assert.equal(updateParams[1], habitUserId);
    assert.equal(updateParams[2], 'ಹೊಸ ಹೆಸರು', 'name localized from the new input');
    assert.equal(updateParams[3], 'New Habit Name', 'original_name stores the new raw input');
    assert.equal(updateParams[4], '#e74c3c');
    assert.equal(updated.name, 'ಹೊಸ ಹೆಸರು');
    assert.equal(updated.original_name, 'New Habit Name');
  });

  test('E2. Habit update without a name change does not retranslate the name', async () => {
    let updateQuery = '';
    let updateCount = 0;

    mock.method(pool, 'query', async (q, params) => {
      if (q.includes('SELECT preferred_language FROM users')) {
        return { rows: [{ preferred_language: 'kn' }] };
      }
      if (q.includes('UPDATE habits')) {
        updateCount += 1;
        updateQuery = q;
        return {
          rowCount: 1,
          rows: [{
            id: 'habit-e2-1',
            user_id: habitUserId,
            name: 'ಬೆಳಿಗ್ಗೆ ಓಟ',
            original_name: 'Morning Run',
            color: params ? params[2] : null,
            frequency_type: 'daily',
          }],
        };
      }
      return { rows: [] };
    });

    const localizeMock = mock.method(translationService, 'localizeHabitText', async (text) => text);

    const updated = await updateHabit(habitUserId, 'habit-e2-1', { color: '#123456' });

    assert.equal(localizeMock.mock.callCount(), 0, 'no name change means no provider call');
    assert.equal(updateCount, 1);
    assert.ok(!updateQuery.includes('original_name'), 'original_name must not be rewritten');
    assert.ok(!updateQuery.includes('SET name'), 'name must not be rewritten');
    assert.equal(updated.name, 'ಬೆಳಿಗ್ಗೆ ಓಟ');
    assert.equal(updated.original_name, 'Morning Run');
  });

  test('E3. Habit update with an unchanged name does not retranslate', async () => {
    let updateCount = 0;

    mock.method(pool, 'query', async (q) => {
      if (q.includes('SELECT preferred_language FROM users')) {
        return { rows: [{ preferred_language: 'kn' }] };
      }
      if (q.includes('FROM habits') && q.includes('WHERE id = $1 AND user_id = $2')) {
        return {
          rows: [{
            id: 'habit-e3-1',
            user_id: habitUserId,
            name: 'ಹೊಸ ಹೆಸರು',
            original_name: 'New Habit Name',
            frequency_type: 'daily',
          }],
        };
      }
      if (q.includes('UPDATE habits')) {
        updateCount += 1;
        return { rowCount: 1, rows: [] };
      }
      return { rows: [] };
    });

    const localizeMock = mock.method(translationService, 'localizeHabitText', async (text) => text);

    const habit = await updateHabit(habitUserId, 'habit-e3-1', { name: 'New Habit Name' });

    assert.equal(localizeMock.mock.callCount(), 0, 'unchanged name must not trigger translation');
    assert.equal(updateCount, 0, 'unchanged name must not rewrite the habit');
    assert.equal(habit.name, 'ಹೊಸ ಹೆಸರು');
    assert.equal(habit.original_name, 'New Habit Name');
  });

  test('F. Archived and deleted habits are never retranslated', async () => {
    let selectHabitsQuery = '';
    let updateCount = 0;

    mock.method(firebaseService, 'isFirebaseConfigured', () => false);
    mock.method(pool, 'query', async (q, params) => {
      if (q.includes('SELECT preferred_language FROM users')) {
        return { rows: [{ preferred_language: 'en' }] };
      }
      if (q.includes('UPDATE users')) {
        return { rows: [{ preferred_language: params[0] }] };
      }
      if (q.includes('COALESCE(original_name, name) AS original_name')) {
        selectHabitsQuery = q;
        return { rows: [] };
      }
      if (q.includes('UPDATE habits')) {
        updateCount += 1;
        return { rowCount: 1, rows: [] };
      }
      return { rows: [] };
    });

    const localizeMock = mock.method(translationService, 'localizeHabitText', async (text) => text);

    const result = await updateUserLanguage(habitUserId, 'kn');

    assert.deepEqual(result, { language: 'kn' });
    assert.equal(updateCount, 0, 'no active habits means nothing is rewritten');
    assert.equal(localizeMock.mock.callCount(), 0);
    assert.ok(selectHabitsQuery.includes('user_id = $1'), 'scoped to a single user');
    assert.ok(selectHabitsQuery.includes('deleted_at IS NULL'), 'deleted habits excluded');
    assert.ok(selectHabitsQuery.includes('archived_at IS NULL'), 'archived habits excluded');
    assert.ok(!selectHabitsQuery.includes('paused_at'), 'paused habits remain eligible for retranslation');
  });

  test('G. Translation provider failure does not fail the language change or corrupt habit names', async () => {
    let updateHabitCount = 0;

    mock.method(firebaseService, 'isFirebaseConfigured', () => false);
    mock.method(pool, 'query', async (q, params) => {
      if (q.includes('SELECT preferred_language FROM users')) {
        return { rows: [{ preferred_language: 'en' }] };
      }
      if (q.includes('UPDATE users')) {
        return { rows: [{ preferred_language: params[0] }] };
      }
      if (q.includes('COALESCE(original_name, name) AS original_name')) {
        return { rows: [{ id: 'habit-g-1', name: 'Morning Run', original_name: 'Morning Run' }] };
      }
      if (q.includes('UPDATE habits')) {
        updateHabitCount += 1;
        return { rowCount: 1, rows: [] };
      }
      return { rows: [] };
    });

    const localizeMock = mock.method(translationService, 'localizeHabitText', async () => {
      throw new Error('Gemini provider unavailable');
    });

    const result = await updateUserLanguage(habitUserId, 'kn');

    assert.deepEqual(result, { language: 'kn' }, 'language change must succeed despite provider failure');
    assert.equal(localizeMock.mock.callCount(), 1, 'translation was attempted');
    assert.equal(updateHabitCount, 0, 'failed translation must not overwrite the existing localized name');
  });

  test('H. Switching to English restores name from original_name with no provider call', async () => {
    let updateHabitsParams = null;

    mock.method(firebaseService, 'isFirebaseConfigured', () => false);
    mock.method(pool, 'query', async (q, params) => {
      if (q.includes('SELECT preferred_language FROM users')) {
        return { rows: [{ preferred_language: 'kn' }] };
      }
      if (q.includes('UPDATE users')) {
        return { rows: [{ preferred_language: params[0] }] };
      }
      if (q.includes('COALESCE(original_name, name) AS original_name')) {
        return { rows: [{ id: 'habit-h-1', name: 'ಬೆಳಿಗ್ಗೆ ಓಟ', original_name: 'Morning Run' }] };
      }
      if (q.includes('UPDATE habits') && q.includes('COALESCE(original_name, name) = $4')) {
        updateHabitsParams = params;
        return { rowCount: 1, rows: [] };
      }
      return { rows: [] };
    });

    const localizeMock = mock.method(translationService, 'localizeHabitText', async (text) => text);

    const result = await updateUserLanguage(habitUserId, 'en');

    assert.deepEqual(result, { language: 'en' });
    assert.equal(localizeMock.mock.callCount(), 0, 'English must not call the translation provider');
    assert.ok(updateHabitsParams, 'display name must be restored from original_name');
    assert.equal(updateHabitsParams[2], 'Morning Run');
    assert.equal(updateHabitsParams[3], 'Morning Run');
    assert.equal(updateHabitsParams[4], 'en');
  });

  test('I. Migration adds original_name column and backfills existing habits', async () => {
    const migration = require('../migrations/1787730000016_add_original_name_to_habits');
    const calls = { columns: [], sql: [], dropped: [] };
    const pgm = {
      addColumn: (table, defs) => calls.columns.push({ table, defs }),
      sql: (query) => calls.sql.push(query),
      dropColumn: (table, column) => calls.dropped.push({ table, column }),
    };

    await migration.up(pgm);
    migration.down(pgm);

    assert.equal(calls.columns.length, 1);
    assert.equal(calls.columns[0].table, 'habits');
    assert.equal(calls.columns[0].defs.original_name.type, 'varchar(255)');

    assert.equal(calls.sql.length, 1, 'migration must backfill existing rows');
    const backfill = calls.sql[0].replace(/\s+/g, ' ');
    assert.ok(backfill.includes('SET original_name = name'), 'backfill copies name into original_name');
    assert.ok(backfill.includes('WHERE original_name IS NULL'), 'backfill only targets rows not yet populated');

    assert.equal(calls.dropped.length, 1);
    assert.equal(calls.dropped[0].table, 'habits');
    assert.equal(calls.dropped[0].column, 'original_name');
  });
});

