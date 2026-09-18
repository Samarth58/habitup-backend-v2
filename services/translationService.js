const { DEFAULT_LANGUAGE, normalizeLanguage } = require('../constants/languages');

/**
 * Comprehensive translation dictionary for all HabitUp notification types.
 *
 * Supported languages:
 * - en: English (Universal Fallback)
 * - hi: Hindi
 * - te: Telugu
 * - ta: Tamil
 * - kn: Kannada
 * - ml: Malayalam
 * - bn: Bengali
 * - mr: Marathi
 * - gu: Gujarati
 */
const NOTIFICATION_TRANSLATIONS = {
  en: {
    // Standard / fallback reminders
    morning_reminder_title: 'Good morning! 🌅',
    morning_reminder_body: 'Start your day by completing your habits.',
    afternoon_reminder_title: 'HabitUp reminder',
    afternoon_reminder_body: 'Take a moment to check your habits.',
    evening_reminder_title: 'Evening check-in 🌙',
    evening_reminder_body: 'See how you did with your habits today.',
    generic_reminder_title: 'HabitUp Reminder',
    generic_reminder_body: 'Check in on your habits today.',

    // Personalized morning
    personalized_morning_zero_title: 'Good morning! 🌅',
    personalized_morning_zero_body: 'No habits scheduled for today. Enjoy your day!',
    personalized_morning_one_title: 'Good morning! 🌅',
    personalized_morning_one_body: "You have 1 habit planned today. You've got this!",
    personalized_morning_multiple_title: 'Good morning! 🌅',
    personalized_morning_multiple_body: "You have {count} habits planned today. Let's get started!",

    // Personalized afternoon
    personalized_afternoon_zero_title: 'HabitUp Check-in',
    personalized_afternoon_zero_body: 'No habits scheduled for today. Enjoy the rest of your day!',
    personalized_afternoon_all_one_title: 'HabitUp Check-in 🎉',
    personalized_afternoon_all_one_body: "Amazing! You've completed all 1 habit today!",
    personalized_afternoon_all_multiple_title: 'HabitUp Check-in 🎉',
    personalized_afternoon_all_multiple_body: "Amazing! You've completed all {count} habits today!",
    personalized_afternoon_none_one_title: 'HabitUp Check-in',
    personalized_afternoon_none_one_body: 'You have 1 habit waiting today. Start with one!',
    personalized_afternoon_none_multiple_title: 'HabitUp Check-in',
    personalized_afternoon_none_multiple_body: 'You have {count} habits waiting today. Start with one!',
    personalized_afternoon_partial_title: 'HabitUp Check-in 💪',
    personalized_afternoon_partial_body: "You've completed {completed} of {total} habits today. Keep going!",

    // Personalized evening
    personalized_evening_zero_title: 'Evening check-in 🌙',
    personalized_evening_zero_body: 'No habits scheduled today. Rest well!',
    personalized_evening_all_one_title: 'Evening check-in 🌙',
    personalized_evening_all_one_body: 'Great job! You completed all 1 habit today! 🎉',
    personalized_evening_all_multiple_title: 'Evening check-in 🌙',
    personalized_evening_all_multiple_body: 'Great job! You completed all {count} habits today! 🎉',
    personalized_evening_one_left_title: 'Evening check-in 🌙',
    personalized_evening_one_left_body: "You're almost there! Just 1 habit left today. 🔥",
    personalized_evening_multiple_left_title: 'Evening check-in 🌙',
    personalized_evening_multiple_left_body: "You still have {count} habits left today. There's still time!",

    // Friend notifications
    friend_request_title: 'New Friend Request',
    friend_request_body: '{name} sent you a friend request.',
    friend_request_accepted_title: 'Friend Request Accepted',
    friend_request_accepted_body: '{name} accepted your friend request.',
    friend_nudge_habit_title: 'Habit Nudge 👋',
    friend_nudge_habit_body: '{name} nudged you to complete your {habitName}',
    friend_nudge_general_title: 'Habit Nudge 👋',
    friend_nudge_general_body: '{name} sent you a habit nudge',

    // Streak / Milestones
    streak_milestone_title: 'Streak Milestone! 🔥',
    streak_milestone_body: '{count} day streak on {habitName}! Keep the momentum going!',
  },

  hi: {
    morning_reminder_title: 'शुभ प्रभात! 🌅',
    morning_reminder_body: 'अपनी आदतों को पूरा करके अपने दिन की शुरुआत करें।',
    afternoon_reminder_title: 'HabitUp रिमाइंडर',
    afternoon_reminder_body: 'अपनी आदतों को देखने के लिए एक पल निकालें।',
    evening_reminder_title: 'शाम का चेक-इन 🌙',
    evening_reminder_body: 'देखें कि आज आपने अपनी आदतों के साथ कैसा प्रदर्शन किया।',
    generic_reminder_title: 'HabitUp रिमाइंडर',
    generic_reminder_body: 'आज अपनी आदतों को पूरा करें।',

    personalized_morning_zero_title: 'शुभ प्रभात! 🌅',
    personalized_morning_zero_body: 'आज के लिए कोई आदत निर्धारित नहीं है। अपने दिन का आनंद लें!',
    personalized_morning_one_title: 'शुभ प्रभात! 🌅',
    personalized_morning_one_body: 'आज आपकी 1 आदत योजनाबद्ध है। आप यह कर सकते हैं!',
    personalized_morning_multiple_title: 'शुभ प्रभात! 🌅',
    personalized_morning_multiple_body: 'आज आपकी {count} आदतें योजनाबद्ध हैं। चलिए शुरू करते हैं!',

    personalized_afternoon_zero_title: 'HabitUp चेक-इन',
    personalized_afternoon_zero_body: 'आज के लिए कोई आदत निर्धारित नहीं है। बाकी दिन का आनंद लें!',
    personalized_afternoon_all_one_title: 'HabitUp चेक-इन 🎉',
    personalized_afternoon_all_one_body: 'अद्भुत! आपने आज अपनी 1 आदत पूरी कर ली है!',
    personalized_afternoon_all_multiple_title: 'HabitUp चेक-इन 🎉',
    personalized_afternoon_all_multiple_body: 'अद्भुत! आपने आज अपनी सभी {count} आदतें पूरी कर ली हैं!',
    personalized_afternoon_none_one_title: 'HabitUp चेक-इन',
    personalized_afternoon_none_one_body: 'आज आपकी 1 आदत बाकी है। शुरुआत करें!',
    personalized_afternoon_none_multiple_title: 'HabitUp चेक-इन',
    personalized_afternoon_none_multiple_body: 'आज आपकी {count} आदतें बाकी हैं। एक से शुरुआत करें!',
    personalized_afternoon_partial_title: 'HabitUp चेक-इन 💪',
    personalized_afternoon_partial_body: 'आपने आज {total} में से {completed} आदतें पूरी कर ली हैं। जारी रखें!',

    personalized_evening_zero_title: 'शाम का चेक-इन 🌙',
    personalized_evening_zero_body: 'आज कोई आदत निर्धारित नहीं थी। अच्छी नींद लें!',
    personalized_evening_all_one_title: 'शाम का चेक-इन 🌙',
    personalized_evening_all_one_body: 'बहुत बढ़िया! आपने आज अपनी 1 आदत पूरी कर ली है! 🎉',
    personalized_evening_all_multiple_title: 'शाम का चेक-इन 🌙',
    personalized_evening_all_multiple_body: 'बहुत बढ़िया! आपने आज अपनी सभी {count} आदतें पूरी कर ली हैं! 🎉',
    personalized_evening_one_left_title: 'शाम का चेक-इन 🌙',
    personalized_evening_one_left_body: 'आप लगभग पहुंच गए हैं! आज सिर्फ 1 आदत बची है। 🔥',
    personalized_evening_multiple_left_title: 'शाम का चेक-इन 🌙',
    personalized_evening_multiple_left_body: 'आज आपकी अभी भी {count} आदतें बची हैं। अभी भी समय है!',

    friend_request_title: 'नया मित्र अनुरोध',
    friend_request_body: '{name} ने आपको मित्र अनुरोध भेजा है।',
    friend_request_accepted_title: 'मित्र अनुरोध स्वीकार किया गया',
    friend_request_accepted_body: '{name} ने आपका मित्र अनुरोध स्वीकार कर लिया है।',
    friend_nudge_habit_title: 'आदत अनुस्मारक 👋',
    friend_nudge_habit_body: '{name} ने आपको {habitName} पूरा करने के लिए याद दिलाया है',
    friend_nudge_general_title: 'आदत अनुस्मारक 👋',
    friend_nudge_general_body: '{name} ने आपको आदत अनुस्मारक भेजा है',

    streak_milestone_title: 'स्ट्रीक उपलब्धि! 🔥',
    streak_milestone_body: '{habitName} पर {count} दिनों की स्ट्रीक! गति बनाए रखें!',
  },

  te: {
    morning_reminder_title: 'శుభోదయం! 🌅',
    morning_reminder_body: 'మీ అలవాట్లను పూర్తి చేయడం ద్వారా మీ రోజును ప్రారంభించండి.',
    afternoon_reminder_title: 'HabitUp రిమైండర్',
    afternoon_reminder_body: 'మీ అలవాట్లను తనిఖీ చేయడానికి ఒక క్షణం కేటాయించండి.',
    evening_reminder_title: 'సాయంత్రం చెక్-ఇన్ 🌙',
    evening_reminder_body: 'ఈ రోజు మీ అలవాట్లను ఎలా పూర్తి చేశారో చూడండి.',
    generic_reminder_title: 'HabitUp రిమైండర్',
    generic_reminder_body: 'ఈ రోజు మీ అలవాట్లను పూర్తి చేయండి.',

    personalized_morning_zero_title: 'శుభోదయం! 🌅',
    personalized_morning_zero_body: 'ఈ రోజుకు అలవాట్లు ఏవీ షెడ్యూల్ చేయబడలేదు. మీ రోజును ఆనందించండి!',
    personalized_morning_one_title: 'శుభోదయం! 🌅',
    personalized_morning_one_body: 'ఈ రోజు మీకు 1 అలవాటు ప్రణాళిక చేయబడింది. మీరు దీన్ని చేయగలరు!',
    personalized_morning_multiple_title: 'శుభోదయం! 🌅',
    personalized_morning_multiple_body: 'ఈ రోజు మీకు {count} అలవాట్లు ప్రణాళిక చేయబడ్డాయి. ప్రారంభిద్దాం!',

    personalized_afternoon_zero_title: 'HabitUp చెక్-ఇన్',
    personalized_afternoon_zero_body: 'ఈ రోజుకు అలవాట్లు ఏవీ లేవు. మిగిలిన రోజును ఆనందించండి!',
    personalized_afternoon_all_one_title: 'HabitUp చెక్-ఇన్ 🎉',
    personalized_afternoon_all_one_body: 'అద్భుతం! మీరు ఈ రోజు మీ 1 అలవాటును పూర్తి చేశారు!',
    personalized_afternoon_all_multiple_title: 'HabitUp చెక్-ఇన్ 🎉',
    personalized_afternoon_all_multiple_body: 'అద్భుతం! మీరు ఈ రోజు అన్ని {count} అలవాట్లను పూర్తి చేశారు!',
    personalized_afternoon_none_one_title: 'HabitUp చెక్-ఇన్',
    personalized_afternoon_none_one_body: 'ఈ రోజు మీకు 1 అలవాటు వేచి ఉంది. ప్రారంభించండి!',
    personalized_afternoon_none_multiple_title: 'HabitUp చెక్-ఇన్',
    personalized_afternoon_none_multiple_body: 'ఈ రోజు మీకు {count} అలవాట్లు వేచి ఉన్నాయి. ఒకదానితో ప్రారంభించండి!',
    personalized_afternoon_partial_title: 'HabitUp చెక్-ఇన్ 💪',
    personalized_afternoon_partial_body: 'మీరు ఈ రోజు {total} లో {completed} అలవాట్లను పూర్తి చేశారు. కొనసాగించండి!',

    personalized_evening_zero_title: 'సాయంత్రం చెక్-ఇన్ 🌙',
    personalized_evening_zero_body: 'ఈ రోజు అలవాట్లేమీ షెడ్యూల్ కాలేదు. విశ్రాంతి తీసుకోండి!',
    personalized_evening_all_one_title: 'సాయంత్రం చెక్-ఇన్ 🌙',
    personalized_evening_all_one_body: 'చాలా బాగుంది! మీరు ఈ రోజు 1 అలవాటును పూర్తి చేశారు! 🎉',
    personalized_evening_all_multiple_title: 'సాయంత్రం చెక్-ఇన్ 🌙',
    personalized_evening_all_multiple_body: 'చాలా బాగుంది! మీరు ఈ రోజు అన్ని {count} అలవాట్లను పూర్తి చేశారు! 🎉',
    personalized_evening_one_left_title: 'సాయంత్రం చెక్-ఇన్ 🌙',
    personalized_evening_one_left_body: 'మీరు దాదాపు పూర్తి చేసేశారు! ఇంకా 1 అలవాటు మాత్రమే మిగిలి ఉంది. 🔥',
    personalized_evening_multiple_left_title: 'సాయంత్రం చెక్-ఇన్ 🌙',
    personalized_evening_multiple_left_body: 'ఈ రోజు ఇంకా {count} అలవాట్లు మిగిలి ఉన్నాయి. ఇంకా సమయం ఉంది!',

    friend_request_title: 'కొత్త స్నేహితుని అభ్యర్థన',
    friend_request_body: '{name} మీకు స్నేహితుని అభ్యర్థనను పంపారు.',
    friend_request_accepted_title: 'స్నేహితుని అభ్యర్థన ఆమోదించబడింది',
    friend_request_accepted_body: '{name} మీ స్నేహితుని అభ్యర్థనను ఆమోదించారు.',
    friend_nudge_habit_title: 'అలవాటు నడ్జ్ 👋',
    friend_nudge_habit_body: 'మీ {habitName} పూర్తి చేయాలని {name} మీకు గుర్తు చేశారు',
    friend_nudge_general_title: 'అలవాటు నడ్జ్ 👋',
    friend_nudge_general_body: '{name} మీకు అలవాటు నడ్జ్ పంపారు',

    streak_milestone_title: 'స్ట్రీక్ మైలురాయి! 🔥',
    streak_milestone_body: '{habitName} పై {count} రోజుల స్ట్రీక్! అలాగే కొనసాగించండి!',
  },

  ta: {
    morning_reminder_title: 'காலை வணக்கம்! 🌅',
    morning_reminder_body: 'உங்கள் பழக்கங்களை முடித்து உங்கள் நாளைத் தொடங்குங்கள்.',
    afternoon_reminder_title: 'HabitUp நினைவூட்டல்',
    afternoon_reminder_body: 'உங்கள் பழக்கங்களைச் சரிபார்க்க சிறிது நேரம் ஒதுக்குங்கள்.',
    evening_reminder_title: 'மாலை நேர ஆய்வு 🌙',
    evening_reminder_body: 'இன்று உங்கள் பழக்கங்களை எவ்வாறு முடித்தீர்கள் என்று பாருங்கள்.',
    generic_reminder_title: 'HabitUp நினைவூட்டல்',
    generic_reminder_body: 'இன்று உங்கள் பழக்கங்களைச் சரிபார்க்கவும்.',

    personalized_morning_zero_title: 'காலை வணக்கம்! 🌅',
    personalized_morning_zero_body: 'இன்று எந்தப் பழக்கமும் திட்டமிடப்படவில்லை. உங்கள் நாளை மகிழ்ச்சியாகக் கழியுங்கள்!',
    personalized_morning_one_title: 'காலை வணக்கம்! 🌅',
    personalized_morning_one_body: 'இன்று உங்களுக்கு 1 பழக்கம் திட்டமிடப்பட்டுள்ளது. உங்களால் முடியும்!',
    personalized_morning_multiple_title: 'காலை வணக்கம்! 🌅',
    personalized_morning_multiple_body: 'இன்று உங்களுக்கு {count} பழக்கங்கள் திட்டமிடப்பட்டுள்ளன. தொடங்குவோம்!',

    personalized_afternoon_zero_title: 'HabitUp ஆய்வு',
    personalized_afternoon_zero_body: 'இன்று பழக்கங்கள் எதுவும் திட்டமிடப்படவில்லை. மீதமுள்ள நாளை மகிழுங்கள்!',
    personalized_afternoon_all_one_title: 'HabitUp ஆய்வு 🎉',
    personalized_afternoon_all_one_body: 'அற்புதம்! இன்று உங்கள் 1 பழக்கத்தையும் முடித்துவிட்டீர்கள்!',
    personalized_afternoon_all_multiple_title: 'HabitUp ஆய்வு 🎉',
    personalized_afternoon_all_multiple_body: 'அற்புதம்! இன்று அனைத்து {count} பழக்கங்களையும் முடித்துவிட்டீர்கள்!',
    personalized_afternoon_none_one_title: 'HabitUp ஆய்வு',
    personalized_afternoon_none_one_body: 'இன்று 1 பழக்கம் காத்திருக்கிறது. ஒன்றைத் தொடங்குங்கள்!',
    personalized_afternoon_none_multiple_title: 'HabitUp ஆய்வு',
    personalized_afternoon_none_multiple_body: 'இன்று {count} பழக்கங்கள் காத்திருக்கின்றன. ஒன்றைத் தொடங்குங்கள்!',
    personalized_afternoon_partial_title: 'HabitUp ஆய்வு 💪',
    personalized_afternoon_partial_body: 'இன்று {total} பழக்கங்களில் {completed} பழக்கங்களை முடித்துள்ளீர்கள். தொடருங்கள்!',

    personalized_evening_zero_title: 'மாலை நேர ஆய்வு 🌙',
    personalized_evening_zero_body: 'இன்று பழக்கங்கள் எதுவும் திட்டமிடப்படவில்லை. நிம்மதியாக உறங்குங்கள்!',
    personalized_evening_all_one_title: 'மாலை நேர ஆய்வு 🌙',
    personalized_evening_all_one_body: 'அருமை! இன்று 1 பழக்கத்தையும் முடித்துவிட்டீர்கள்! 🎉',
    personalized_evening_all_multiple_title: 'மாலை நேர ஆய்வு 🌙',
    personalized_evening_all_multiple_body: 'அருமை! இன்று அனைத்து {count} பழக்கங்களையும் முடித்துவிட்டீர்கள்! 🎉',
    personalized_evening_one_left_title: 'மாலை நேர ஆய்வு 🌙',
    personalized_evening_one_left_body: 'இலக்கை நெருங்கிவிட்டீர்கள்! இன்று 1 பழக்கம் மட்டுமே மீதமுள்ளது. 🔥',
    personalized_evening_multiple_left_title: 'மாலை நேர ஆய்வு 🌙',
    personalized_evening_multiple_left_body: 'இன்று இன்னும் {count} பழக்கங்கள் மீதமுள்ளன. இன்னும் நேரமிருக்கிறது!',

    friend_request_title: 'புதிய நண்பர் கோரிக்கை',
    friend_request_body: '{name} உங்களுக்கு நண்பர் கோரிக்கை அனுப்பியுள்ளார்.',
    friend_request_accepted_title: 'நண்பர் கோரிக்கை ஏற்கப்பட்டது',
    friend_request_accepted_body: '{name} உங்கள் நண்பர் கோரிக்கையை ஏற்றுக்கொண்டார்.',
    friend_nudge_habit_title: 'பழக்க நினைவூட்டல் 👋',
    friend_nudge_habit_body: '{habitName} பழக்கத்தை முடிக்க {name} உங்களுக்கு நினைவூட்டினார்',
    friend_nudge_general_title: 'பழக்க நினைவூட்டல் 👋',
    friend_nudge_general_body: '{name} உங்களுக்கு பழக்க நினைவூட்டல் அனுப்பியுள்ளார்',

    streak_milestone_title: 'தொடர் மைல்கல்! 🔥',
    streak_milestone_body: '{habitName} இல் {count} நாட்கள் தொடர் சாதனை! உற்சாகத்தைத் தொடருங்கள்!',
  },

  kn: {
    morning_reminder_title: 'ಶುಭೋದಯ! 🌅',
    morning_reminder_body: 'ನಿಮ್ಮ ಅಭ್ಯಾಸಗಳನ್ನು ಪೂರ್ಣಗೊಳಿಸುವ ಮೂಲಕ ನಿಮ್ಮ ದಿನವನ್ನು ಪ್ರಾರಂಭಿಸಿ.',
    afternoon_reminder_title: 'HabitUp ಜ್ಞಾಪನೆ',
    afternoon_reminder_body: 'ನಿಮ್ಮ ಅಭ್ಯಾಸಗಳನ್ನು ಪರಿಶೀಲಿಸಲು ಒಂದು ಕ್ಷಣ ತೆಗೆದುಕೊಳ್ಳಿ.',
    evening_reminder_title: 'ಸಂಜೆಯ ಪರಿಶೀಲನೆ 🌙',
    evening_reminder_body: 'ಇಂದು ನಿಮ್ಮ ಅಭ್ಯಾಸಗಳೊಂದಿಗೆ ನೀವು ಹೇಗೆ ಮಾಡಿದ್ದೀರಿ ಎಂದು ನೋಡಿ.',
    generic_reminder_title: 'HabitUp ಜ್ಞಾಪನೆ',
    generic_reminder_body: 'ಇಂದು ನಿಮ್ಮ ಅಭ್ಯಾಸಗಳನ್ನು ಪರಿಶೀಲಿಸಿ.',

    personalized_morning_zero_title: 'ಶುಭೋದಯ! 🌅',
    personalized_morning_zero_body: 'ಇಂದಿಗೆ ಯಾವುದೇ ಅಭ್ಯಾಸಗಳು ನಿಗದಿಯಾಗಿಲ್ಲ. ನಿಮ್ಮ ದಿನವನ್ನು ಆನಂದಿಸಿ!',
    personalized_morning_one_title: 'ಶುಭೋದಯ! 🌅',
    personalized_morning_one_body: 'ಇಂದು ನಿಮಗೆ 1 ಅಭ್ಯಾಸ ಯೋಜಿಸಲಾಗಿದೆ. ನೀವು ಇದನ್ನು ಸಾಧಿಸಬಹುದು!',
    personalized_morning_multiple_title: 'ಶುಭೋದಯ! 🌅',
    personalized_morning_multiple_body: 'ಇಂದು ನಿಮಗೆ {count} ಅಭ್ಯಾಸಗಳು ಯೋಜಿಸಲಾಗಿದೆ. ಪ್ರಾರಂಭಿಸೋಣ!',

    personalized_afternoon_zero_title: 'HabitUp ಚೆಕ್-ಇನ್',
    personalized_afternoon_zero_body: 'ಇಂದಿಗೆ ಯಾವುದೇ ಅಭ್ಯಾಸಗಳು ನಿಗದಿಯಾಗಿಲ್ಲ. ಉಳಿದ ದಿನವನ್ನು ಆನಂದಿಸಿ!',
    personalized_afternoon_all_one_title: 'HabitUp ಚೆಕ್-ಇನ್ 🎉',
    personalized_afternoon_all_one_body: 'ಅದ್ಭುತ! ನೀವು ಇಂದು ನಿಮ್ಮ 1 ಅಭ್ಯಾಸವನ್ನು ಪೂರ್ಣಗೊಳಿಸಿದ್ದೀರಿ!',
    personalized_afternoon_all_multiple_title: 'HabitUp ಚೆಕ್-ಇನ್ 🎉',
    personalized_afternoon_all_multiple_body: 'ಅದ್ಭುತ! ನೀವು ಇಂದು ಎಲ್ಲಾ {count} ಅಭ್ಯಾಸಗಳನ್ನು ಪೂರ್ಣಗೊಳಿಸಿದ್ದೀರಿ!',
    personalized_afternoon_none_one_title: 'HabitUp ಚೆಕ್-ಇನ್',
    personalized_afternoon_none_one_body: 'ಇಂದು 1 ಅಭ್ಯಾಸ ಬಾಕಿ ಉಳಿದಿದೆ. ಪ್ರಾರಂಭಿಸಿ!',
    personalized_afternoon_none_multiple_title: 'HabitUp ಚೆಕ್-ಇನ್',
    personalized_afternoon_none_multiple_body: 'ಇಂದು {count} ಅಭ್ಯಾಸಗಳು ಬಾಕಿ ಉಳಿದಿವೆ. ಒಂದರಿಂದ ಪ್ರಾರಂಭಿಸಿ!',
    personalized_afternoon_partial_title: 'HabitUp ಚೆಕ್-ಇನ್ 💪',
    personalized_afternoon_partial_body: 'ನೀವು ಇಂದು {total} ರಲ್ಲಿ {completed} ಅಭ್ಯಾಸಗಳನ್ನು ಪೂರ್ಣಗೊಳಿಸಿದ್ದೀರಿ. ಮುಂದುವರಿಸಿ!',

    personalized_evening_zero_title: 'ಸಂಜೆಯ ಪರಿಶೀಲನೆ 🌙',
    personalized_evening_zero_body: 'ಇಂದು ಯಾವುದೇ ಅಭ್ಯಾಸಗಳು ನಿಗದಿಯಾಗಿರಲಿಲ್ಲ. ಚೆನ್ನಾಗಿ ವಿಶ್ರಾಂತಿ ಪಡೆಯಿರಿ!',
    personalized_evening_all_one_title: 'ಸಂಜೆಯ ಪರಿಶೀಲನೆ 🌙',
    personalized_evening_all_one_body: 'ಉತ್ತಮ ಕೆಲಸ! ನೀವು ಇಂದು 1 ಅಭ್ಯಾಸವನ್ನು ಪೂರ್ಣಗೊಳಿಸಿದ್ದೀರಿ! 🎉',
    personalized_evening_all_multiple_title: 'ಸಂಜೆಯ ಪರಿಶೀಲನೆ 🌙',
    personalized_evening_all_multiple_body: 'ಉತ್ತಮ ಕೆಲಸ! ನೀವು ಇಂದು ಎಲ್ಲಾ {count} ಅಭ್ಯಾಸಗಳನ್ನು ಪೂರ್ಣಗೊಳಿಸಿದ್ದೀರಿ! 🎉',
    personalized_evening_one_left_title: 'ಸಂಜೆಯ ಪರಿಶೀಲನೆ 🌙',
    personalized_evening_one_left_body: 'ನೀವು ಗುರಿಗೆ ಹತ್ತಿರವಾಗಿದ್ದೀರಿ! ಇಂದು ಕೇವಲ 1 ಅಭ್ಯಾಸ ಉಳಿದಿದೆ. 🔥',
    personalized_evening_multiple_left_title: 'ಸಂಜೆಯ ಪರಿಶೀಲನೆ 🌙',
    personalized_evening_multiple_left_body: 'ಇಂದು ಇನ್ನೂ {count} ಅಭ್ಯಾಸಗಳು ಬಾಕಿ ಇವೆ. ಇನ್ನೂ ಸಮಯವಿದೆ!',

    friend_request_title: 'ಹೊಸ ಸ್ನೇಹಿತರ ವಿನಂತಿ',
    friend_request_body: '{name} ನಿಮಗೆ ಸ್ನೇಹಿತರ ವಿನಂತಿಯನ್ನು ಕಳುಹಿಸಿದ್ದಾರೆ.',
    friend_request_accepted_title: 'ಸ್ನೇಹಿತರ ವಿನಂತಿ ಸ್ವೀಕರಿಸಲಾಗಿದೆ',
    friend_request_accepted_body: '{name} ನಿಮ್ಮ ಸ್ನೇಹಿತರ ವಿನಂತಿಯನ್ನು ಸ್ವೀಕರಿಸಿದ್ದಾರೆ.',
    friend_nudge_habit_title: 'ಅಭ್ಯಾಸ ನೆನಪಿಸುವಿಕೆ 👋',
    friend_nudge_habit_body: '{name} ನಿಮ್ಮನ್ನು {habitName} ಪೂರ್ಣಗೊಳಿಸಲು ನೆನಪಿಸಿದ್ದಾರೆ',
    friend_nudge_general_title: 'ಅಭ್ಯಾಸ ನೆನಪಿಸುವಿಕೆ 👋',
    friend_nudge_general_body: '{name} ನಿಮಗೆ ಅಭ್ಯಾಸ ನೆನಪಿಸುವಿಕೆಯನ್ನು ಕಳುಹಿಸಿದ್ದಾರೆ',

    streak_milestone_title: 'ಸ್ಟ್ರೀಕ್ ಮೈಲಿಗಲ್ಲು! 🔥',
    streak_milestone_body: '{habitName} ನಲ್ಲಿ {count} ದಿನಗಳ ಸ್ಟ್ರೀಕ್! ಮುಂದುವರಿಸಿ!',
  },

  ml: {
    morning_reminder_title: 'സുപ്രഭാതം! 🌅',
    morning_reminder_body: 'നിങ്ങളുടെ ശീലങ്ങൾ പൂർത്തിയാക്കി ദിവസം ആരംഭിക്കുക.',
    afternoon_reminder_title: 'HabitUp ഓർമ്മപ്പെടുത്തൽ',
    afternoon_reminder_body: 'നിങ്ങളുടെ ശീലങ്ങൾ പരിശോധിക്കാൻ ഒരു നിമിഷം ചെലവഴിക്കുക.',
    evening_reminder_title: 'സായാഹ്ന ചെക്ക്-ഇൻ 🌙',
    evening_reminder_body: 'ഇന്ന് നിങ്ങളുടെ ശീലങ്ങൾ എങ്ങനെയായിരുന്നുവെന്ന് കാണുക.',
    generic_reminder_title: 'HabitUp ഓർമ്മപ്പെടുത്തൽ',
    generic_reminder_body: 'ഇന്ന് നിങ്ങളുടെ ശീലങ്ങൾ പരിശോധിക്കുക.',

    personalized_morning_zero_title: 'സുപ്രഭാതം! 🌅',
    personalized_morning_zero_body: 'ഇന്നത്തേക്ക് ശീലങ്ങളൊന്നും ഷെഡ്യൂൾ ചെയ്തിട്ടില്ല. നിങ്ങളുടെ ദിവസം ആസ്വദിക്കൂ!',
    personalized_morning_one_title: 'സുപ്രഭാതം! 🌅',
    personalized_morning_one_body: 'ഇന്ന് നിങ്ങൾക്ക് 1 ശീലം ആസൂത്രണം ചെയ്തിട്ടുണ്ട്. നിങ്ങൾക്ക് ഇത് ചെയ്യാൻ കഴിയും!',
    personalized_morning_multiple_title: 'സുപ്രഭാതം! 🌅',
    personalized_morning_multiple_body: 'ഇന്ന് നിങ്ങൾക്ക് {count} ശീലങ്ങൾ ആസൂത്രണം ചെയ്തിട്ടുണ്ട്. നമുക്ക് ആരംഭിക്കാം!',

    personalized_afternoon_zero_title: 'HabitUp ചെക്ക്-ഇൻ',
    personalized_afternoon_zero_body: 'ഇന്നത്തേക്ക് ശീലങ്ങളൊന്നുമില്ല. ബാക്കി ദിവസം ആസ്വദിക്കൂ!',
    personalized_afternoon_all_one_title: 'HabitUp ചെക്ക്-ഇൻ 🎉',
    personalized_afternoon_all_one_body: 'അത്ഭുതകരം! ഇന്ന് നിങ്ങൾ നിങ്ങളുടെ 1 ശീലവും പൂർത്തിയാക്കി!',
    personalized_afternoon_all_multiple_title: 'HabitUp ചെക്ക്-ഇൻ 🎉',
    personalized_afternoon_all_multiple_body: 'അത്ഭുതകരം! ഇന്ന് നിങ്ങൾ എല്ലാ {count} ശീലങ്ങളും പൂർത്തിയാക്കി!',
    personalized_afternoon_none_one_title: 'HabitUp ചെക്ക്-ഇൻ',
    personalized_afternoon_none_one_body: 'ഇന്ന് 1 ശീലം ബാക്കിയുണ്ട്. ഒന്നിൽ നിന്ന് ആരംഭിക്കൂ!',
    personalized_afternoon_none_multiple_title: 'HabitUp ചെക്ക്-ഇൻ',
    personalized_afternoon_none_multiple_body: 'ഇന്ന് {count} ശീലങ്ങൾ ബാക്കിയുണ്ട്. ഒന്നിൽ നിന്ന് ആരംഭിക്കൂ!',
    personalized_afternoon_partial_title: 'HabitUp ചെക്ക്-ഇൻ 💪',
    personalized_afternoon_partial_body: 'ഇന്ന് {total} ൽ {completed} ശീലങ്ങൾ പൂർത്തിയാക്കി. മുന്നോട്ട് പോകുക!',

    personalized_evening_zero_title: 'സായാഹ്ന ചെക്ക്-ഇൻ 🌙',
    personalized_evening_zero_body: 'ഇന്ന് ശീലങ്ങളൊന്നും ഷെഡ്യൂൾ ചെയ്തിരുന്നില്ല. നന്നായി വിശ്രമിക്കൂ!',
    personalized_evening_all_one_title: 'സായാഹ്ന ചെക്ക്-ഇൻ 🌙',
    personalized_evening_all_one_body: 'മികച്ച പ്രവർത്തനം! ഇന്ന് നിങ്ങൾ 1 ശീലവും പൂർത്തിയാക്കി! 🎉',
    personalized_evening_all_multiple_title: 'സായാഹ്ന ചെക്ക്-ഇൻ 🌙',
    personalized_evening_all_multiple_body: 'മികച്ച പ്രവർത്തനം! ഇന്ന് നിങ്ങൾ എല്ലാ {count} ശീലങ്ങളും പൂർത്തിയാക്കി! 🎉',
    personalized_evening_one_left_title: 'സായാഹ്ന ചെക്ക്-ഇൻ 🌙',
    personalized_evening_one_left_body: 'നിങ്ങൾ ലക്ഷ്യത്തിനടുത്തെത്തി! ഇന്ന് 1 ശീലം മാത്രം ബാക്കി. 🔥',
    personalized_evening_multiple_left_title: 'സായാഹ്ന ചെക്ക്-ഇൻ 🌙',
    personalized_evening_multiple_left_body: 'ഇന്ന് ഇനിയും {count} ശീലങ്ങൾ ബാക്കിയുണ്ട്. ഇനിയും സമയമുണ്ട്!',

    friend_request_title: 'പുതിയ സൗഹൃദ അഭ്യർത്ഥന',
    friend_request_body: '{name} നിങ്ങൾക്ക് ഒരു സൗഹൃദ അഭ്യർത്ഥന അയച്ചു.',
    friend_request_accepted_title: 'സൗഹൃദ അഭ്യർത്ഥന സ്വീകരിച്ചു',
    friend_request_accepted_body: '{name} നിങ്ങളുടെ സൗഹൃദ അഭ്യർത്ഥന സ്വീകരിച്ചു.',
    friend_nudge_habit_title: 'ശീല ഓർമ്മപ്പെടുത്തൽ 👋',
    friend_nudge_habit_body: '{habitName} പൂർത്തിയാക്കാൻ {name} നിങ്ങളെ ഓർമ്മിപ്പിച്ചു',
    friend_nudge_general_title: 'ശീല ഓർമ്മപ്പെടുത്തൽ 👋',
    friend_nudge_general_body: '{name} നിങ്ങൾക്ക് ഒരു ശീല ഓർമ്മപ്പെടുത്തൽ അയച്ചു',

    streak_milestone_title: 'സ്ട്രീക്ക് നാഴികക്കല്ല്! 🔥',
    streak_milestone_body: '{habitName} ൽ {count} ദിവസത്തെ സ്ട്രീക്ക്! തുടരുക!',
  },

  bn: {
    morning_reminder_title: 'সুপ্রভাত! 🌅',
    morning_reminder_body: 'আপনার অভ্যাসগুলি সম্পূর্ণ করে দিনটি শুরু করুন।',
    afternoon_reminder_title: 'HabitUp রিমাইন্ডার',
    afternoon_reminder_body: 'আপনার অভ্যাসগুলি পরীক্ষা করতে একটু সময় নিন।',
    evening_reminder_title: 'সান্ধ্যকালীন চেক-ইন 🌙',
    evening_reminder_body: 'আজ আপনি আপনার অভ্যাসের সাথে কেমন করেছেন তা দেখুন।',
    generic_reminder_title: 'HabitUp রিমাইন্ডার',
    generic_reminder_body: 'আজ আপনার অভ্যাসগুলি সম্পূর্ণ করুন।',

    personalized_morning_zero_title: 'সুপ্রভাত! 🌅',
    personalized_morning_zero_body: 'আজকের জন্য কোন অভ্যাস নির্ধারিত নেই। দিনটি উপভোগ করুন!',
    personalized_morning_one_title: 'সুপ্রভাত! 🌅',
    personalized_morning_one_body: 'আজ আপনার ১টি অভ্যাস পরিকল্পিত আছে। আপনি এটি করতে পারেন!',
    personalized_morning_multiple_title: 'সুপ্রভাত! 🌅',
    personalized_morning_multiple_body: 'আজ আপনার {count}টি অভ্যাস পরিকল্পিত আছে। চলুন শুরু করি!',

    personalized_afternoon_zero_title: 'HabitUp চেক-ইন',
    personalized_afternoon_zero_body: 'আজ কোন অভ্যাস নির্ধারিত নেই। বাকি দিনটি উপভোগ করুন!',
    personalized_afternoon_all_one_title: 'HabitUp চেক-ইন 🎉',
    personalized_afternoon_all_one_body: 'অসাধারণ! আপনি আজ আপনার ১টি অভ্যাস সম্পূর্ণ করেছেন!',
    personalized_afternoon_all_multiple_title: 'HabitUp চেক-ইন 🎉',
    personalized_afternoon_all_multiple_body: 'অসাধারণ! আপনি আজ সব {count}টি অভ্যাস সম্পূর্ণ করেছেন!',
    personalized_afternoon_none_one_title: 'HabitUp চেক-ইন',
    personalized_afternoon_none_one_body: 'আজ ১টি অভ্যাস বাকি আছে। শুরু করুন!',
    personalized_afternoon_none_multiple_title: 'HabitUp চেক-ইন',
    personalized_afternoon_none_multiple_body: 'আজ {count}টি অভ্যাস বাকি আছে। একটি দিয়ে শুরু করুন!',
    personalized_afternoon_partial_title: 'HabitUp চেক-ইন 💪',
    personalized_afternoon_partial_body: 'আপনি আজ {total}টির মধ্যে {completed}টি অভ্যাস সম্পূর্ণ করেছেন। চালিয়ে যান!',

    personalized_evening_zero_title: 'সান্ধ্যকালীন চেক-ইন 🌙',
    personalized_evening_zero_body: 'আজ কোন অভ্যাস নির্ধারিত ছিল না। শান্তিতে বিশ্রাম নিন!',
    personalized_evening_all_one_title: 'সান্ধ্যকালীন চেক-ইন 🌙',
    personalized_evening_all_one_body: 'দারুণ কাজ! আপনি আজ ১টি অভ্যাস সম্পূর্ণ করেছেন! 🎉',
    personalized_evening_all_multiple_title: 'সান্ধ্যকালীন চেক-ইন 🌙',
    personalized_evening_all_multiple_body: 'দারুণ কাজ! আপনি আজ সব {count}টি অভ্যাস সম্পূর্ণ করেছেন! 🎉',
    personalized_evening_one_left_title: 'সান্ধ্যকালীন চেক-ইন 🌙',
    personalized_evening_one_left_body: 'আপনি প্রায় লক্ষ্যে পৌঁছে গেছেন! আজ মাত্র ১টি অভ্যাস বাকি আছে। 🔥',
    personalized_evening_multiple_left_title: 'সান্ধ্যকালীন চেক-ইন 🌙',
    personalized_evening_multiple_left_body: 'আজ এখনও {count}টি অভ্যাস বাকি আছে। এখনও সময় আছে!',

    friend_request_title: 'নতুন বন্ধুত্বের অনুরোধ',
    friend_request_body: '{name} আপনাকে একটি বন্ধুত্বের অনুরোধ পাঠিয়েছেন।',
    friend_request_accepted_title: 'বন্ধুত্বের অনুরোধ গৃহীত হয়েছে',
    friend_request_accepted_body: '{name} আপনার বন্ধুত্বের অনুরোধ গ্রহণ করেছেন।',
    friend_nudge_habit_title: 'অভ্যাস তাগিদ 👋',
    friend_nudge_habit_body: '{name} আপনাকে {habitName} সম্পূর্ণ করার জন্য মনে করিয়ে দিয়েছেন',
    friend_nudge_general_title: 'অভ্যাস তাগিদ 👋',
    friend_nudge_general_body: '{name} আপনাকে একটি অভ্যাস তাগিদ পাঠিয়েছেন',

    streak_milestone_title: 'স্ট্রিক মাইলফলক! 🔥',
    streak_milestone_body: '{habitName}-এ {count} দিনের স্ট্রিক! গতি বজায় রাখুন!',
  },

  mr: {
    morning_reminder_title: 'शुभ सकाळ! 🌅',
    morning_reminder_body: 'तुमच्या सवयी पूर्ण करून दिवसाची सुरुवात करा.',
    afternoon_reminder_title: 'HabitUp स्मरणपत्र',
    afternoon_reminder_body: 'तुमच्या सवयी तपासण्यासाठी थोडा वेळ काढा.',
    evening_reminder_title: 'संध्याकाळचे चेक-इन 🌙',
    evening_reminder_body: 'आज तुम्ही तुमच्या सवयी कशा पूर्ण केल्या ते पहा.',
    generic_reminder_title: 'HabitUp स्मरणपत्र',
    generic_reminder_body: 'आज तुमच्या सवयी पूर्ण करा.',

    personalized_morning_zero_title: 'शुभ सकाळ! 🌅',
    personalized_morning_zero_body: 'आजसाठी कोणतीही सवय नियोजित नाही. दिवसाचा आनंद घ्या!',
    personalized_morning_one_title: 'शुभ सकाळ! 🌅',
    personalized_morning_one_body: 'आज तुमची १ सवय नियोजित आहे. तुम्ही हे करू शकता!',
    personalized_morning_multiple_title: 'शुभ सकाळ! 🌅',
    personalized_morning_multiple_body: 'आज तुमच्या {count} सवयी नियोजित आहेत. चला सुरुवात करूया!',

    personalized_afternoon_zero_title: 'HabitUp चेक-इन',
    personalized_afternoon_zero_body: 'आज कोणतीही सवय नियोजित नाही. उर्वरित दिवसाचा आनंद घ्या!',
    personalized_afternoon_all_one_title: 'HabitUp चेक-इन 🎉',
    personalized_afternoon_all_one_body: 'अद्भुत! तुम्ही आज तुमची १ सवय पूर्ण केली आहे!',
    personalized_afternoon_all_multiple_title: 'HabitUp चेक-इन 🎉',
    personalized_afternoon_all_multiple_body: 'अद्भुत! तुम्ही आज सर्व {count} सवयी पूर्ण केल्या आहेत!',
    personalized_afternoon_none_one_title: 'HabitUp चेक-इन',
    personalized_afternoon_none_one_body: 'आज १ सवय शिल्लक आहे. सुरुवात करा!',
    personalized_afternoon_none_multiple_title: 'HabitUp चेक-इन',
    personalized_afternoon_none_multiple_body: 'आज {count} सवयी शिल्लक आहेत. एकापासून सुरुवात करा!',
    personalized_afternoon_partial_title: 'HabitUp चेक-इन 💪',
    personalized_afternoon_partial_body: 'तुम्ही आज {total} पैकी {completed} सवयी पूर्ण केल्या आहेत. चालू ठेवा!',

    personalized_evening_zero_title: 'संध्याकाळचे चेक-इन 🌙',
    personalized_evening_zero_body: 'आज कोणतीही सवय नियोजित नव्हती. शांत झोप घ्या!',
    personalized_evening_all_one_title: 'संध्याकाळचे चेक-इन 🌙',
    personalized_evening_all_one_body: 'उत्तम काम! तुम्ही आज १ सवय पूर्ण केली आहे! 🎉',
    personalized_evening_all_multiple_title: 'संध्याकाळचे चेक-इन 🌙',
    personalized_evening_all_multiple_body: 'उत्तम काम! तुम्ही आज सर्व {count} सवयी पूर्ण केल्या आहेत! 🎉',
    personalized_evening_one_left_title: 'संध्याकाळचे चेक-इन 🌙',
    personalized_evening_one_left_body: 'तुम्ही उद्दिष्टाजवळ आहात! आज फक्त १ सवय शिल्लक आहे. 🔥',
    personalized_evening_multiple_left_title: 'संध्याकाळचे चेक-इन 🌙',
    personalized_evening_multiple_left_body: 'आज अजूनही {count} सवयी शिल्लक आहेत. अजूनही वेळ आहे!',

    friend_request_title: 'नवीन मित्र विनंती',
    friend_request_body: '{name} ने तुम्हाला मित्र विनंती पाठवली आहे.',
    friend_request_accepted_title: 'मित्र विनंती स्वीकारली',
    friend_request_accepted_body: '{name} ने तुमची मित्र विनंती स्वीकारली आहे.',
    friend_nudge_habit_title: 'सवय आठवण 👋',
    friend_nudge_habit_body: '{name} ने तुम्हाला {habitName} पूर्ण करण्याची आठवण करून दिली आहे',
    friend_nudge_general_title: 'सवय आठवण 👋',
    friend_nudge_general_body: '{name} ने तुम्हाला सवय आठवण पाठवली आहे',

    streak_milestone_title: 'स्ट्रीक टप्पा! 🔥',
    streak_milestone_body: '{habitName} वर {count} दिवसांची स्ट्रीक! गती कायम ठेवा!',
  },

  gu: {
    morning_reminder_title: 'સુપ્રભાત! 🌅',
    morning_reminder_body: 'તમારી ટેવો પૂર્ણ કરીને તમારા દિવસની શરૂઆત કરો.',
    afternoon_reminder_title: 'HabitUp રીમાઇન્ડર',
    afternoon_reminder_body: 'તમારી ટેવો તપાસવા માટે થોડો સમય કાઢો.',
    evening_reminder_title: 'સાંજનું ચેક-ઇન 🌙',
    evening_reminder_body: 'જુઓ કે આજે તમે તમારી ટેવો સાથે કેવું પ્રદર્શન કર્યું.',
    generic_reminder_title: 'HabitUp રીમાઇન્ડર',
    generic_reminder_body: 'આજે તમારી ટેવો પૂર્ણ કરો.',

    personalized_morning_zero_title: 'સુપ્રભાત! 🌅',
    personalized_morning_zero_body: 'આજના માટે કોઈ ટેવ નિર્ધારિત નથી. તમારા દિવસનો આનંદ માણો!',
    personalized_morning_one_title: 'સુપ્રભાત! 🌅',
    personalized_morning_one_body: 'આજે તમારી ૧ ટેવ આયોજિત છે. તમે આ કરી શકો છો!',
    personalized_morning_multiple_title: 'સુપ્રભાત! 🌅',
    personalized_morning_multiple_body: 'આજે તમારી {count} ટેવો આયોજિત છે. ચાલો શરૂ કરીએ!',

    personalized_afternoon_zero_title: 'HabitUp ચેક-ઇન',
    personalized_afternoon_zero_body: 'આજે કોઈ ટેવ નિર્ધારિત નથી. બાકીના દિવસનો આનંદ માણો!',
    personalized_afternoon_all_one_title: 'HabitUp ચેક-ઇન 🎉',
    personalized_afternoon_all_one_body: 'અદ્ભુત! તમે આજે તમારી ૧ ટેવ પૂર્ણ કરી છે!',
    personalized_afternoon_all_multiple_title: 'HabitUp ચેક-ઇન 🎉',
    personalized_afternoon_all_multiple_body: 'અદ્ભુત! તમે આજે બધી {count} ટેવો પૂર્ણ કરી છે!',
    personalized_afternoon_none_one_title: 'HabitUp ચેક-ઇન',
    personalized_afternoon_none_one_body: 'આજે ૧ ટેવ બાકી છે. શરૂઆત કરો!',
    personalized_afternoon_none_multiple_title: 'HabitUp ચેક-ઇન',
    personalized_afternoon_none_multiple_body: 'આજે {count} ટેવો બાકી છે. એકથી શરૂઆત કરો!',
    personalized_afternoon_partial_title: 'HabitUp ચેક-ઇન 💪',
    personalized_afternoon_partial_body: 'તમે આજે {total} માંથી {completed} ટેવો પૂર્ણ કરી છે. ચાલુ રાખો!',

    personalized_evening_zero_title: 'સાંજનું ચેક-ઇન 🌙',
    personalized_evening_zero_body: 'આજે કોઈ ટેવ નિર્ધારિત નહોતી. સારી ઊંઘ લો!',
    personalized_evening_all_one_title: 'સાંજનું ચેક-ઇન 🌙',
    personalized_evening_all_one_body: 'ખૂબ સરસ! તમે આજે ૧ ટેવ પૂર્ણ કરી છે! 🎉',
    personalized_evening_all_multiple_title: 'સાંજનું ચેક-ઇન 🌙',
    personalized_evening_all_multiple_body: 'ખૂબ સરસ! તમે આજે બધી {count} ટેવો પૂર્ણ કરી છે! 🎉',
    personalized_evening_one_left_title: 'સાંજનું ચેક-ઇન 🌙',
    personalized_evening_one_left_body: 'તમે લક્ષ્યની ખૂબ નજીક છો! આજે ફક્ત ૧ ટેવ બાકી છે. 🔥',
    personalized_evening_multiple_left_title: 'સાંજનું ચેક-ઇન 🌙',
    personalized_evening_multiple_left_body: 'આજે હજી પણ {count} ટેવો બાકી છે. હજી પણ સમય છે!',

    friend_request_title: 'નવી મિત્ર વિનંતી',
    friend_request_body: '{name} એ તમને મિત્ર વિનંતી મોકલી છે.',
    friend_request_accepted_title: 'મિત્ર વિનંતી સ્વીકારાઈ',
    friend_request_accepted_body: '{name} એ તમારી મિત્ર વિનંતી સ્વીકારી લીધી છે.',
    friend_nudge_habit_title: 'ટેવ યાદ અપાવનાર 👋',
    friend_nudge_habit_body: '{name} એ તમને {habitName} પૂર્ણ કરવા માટે યાદ અપાવ્યું છે',
    friend_nudge_general_title: 'ટેવ યાદ અપાવનાર 👋',
    friend_nudge_general_body: '{name} એ તમને ટેવ યાદ અપાવનાર મોકલ્યું છે',

    streak_milestone_title: 'સ્ટ્રીક સીમાચિહ્ન! 🔥',
    streak_milestone_body: '{habitName} પર {count} દિવસની સ્ટ્રીક! વેગ ચાલુ રાખો!',
  },
};

