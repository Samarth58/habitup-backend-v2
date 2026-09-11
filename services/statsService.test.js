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

  // Test 5: Scheduled habits calculateBestStreak and calculateCompletionRate
  // Schedule: Sunday (0), Monday (1), Wednesday (3), Friday (5)
  // August 2026:
  // Sun: 2, 9, 16, 23, 30
  // Mon: 3, 10, 17, 24, 31
  // Wed: 5, 12, 19, 26
  // Fri: 7, 14, 21, 28
  const scheduleDays = [0, 1, 3, 5];
  // 4 scheduled dates in first week: Aug 2 (Sun), Aug 3 (Mon), Aug 5 (Wed), Aug 7 (Fri)
  const schedHistory = ['2026-08-02', '2026-08-03', '2026-08-05', '2026-08-07'];
  const schedBestStreak = calculateBestStreak('scheduled', scheduleDays, schedHistory, 'UTC');
  assertEqual(schedBestStreak, 4, 'Test 5a: Scheduled [0, 1, 3, 5] best streak is 4');

  // Completed all 4 scheduled days out of 4 elapsed scheduled days by Aug 7 -> 100%
  const schedRate = calculateCompletionRate('scheduled', scheduleDays, schedHistory, 'UTC', '2026-08-01', '2026-08-07', '2026-08-07');
  assertEqual(schedRate, 100, 'Test 5b: Scheduled completion rate is 100% for completed week');

  // Completed 2 of 4 scheduled days -> 50%
  const partialHistory = ['2026-08-02', '2026-08-03'];
  const partialRate = calculateCompletionRate('scheduled', scheduleDays, partialHistory, 'UTC', '2026-08-01', '2026-08-07', '2026-08-07');
  assertEqual(partialRate, 50, 'Test 5c: Scheduled completion rate is 50% for 2/4 completed days');

  console.log('\n----------------------------------------');
  console.log('ALL STATS SERVICE UNIT TESTS PASSED!');
  console.log('----------------------------------------');
}

runTests();
