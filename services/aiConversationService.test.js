const test = require('node:test');
const assert = require('node:assert/strict');
const { generateConversationTitle } = require('./aiConversationService');

test('aiConversationService - generateConversationTitle strips prefixes and formats clean title', () => {
  assert.equal(
    generateConversationTitle('How can I improve my reading habit?'),
    'Improve my reading habit'
  );

  assert.equal(
    generateConversationTitle('Can you help me with morning routine planning?'),
    'Morning routine planning'
  );

  assert.equal(
    generateConversationTitle('what is the best way to wake up early!'),
    'Wake up early'
  );

  assert.equal(
    generateConversationTitle('I want to start running every day.'),
    'I want to start running every day'
  );

  const longMessage = 'This is a very long question about building consistency and motivation when working on multiple habits simultaneously throughout the day.';
  const title = generateConversationTitle(longMessage);
  assert.ok(title.length <= 60);
  assert.ok(title.endsWith('...'));

  assert.equal(generateConversationTitle(''), 'New Conversation');
  assert.equal(generateConversationTitle(null), 'New Conversation');
});
