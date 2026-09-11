/**
 * High-engagement, curated HabitUp notification copy pool.
 *
 * Structure: Short Hook + Short Supporting Line
 * Personalities:
 * - Morning (10:30 AM): Energy, curiosity, habit stacking, routine, optimism, starting.
 * - Afternoon (03:30 PM): Playful interruption, streak check, half-day checkpoint, momentum.
 * - Evening (07:30 PM): One final win, streak protection, reflection, comeback spirit, satisfaction.
 *
 * Categories represented:
 * motivation, encouragement, habit_tip, streak, goal, progress, comeback, challenge, announcement
 */

const MORNING_TEMPLATES = [
  {
    title: 'Coffee first. Habits next. ☕',
    body: 'Fair deal? Take 2 minutes for your priority habit before the day gets busy.',
    category: 'habit_tip',
  },
  {
    title: 'Your future self called. 📞',
    body: 'It wants today\'s checklist started. Pick the easiest habit and get it done.',
    category: 'motivation',
  },
  {
    title: 'Today\'s version of you has one job: 🚀',
    body: 'Start. Knock out your first habit and build instant momentum.',
    category: 'encouragement',
  },
  {
    title: 'Quick morning hack 💡',
    body: 'Habit stack it: attach your new habit to a routine you already do daily.',
    category: 'habit_tip',
  },
  {
    title: 'Morning momentum unlocked ✨',
    body: 'One small win right now sets the tone for your whole day.',
    category: 'progress',
  },
  {
    title: 'Before your schedule fills up 🗓️',
    body: 'Claim your personal time first. Check in with your morning habit.',
    category: 'goal',
  },
  {
    title: 'The secret to big goals? 🎯',
    body: 'Tiny daily reps. Open HabitUp and make today count.',
    category: 'motivation',
  },
  {
    title: 'Fresh day, zero excuses 🌱',
    body: 'Everything resets today. Start strong with habit #1.',
    category: 'comeback',
  },
  {
    title: 'Two-minute rule in action ⏱️',
    body: 'If a habit takes less than 2 minutes, do it right now before opening other apps.',
    category: 'habit_tip',
  },
  {
    title: 'Ready for today\'s first checkmark? ✅',
    body: 'Your habits are waiting. Tap in and get that first dopamine hit.',
    category: 'encouragement',
  },
  {
    title: 'Your morning advantage 🌅',
    body: 'Win the morning, win the day. Which habit are you knocking out first?',
    category: 'challenge',
  },
  {
    title: 'Micro-step challenge 👣',
    body: 'Don\'t think about the whole routine. Just do the first 60 seconds.',
    category: 'challenge',
  },
  {
    title: 'Plot your day\'s biggest win 🏆',
    body: 'Focus on the single habit that matters most today.',
    category: 'goal',
  },
  {
    title: 'Morning energy check ⚡',
    body: 'Channel that morning focus into your daily habits before lunchtime.',
    category: 'motivation',
  },
];

