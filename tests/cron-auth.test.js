'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { checkVercelCronAuth } = require('../lib/cron-auth');

function makeReq(authHeader) {
  return { headers: authHeader === undefined ? {} : { authorization: authHeader } };
}

test('checkVercelCronAuth — no CRON_SECRET allows (dev mode)', () => {
  delete process.env.CRON_SECRET;
  delete process.env.NODE_ENV;
  assert.strictEqual(checkVercelCronAuth(makeReq()), true);
});

test('checkVercelCronAuth — correct bearer matches', () => {
  process.env.CRON_SECRET = 'vercel-generated-secret-abc123';
  assert.strictEqual(
    checkVercelCronAuth(makeReq('Bearer vercel-generated-secret-abc123')),
    true
  );
  delete process.env.CRON_SECRET;
});

test('checkVercelCronAuth — wrong bearer rejects', () => {
  process.env.CRON_SECRET = 'correct-secret';
  assert.strictEqual(
    checkVercelCronAuth(makeReq('Bearer wrong-secret')),
    false
  );
  delete process.env.CRON_SECRET;
});

test('checkVercelCronAuth — no Authorization header rejects', () => {
  process.env.CRON_SECRET = 'secret';
  assert.strictEqual(checkVercelCronAuth(makeReq()), false);
  delete process.env.CRON_SECRET;
});

test('checkVercelCronAuth — malformed Authorization (no Bearer prefix) rejects', () => {
  process.env.CRON_SECRET = 'secret';
  assert.strictEqual(checkVercelCronAuth(makeReq('secret')), false);
  delete process.env.CRON_SECRET;
});

test('checkVercelCronAuth — different-length bearer rejects (no timing side-channel)', () => {
  process.env.CRON_SECRET = 'long-secret-value-here';
  assert.strictEqual(checkVercelCronAuth(makeReq('Bearer short')), false);
  delete process.env.CRON_SECRET;
});