/**
 * Safely replaces `{param}` tokens in a template string with provided values.
 * Preserves user-generated content verbatim without modification.
 *
 * @param {string} template
 * @param {Record<string, any>} [params={}]
 * @returns {string}
 */
function interpolate(template, params = {}) {
  if (typeof template !== 'string') return '';
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return params[key] !== undefined && params[key] !== null ? String(params[key]) : match;
  });
}

/**
 * Retrieves a translated string by key for a specific language.
 * Always falls back safely to English ('en') if key or language is missing.
 *
 * @param {string} key - Translation key
 * @param {string} [lang=DEFAULT_LANGUAGE] - Language code
 * @param {Record<string, any>} [params={}] - Interpolation parameters
 * @returns {string} Translated and interpolated string
 */
function translate(key, lang = DEFAULT_LANGUAGE, params = {}) {
  const normalizedLang = normalizeLanguage(lang);
  const langDict = NOTIFICATION_TRANSLATIONS[normalizedLang] || NOTIFICATION_TRANSLATIONS[DEFAULT_LANGUAGE];
  const template = langDict[key] || NOTIFICATION_TRANSLATIONS[DEFAULT_LANGUAGE][key] || '';
  return interpolate(template, params);
}

/**
 * Convenience helper to retrieve both title and body translations for a given notification key prefix.
 *
 * @param {string} prefix - Key prefix (e.g. 'friend_request', 'personalized_morning_one')
 * @param {string} [lang=DEFAULT_LANGUAGE] - Language code
 * @param {Record<string, any>} [params={}] - Interpolation parameters
 * @returns {{ title: string, body: string }}
 */
function getLocalizedNotification(prefix, lang = DEFAULT_LANGUAGE, params = {}) {
  const title = translate(`${prefix}_title`, lang, params);
  const body = translate(`${prefix}_body`, lang, params);
  return { title, body };
}

module.exports = {
  NOTIFICATION_TRANSLATIONS,
  interpolate,
  translate,
  getLocalizedNotification,
};
