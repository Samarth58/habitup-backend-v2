const { calculateStreak } = require('./streakService');

function assertEqual(actual, expected, testName) {
  if (actual === expected) {
    console.log(`[PASS] ${testName} (Got: ${actual})`);
  } else {
    console.error(`[FAIL] ${testName} - Expected: ${expected}, Got: ${actual}`);
    process.exit(1);
  }
}

function runTests() {
  console.log('Running streakService tests...\n');

  // Test 1: Daily habit, 3 consecutive days completed including today -> streak 3
  const test1 = calculateStreak(
    'daily',
    [],
    ['2026-08-26', '2026-08-27', '2026-08-28'],
    'Asia/Kolkata',
    '2026-08-28'
  );
  assertEqual(test1, 3, 'Daily habit, 3 consecutive days completed including today');

  // Test 2: Daily habit, missed yesterday, completed today -> streak 1
  const test2 = calculateStreak(
    'daily',
    [],
    ['2026-08-25', '2026-08-28'],
    'Asia/Kolkata',
    '2026-08-28'
  );
  assertEqual(test2, 1, 'Daily habit, missed yesterday, completed today');

  // Test 3: Scheduled Mon/Wed/Fri (1, 3, 5), all three completed this week through Friday (today=Friday, 2026-08-28) -> streak 3
  // 2026-08-24 (Mon=1), 2026-08-26 (Wed=3), 2026-08-28 (Fri=5)
  const test3 = calculateStreak(
    'scheduled',
    [1, 3, 5],
    ['2026-08-24', '2026-08-26', '2026-08-28'],
    'Asia/Kolkata',
    '2026-08-28'
  );
  assertEqual(test3, 3, 'Scheduled Mon/Wed/Fri [1, 3, 5], all three completed this week through Friday');

  // Test 4: Scheduled Mon/Wed/Fri [1, 3, 5], Wednesday missed, Friday completed (today=Friday) -> streak 1
  const test4 = calculateStreak(
    'scheduled',
    [1, 3, 5],
    ['2026-08-24', '2026-08-28'],
    'Asia/Kolkata',
    '2026-08-28'
  );
  assertEqual(test4, 1, 'Scheduled Mon/Wed/Fri [1, 3, 5], Wednesday missed, Friday completed');

  // Test 5: Scheduled Mon/Wed/Fri [1, 3, 5], Monday and Wednesday completed, today=Thursday (2026-08-27, off-day) -> streak 2
  const test5 = calculateStreak(
    'scheduled',
    [1, 3, 5],
    ['2026-08-24', '2026-08-26'],
    'Asia/Kolkata',
    '2026-08-27'
  );
  assertEqual(test5, 2, 'Scheduled Mon/Wed/Fri [1, 3, 5], Mon & Wed completed, today=Thursday (off-day)');

  // Test 6: Scheduled Sun/Mon/Wed/Fri [0, 1, 3, 5]
  // 2026-08-23 (Sun=0), 2026-08-24 (Mon=1), 2026-08-26 (Wed=3), 2026-08-28 (Fri=5)
  const test6 = calculateStreak(
    'scheduled',
    [0, 1, 3, 5],
    ['2026-08-23', '2026-08-24', '2026-08-26', '2026-08-28'],
    'Asia/Kolkata',
    '2026-08-28'
  );
  assertEqual(test6, 4, 'Scheduled Sun/Mon/Wed/Fri [0, 1, 3, 5], all 4 completed through Friday -> streak 4');

  // Test 7: Scheduled Sunday only [0] - completed last Sunday (2026-08-23) and today is Wednesday (2026-08-26) -> streak 1
  const test7 = calculateStreak(
    'scheduled',
    [0],
    ['2026-08-23'],
    'Asia/Kolkata',
    '2026-08-26'
  );
  assertEqual(test7, 1, 'Scheduled Sunday [0], completed Sunday, today is Wednesday (off-day) -> streak 1');

  // Test 8: Scheduled Sunday only [0] - missed Sunday (2026-08-23), completed previous Sunday (2026-08-16), today is Wednesday (2026-08-26) -> streak 0
  const test8 = calculateStreak(
    'scheduled',
    [0],
    ['2026-08-16'],
    'Asia/Kolkata',
    '2026-08-26'
  );
  assertEqual(test8, 0, 'Scheduled Sunday [0], missed last Sunday, today is Wednesday -> streak 0');

  // Test 9: No completions at all -> streak 0
  const test9Daily = calculateStreak(
    'daily',
    [],
    [],
    'Asia/Kolkata',
    '2026-08-28'
  );
  assertEqual(test9Daily, 0, 'Daily habit, no completions at all');

  const test9Scheduled = calculateStreak(
    'scheduled',
    [0, 1, 3, 5],
    [],
    'Asia/Kolkata',
    '2026-08-28'
  );
  assertEqual(test9Scheduled, 0, 'Scheduled habit [0, 1, 3, 5], no completions at all');

  console.log('\n----------------------------------------');
  console.log('ALL STREAK TESTS PASSED SUCCESSFULLY!');
  console.log('----------------------------------------');
  process.exit(0);
}

runTests();
