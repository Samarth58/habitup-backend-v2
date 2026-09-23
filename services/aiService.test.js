const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildContents,
  buildContextString,
  isDailyQuotaExhausted,
  isRetryableTransientError,
  sanitizeAIErrorMessage,
} = require('./aiService');

test('aiService - buildContents without history returns string with context prefix', () => {
  const context = { preferredLanguage: 'en', timezone: 'UTC', activeHabitCount: 1, habits: [{ name: 'Yoga' }] };
  const contents = buildContents('What should I do today?', context, []);

  assert.equal(typeof contents, 'string');
  assert.ok(contents.includes('[HabitUp User Context]'));
  assert.ok(contents.includes('User Preferred Language: en'));
  assert.ok(contents.includes('Yoga'));
  assert.ok(contents.includes('[User Message]\nWhat should I do today?'));
});

test('aiService - buildContents with history formats multi-turn array in intended order', () => {
  const context = { preferredLanguage: 'en', activeHabitCount: 1, habits: [{ name: 'Reading' }] };
  const history = [
    { role: 'user', content: 'How do I start reading?' },
    { role: 'assistant', content: 'Start with 5 pages daily.' },
  ];

  const contents = buildContents('Can I do 10 pages instead?', context, history);

  assert.ok(Array.isArray(contents));
  assert.equal(contents.length, 3);

  // Turn 0: User (with injected context)
  assert.equal(contents[0].role, 'user');
  assert.ok(contents[0].parts[0].text.includes('[HabitUp User Context]'));
  assert.ok(contents[0].parts[0].text.includes('Reading'));
  assert.ok(contents[0].parts[0].text.includes('How do I start reading?'));

  // Turn 1: Model (assistant mapped to model)
  assert.equal(contents[1].role, 'model');
  assert.equal(contents[1].parts[0].text, 'Start with 5 pages daily.');

  // Turn 2: Current user message
  assert.equal(contents[2].role, 'user');
  assert.equal(contents[2].parts[0].text, 'Can I do 10 pages instead?');
});

test('aiService - buildContents without context returns plain turns or string', () => {
  const plainString = buildContents('Hello', {}, []);
  assert.equal(plainString, 'Hello');

  const plainHistory = buildContents('Follow up', {}, [
    { role: 'user', content: 'Hi' },
    { role: 'assistant', content: 'Hello there' },
  ]);
  assert.ok(Array.isArray(plainHistory));
  assert.equal(plainHistory.length, 3);
  assert.equal(plainHistory[0].parts[0].text, 'Hi');
  assert.equal(plainHistory[1].parts[0].text, 'Hello there');
  assert.equal(plainHistory[2].parts[0].text, 'Follow up');
});

test('aiService - isDailyQuotaExhausted correctly identifies daily quota exhaustion errors', () => {
  const quotaErr1 = new Error(
    '{"error":{"code":429,"message":"You exceeded your current quota... Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20, model: gemini-3.6-flash","status":"RESOURCE_EXHAUSTED"}}'
  );
  assert.equal(isDailyQuotaExhausted(quotaErr1), true);

  const quotaErr2 = new Error('GenerateRequestsPerDayPerProjectPerModel-FreeTier limit exceeded');
  assert.equal(isDailyQuotaExhausted(quotaErr2), true);

  const nonQuota429 = new Error('429 Too Many Requests - momentary spike');
  assert.equal(isDailyQuotaExhausted(nonQuota429), false);

  const server503 = new Error('503 Service Unavailable');
  assert.equal(isDailyQuotaExhausted(server503), false);
});

test('aiService - isRetryableTransientError identifies transient errors and rejects daily quota errors', () => {
  const transient503 = new Error('503 Service Unavailable - model experiencing high demand');
  assert.equal(isRetryableTransientError(transient503), true);

  const transientUnavailable = new Error('The service is temporarily UNAVAILABLE');
  assert.equal(isRetryableTransientError(transientUnavailable), true);

  const dailyQuotaErr = new Error(
    '429 RESOURCE_EXHAUSTED: Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20'
  );
  assert.equal(isRetryableTransientError(dailyQuotaErr), false);

  const badRequest = new Error('400 Invalid argument supplied');
  assert.equal(isRetryableTransientError(badRequest), false);
});

