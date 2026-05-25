'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { normalizePlatform, platformLabel, SUPPORTED_PLATFORMS } = require('../lib/oauth-link');

test('normalizePlatform — exact platform keys', () => {
  assert.strictEqual(normalizePlatform('facebook'), 'meta');
  assert.strictEqual(normalizePlatform('instagram'), 'meta');
  assert.strictEqual(normalizePlatform('meta'), 'meta');
  assert.strictEqual(normalizePlatform('google'), 'google');
  assert.strictEqual(normalizePlatform('linkedin'), 'linkedin');
  assert.strictEqual(normalizePlatform('twitter'), 'twitter');
  assert.strictEqual(normalizePlatform('x'), 'twitter');
  assert.strictEqual(normalizePlatform('pinterest'), 'pinterest');
});

test('normalizePlatform — aliases', () => {
  assert.strictEqual(normalizePlatform('IG'), 'meta');
  assert.strictEqual(normalizePlatform('fb'), 'meta');
  assert.strictEqual(normalizePlatform('li'), 'linkedin');
  assert.strictEqual(normalizePlatform('pin'), 'pinterest');
});

test('normalizePlatform — case insensitive', () => {
  assert.strictEqual(normalizePlatform('FACEBOOK'), 'meta');
  assert.strictEqual(normalizePlatform('Instagram'), 'meta');
  assert.strictEqual(normalizePlatform('  LinkedIn  '), 'linkedin');
});

test('normalizePlatform — unknown returns null', () => {
  assert.strictEqual(normalizePlatform('myspace'), null);
  assert.strictEqual(normalizePlatform(''), null);
  assert.strictEqual(normalizePlatform(null), null);
});

test('normalizePlatform — multi-word google business', () => {
  assert.strictEqual(normalizePlatform('google business'), 'google');
  assert.strictEqual(normalizePlatform('google business profile'), 'google');
  assert.strictEqual(normalizePlatform('gbp'), 'google');
});

test('platformLabel — defaults match user-facing copy', () => {
  assert.strictEqual(platformLabel('meta'), 'Facebook / Instagram');
  assert.strictEqual(platformLabel('google'), 'Google Business');
  assert.strictEqual(platformLabel('linkedin'), 'LinkedIn');
  assert.strictEqual(platformLabel('twitter'), 'X');
  assert.strictEqual(platformLabel('pinterest'), 'Pinterest');
});

test('platformLabel — prefers original input when distinguishable', () => {
  assert.strictEqual(platformLabel('meta', 'Instagram'), 'Instagram');
  assert.strictEqual(platformLabel('meta', 'facebook'), 'Facebook');
  assert.strictEqual(platformLabel('twitter', 'X'), 'X');
});

test('SUPPORTED_PLATFORMS — includes all current platforms', () => {
  for (const p of ['meta', 'google', 'linkedin', 'twitter', 'pinterest']) {
    assert.strictEqual(SUPPORTED_PLATFORMS.has(p), true, `${p} should be supported`);
  }
  assert.strictEqual(SUPPORTED_PLATFORMS.has('tiktok'), false);
});
