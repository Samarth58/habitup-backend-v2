const test = require('node:test');
const assert = require('node:assert/strict');
const { getAIUserContext } = require('./aiContextService');

test('aiContextService - returns default context for empty userId', async () => {
  const context = await getAIUserContext(null);
  assert.equal(context.preferredLanguage, 'en');
  assert.equal(context.password, undefined);
  assert.equal(context.email, undefined);
  assert.equal(context.token, undefined);
});

test('aiContextService - does not leak sensitive user fields in context', async () => {
  const context = await getAIUserContext('00000000-0000-0000-0000-000000000000');
  assert.ok(context);
  assert.equal(context.password, undefined);
  assert.equal(context.password_hash, undefined);
  assert.equal(context.email, undefined);
  assert.equal(context.access_token, undefined);
  assert.equal(context.refresh_token, undefined);
});
