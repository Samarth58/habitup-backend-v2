const { calculateBestStreak, calculateCompletionRate } = require('./statsService');
const { calculateStreak } = require('./streakService');

function assertEqual(actual, expected, testName) {
  if (actual === expected) {
    console.log(`[PASS] ${testName} (Got: ${actual})`);
  } else {
    console.error(`[FAIL] ${testName} - Expected: ${expected}, Got: ${actual}`);
    process.exitCode = 1;
  }
}

function runTests() {
  console.log('Running statsService unit tests...\n');

  // Test 1: Best streak longer than current streak (had a 5-day streak in past, broke it, current streak is 3)
  const history1 = [
    '2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04', '2026-08-05', // 5-day streak
    '2026-08-26', '2026-08-27', '2026-08-28'                              // 3-day streak (current)
  ];
  const currentStreak1 = calculateStreak('daily', [], history1, 'UTC', '2026-08-28');
  const bestStreak1 = calculateBestStreak('daily', [], history1, 'UTC');

  assertEqual(currentStreak1, 3, 'Test 1a: Current streak is 3');
  assertEqual(bestStreak1, 5, 'Test 1b: Best streak is 5 (longer than current streak)');

  // Test 2: Completion rate for a fully-completed month (31/31 days)
  const fullMonthDates = [];
  for (let d = 1; d <= 31; d++) {
    const dayStr = String(d).padStart(2, '0');
    fullMonthDates.push(`2026-08-${dayStr}`);
  }
  const rate2 = calculateCompletionRate('daily', [], fullMonthDates, 'UTC', '2026-08-01', '2026-08-31', '2026-08-31');
  assertEqual(rate2, 100, 'Test 2: Completion rate for a fully-completed month is 100%');

  // Test 3: Completion rate with some misses (15 out of 30 days completed)
  const halfMonthDates = [];
  for (let d = 1; d <= 15; d++) {
    const dayStr = String(d).padStart(2, '0');
    halfMonthDates.push(`2026-06-${dayStr}`);
  }
  const rate3 = calculateCompletionRate('daily', [], halfMonthDates, 'UTC', '2026-06-01', '2026-06-30', '2026-06-30');
  assertEqual(rate3, 50, 'Test 3: Completion rate for 15/30 days completed is 50%');

  // Test 4: Zero completions edge case
  const bestStreak4 = calculateBestStreak('daily', [], [], 'UTC');
  const rate4 = calculateCompletionRate('daily', [], [], 'UTC', '2026-08-01', '2026-08-31', '2026-08-31');
  assertEqual(bestStreak4, 0, 'Test 4a: Best streak with zero completions is 0');
  assertEqual(rate4, 0, 'Test 4b: Completion rate with zero completions is 0%');

  console.log('\n----------------------------------------');
  console.log('ALL STATS SERVICE UNIT TESTS PASSED!');
  console.log('----------------------------------------');
}

runTests();