const AFTERNOON_TEMPLATES = [
  {
    title: 'Still scrolling? 👀',
    body: 'Your habits noticed. Put the feed on pause and knock one out.',
    category: 'encouragement',
  },
  {
    title: 'Half the day is gone ⚡',
    body: 'Your goals aren\'t. Time for a quick afternoon check-in.',
    category: 'progress',
  },
  {
    title: 'Your streak called 🔥',
    body: 'It wants today\'s check-in. Don\'t leave it hanging!',
    category: 'streak',
  },
  {
    title: 'Hey, you 🫵',
    body: 'Yes, the one with unfinished habits. Take 2 minutes and check one off.',
    category: 'challenge',
  },
  {
    title: 'Midday slump antidote 🔋',
    body: 'A quick habit completion gives you more energy than another coffee.',
    category: 'habit_tip',
  },
  {
    title: 'Don\'t break the chain ⛓️',
    body: 'You\'ve come too far to let today slide. Keep your momentum going.',
    category: 'streak',
  },
  {
    title: 'Quick afternoon checkpoint 📍',
    body: 'How is your habit progress looking today? Take a look in HabitUp.',
    category: 'goal',
  },
  {
    title: 'Afternoon power move 💪',
    body: 'Knock out one habit between your meetings or tasks. Feel the relief.',
    category: 'progress',
  },
  {
    title: 'A gentle tap on the shoulder 👋',
    body: 'Just a friendly reminder that today\'s checklist is waiting for you.',
    category: 'encouragement',
  },
  {
    title: 'Mid-week momentum check 📈',
    body: 'Consistency is built in the middle of the day. Check in now.',
    category: 'motivation',
  },
  {
    title: 'Your habits miss you 🥺',
    body: 'Give them some love before the afternoon slips away.',
    category: 'encouragement',
  },
  {
    title: 'Beat the 4 PM slump ⏰',
    body: 'Complete one small habit right now and finish your workday strong.',
    category: 'habit_tip',
  },
  {
    title: 'Streak defense mode: ON 🛡️',
    body: 'Protect that hard-earned streak. Log today\'s habit progress.',
    category: 'streak',
  },
  {
    title: 'Mini challenge of the day 🎯',
    body: 'Can you check off at least one habit before sunset? Let\'s see it!',
    category: 'challenge',
  },
];

const EVENING_TEMPLATES = [
  {
    title: 'Before the day ends… 🌙',
    body: 'Give yourself one satisfying win before you head to sleep.',
    category: 'progress',
  },
  {
    title: 'Plot twist 🏆',
    body: 'Today isn\'t over yet. You can still finish strong with one last habit.',
    category: 'comeback',
  },
  {
    title: 'Missed a habit today? 🌱',
    body: 'No drama. Do a quick 2-minute version right now and keep the habit alive.',
    category: 'comeback',
  },
  {
    title: 'Sleep better tonight 😴',
    body: 'Go to bed knowing you took care of your daily goals today.',
    category: 'goal',
  },
  {
    title: 'Final call for today\'s streak 🔥',
    body: 'Lock in your checkmarks before midnight resets the clock.',
    category: 'streak',
  },
  {
    title: 'Nightly reset time ✨',
    body: 'Review what you accomplished today and set yourself up for tomorrow.',
    category: 'progress',
  },
  {
    title: 'The 5-minute wind-down 🕯️',
    body: 'Check off your completed habits and enjoy the rest of your evening.',
    category: 'encouragement',
  },
  {
    title: 'Every checkmark counts 📝',
    body: 'Even a partial day is progress. Log your completions in HabitUp.',
    category: 'motivation',
  },
  {
    title: 'Close out your day like a pro 🌟',
    body: 'Take 60 seconds to update your habit status before calling it a night.',
    category: 'goal',
  },
  {
    title: 'Never miss twice rule 🔁',
    body: 'If yesterday was off, make tonight the comeback. One habit is all it takes.',
    category: 'comeback',
  },
  {
    title: 'Evening victory lap 🏁',
    body: 'Celebrate the consistency you showed today. Check in before bedtime.',
    category: 'progress',
  },
  {
    title: 'Protect your streak before midnight 🕛',
    body: 'A quick tap keeps your streak number climbing. Don\'t lose it!',
    category: 'streak',
  },
  {
    title: 'Tomorrow starts tonight 🌅',
    body: 'Wrap up today\'s habit log and wake up tomorrow ahead of the game.',
    category: 'habit_tip',
  },
  {
    title: 'One last win for the books 📖',
    body: 'Finish today on your own terms. Open HabitUp and check in.',
    category: 'motivation',
  },
];

const TEMPLATE_POOLS = {
  morning_blast: MORNING_TEMPLATES,
  afternoon_blast: AFTERNOON_TEMPLATES,
  evening_blast: EVENING_TEMPLATES,
};

module.exports = {
  MORNING_TEMPLATES,
  AFTERNOON_TEMPLATES,
  EVENING_TEMPLATES,
  TEMPLATE_POOLS,
};