test('aiService - sanitizeAIErrorMessage produces user-safe messages without leaking provider details', () => {
  const rawProviderQuotaError = new Error(
    '{"error":{"code":429,"message":"You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://ai.google.dev/gemini-api/docs/rate-limits.\n* Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20, model: gemini-3.6-flash\nPlease retry in 42s.","status":"RESOURCE_EXHAUSTED","details":[{"@type":"type.googleapis.com/google.rpc.Help"}]}}'
  );

  const safeQuotaMessage = sanitizeAIErrorMessage(rawProviderQuotaError);
  assert.equal(safeQuotaMessage, 'AI service quota temporarily exhausted. Please try again later.');
  assert.equal(safeQuotaMessage.includes('http'), false);
  assert.equal(safeQuotaMessage.includes('googleapis.com'), false);
  assert.equal(safeQuotaMessage.includes('RESOURCE_EXHAUSTED'), false);
  assert.equal(safeQuotaMessage.includes('details'), false);

  const rawGenericError = new Error('Provider internal exception at Line 42 in GoogleGenAI.ts');
  const safeGenericMessage = sanitizeAIErrorMessage(rawGenericError);
  assert.equal(safeGenericMessage, 'Failed to generate AI response. Please try again later.');
  assert.equal(safeGenericMessage.includes('GoogleGenAI'), false);

  const rawTransient503 = new Error('503 Service Unavailable: This model is currently experiencing high demand.');
  const safeTransientMessage = sanitizeAIErrorMessage(rawTransient503);
  assert.equal(safeTransientMessage, 'AI service is temporarily unavailable due to high demand. Please try again in a few moments.');
});

test('aiService - buildContents normalizes malformed, truncated, or consecutive role history', () => {
  // Case A: History starting with 'model' (should drop leading model turn)
  const historyLeadingModel = [
    { role: 'assistant', content: 'Orphaned reply' },
    { role: 'user', content: 'User question' },
    { role: 'assistant', content: 'Model answer' },
  ];
  const contentsA = buildContents('Next turn', {}, historyLeadingModel);
  assert.equal(contentsA.length, 3);
  assert.equal(contentsA[0].role, 'user');
  assert.equal(contentsA[0].parts[0].text, 'User question');
  assert.equal(contentsA[1].role, 'model');
  assert.equal(contentsA[1].parts[0].text, 'Model answer');
  assert.equal(contentsA[2].role, 'user');
  assert.equal(contentsA[2].parts[0].text, 'Next turn');

  // Case B: History ending with 'user' (orphaned user turn from failed request)
  const historyTrailingUser = [
    { role: 'user', content: 'Turn 1 question' },
    { role: 'assistant', content: 'Turn 1 answer' },
    { role: 'user', content: 'Turn 2 failed question' },
  ];
  const contentsB = buildContents('Turn 2 retry question', {}, historyTrailingUser);
  assert.equal(contentsB.length, 3);
  assert.equal(contentsB[0].role, 'user');
  assert.equal(contentsB[0].parts[0].text, 'Turn 1 question');
  assert.equal(contentsB[1].role, 'model');
  assert.equal(contentsB[1].parts[0].text, 'Turn 1 answer');
  assert.equal(contentsB[2].role, 'user');
  assert.equal(contentsB[2].parts[0].text, 'Turn 2 retry question');

  // Case C: Consecutive user turns in history (should merge)
  const historyConsecutiveUsers = [
    { role: 'user', content: 'Part 1' },
    { role: 'user', content: 'Part 2' },
    { role: 'assistant', content: 'Answer' },
  ];
  const contentsC = buildContents('Followup', {}, historyConsecutiveUsers);
  assert.equal(contentsC.length, 3);
  assert.equal(contentsC[0].role, 'user');
  assert.equal(contentsC[0].parts[0].text, 'Part 1\nPart 2');
  assert.equal(contentsC[1].role, 'model');
  assert.equal(contentsC[1].parts[0].text, 'Answer');
  assert.equal(contentsC[2].role, 'user');
  assert.equal(contentsC[2].parts[0].text, 'Followup');
});

