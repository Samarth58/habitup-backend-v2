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

  // Test 3: Scheduled Mon/Wed/Fri, all three completed this week through Friday (today=Friday) -> streak 3
  // 2026-08-24 (Mon=0), 2026-08-26 (Wed=2), 2026-08-28 (Fri=4)
  const test3 = calculateStreak(
    'scheduled',
    [0, 2, 4],
    ['2026-08-24', '2026-08-26', '2026-08-28'],
    'Asia/Kolkata',
    '2026-08-28'
  );
  assertEqual(test3, 3, 'Scheduled Mon/Wed/Fri, all three completed this week through Friday (today=Friday)');

  // Test 4: Scheduled Mon/Wed/Fri, Wednesday missed, Friday completed (today=Friday) -> streak 1
  const test4 = calculateStreak(
    'scheduled',
    [0, 2, 4],
    ['2026-08-24', '2026-08-28'],
    'Asia/Kolkata',
    '2026-08-28'
  );
  assertEqual(test4, 1, 'Scheduled Mon/Wed/Fri, Wednesday missed, Friday completed (today=Friday)');

  // Test 5: Scheduled Mon/Wed/Fri, Monday and Wednesday completed, today=Thursday (an off-day, Friday not yet due) -> streak 2
  // 2026-08-27 (Thu=3)
  const test5 = calculateStreak(
    'scheduled',
    [0, 2, 4],
    ['2026-08-24', '2026-08-26'],
    'Asia/Kolkata',
    '2026-08-27'
  );
  assertEqual(test5, 2, 'Scheduled Mon/Wed/Fri, Mon & Wed completed, today=Thursday (off-day)');

  // Test 6: No completions at all -> streak 0
  const test6Daily = calculateStreak(
    'daily',
    [],
    [],
    'Asia/Kolkata',
    '2026-08-28'
  );
  assertEqual(test6Daily, 0, 'Daily habit, no completions at all');

  const test6Scheduled = calculateStreak(
    'scheduled',
    [0, 2, 4],
    [],
    'Asia/Kolkata',
    '2026-08-28'
  );
  assertEqual(test6Scheduled, 0, 'Scheduled habit, no completions at all');

  console.log('\n----------------------------------------');
  console.log('ALL STREAK TESTS PASSED SUCCESSFULLY!');
  console.log('----------------------------------------');
  process.exit(0);
}

runTests();
