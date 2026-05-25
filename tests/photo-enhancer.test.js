'use strict';

const test = require('node:test');
const assert = require('node:assert');

// Force-clear REPLICATE_API_TOKEN before requiring the module so hasApiToken
// reads the absent state. Each test sets/clears as it needs.
delete process.env.REPLICATE_API_TOKEN;

const { enhancePhoto, hasApiToken } = require('../lib/photo-enhancer');

test('hasApiToken — false when REPLICATE_API_TOKEN unset', () => {
  delete process.env.REPLICATE_API_TOKEN;
  assert.strictEqual(hasApiToken(), false);
});

test('hasApiToken — true when REPLICATE_API_TOKEN set', () => {
  process.env.REPLICATE_API_TOKEN = 'r8_test_token';
  assert.strictEqual(hasApiToken(), true);
  delete process.env.REPLICATE_API_TOKEN;
});

test('enhancePhoto — throws NO_API_TOKEN when token missing', async () => {
  delete process.env.REPLICATE_API_TOKEN;
  await assert.rejects(
    enhancePhoto({ userId: 'u1', originalUrl: 'https://x/y.jpg', mimeType: 'image/jpeg' }),
    err => err.code === 'NO_API_TOKEN'
  );
});

test('enhancePhoto — throws when originalUrl missing', async () => {
  process.env.REPLICATE_API_TOKEN = 'r8_test_token';
  await assert.rejects(
    enhancePhoto({ userId: 'u1', originalUrl: '', mimeType: 'image/jpeg' }),
    /originalUrl required/
  );
  delete process.env.REPLICATE_API_TOKEN;
});
