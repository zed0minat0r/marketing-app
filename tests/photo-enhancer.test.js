'use strict';

const test = require('node:test');
const assert = require('node:assert');

// Force-clear REPLICATE_API_TOKEN before requiring the module so hasApiToken
// reads the absent state. Each test sets/clears as it needs.
delete process.env.REPLICATE_API_TOKEN;

const { enhancePhoto, hasApiToken, publicUrlIsReachable } = require('../lib/photo-enhancer');

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

test('publicUrlIsReachable — accepts non-internal HTTPS URLs', () => {
  assert.strictEqual(publicUrlIsReachable('https://photos.sidekik.com/abc.jpg'), true);
  assert.strictEqual(publicUrlIsReachable('https://pub-xyz.r2.dev/abc.jpg'), true);
});

test('publicUrlIsReachable — rejects the raw R2 internal endpoint', () => {
  assert.strictEqual(
    publicUrlIsReachable('https://abc123.r2.cloudflarestorage.com/sidekick-photos/abc.jpg'),
    false
  );
});

test('publicUrlIsReachable — accepts when R2_PUBLIC_BASE_URL matches', () => {
  process.env.R2_PUBLIC_BASE_URL = 'https://photos.sidekik.com';
  assert.strictEqual(
    publicUrlIsReachable('https://photos.sidekik.com/user_x/2026-05-26_abc.jpg'),
    true
  );
  delete process.env.R2_PUBLIC_BASE_URL;
});

test('publicUrlIsReachable — empty/null returns false', () => {
  assert.strictEqual(publicUrlIsReachable(''), false);
  assert.strictEqual(publicUrlIsReachable(null), false);
  assert.strictEqual(publicUrlIsReachable(undefined), false);
});

test('publicUrlIsReachable — rejects non-https URLs', () => {
  assert.strictEqual(publicUrlIsReachable('http://photos.sidekik.com/abc.jpg'), false);
  assert.strictEqual(publicUrlIsReachable('ftp://nope.com/abc.jpg'), false);
});

test('enhancePhoto — throws URL_NOT_PUBLIC when originalUrl is the internal R2 endpoint', async () => {
  process.env.REPLICATE_API_TOKEN = 'r8_test_token';
  await assert.rejects(
    enhancePhoto({
      userId: 'u1',
      originalUrl: 'https://acct.r2.cloudflarestorage.com/bucket/key.jpg',
      mimeType: 'image/jpeg',
    }),
    err => err.code === 'URL_NOT_PUBLIC'
  );
  delete process.env.REPLICATE_API_TOKEN;
});
