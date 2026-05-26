'use strict';

const test = require('node:test');
const assert = require('node:assert');

// Force a non-redis path by clearing the env vars (cost-guardrails uses the
// in-memory fallback in rate-limit.js when these are absent — covered by the
// rate-limit suite).
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

// Snapshot existing env and restore after — we mutate it.
const savedEnv = {
  MAX_MMS_PER_USER_PER_DAY: process.env.MAX_MMS_PER_USER_PER_DAY,
  MAX_TAGS_PER_USER_PER_DAY: process.env.MAX_TAGS_PER_USER_PER_DAY,
  MAX_ENHANCEMENTS_PER_USER_PER_DAY: process.env.MAX_ENHANCEMENTS_PER_USER_PER_DAY,
};
function restoreEnv() {
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

const { checkDailyCap, getCap, DEFAULT_CAPS } = require('../lib/cost-guardrails');

test('getCap — default values', () => {
  delete process.env.MAX_MMS_PER_USER_PER_DAY;
  assert.strictEqual(getCap('mms_intake'), DEFAULT_CAPS.mms_intake);
  assert.strictEqual(getCap('vision_tag'), DEFAULT_CAPS.vision_tag);
  assert.strictEqual(getCap('enhancement'), DEFAULT_CAPS.enhancement);
});

test('getCap — env override', () => {
  process.env.MAX_MMS_PER_USER_PER_DAY = '12';
  assert.strictEqual(getCap('mms_intake'), 12);
  delete process.env.MAX_MMS_PER_USER_PER_DAY;
});

test('getCap — invalid env value falls back to default', () => {
  process.env.MAX_TAGS_PER_USER_PER_DAY = 'not-a-number';
  assert.strictEqual(getCap('vision_tag'), DEFAULT_CAPS.vision_tag);
  process.env.MAX_TAGS_PER_USER_PER_DAY = '-5';
  assert.strictEqual(getCap('vision_tag'), DEFAULT_CAPS.vision_tag);
  process.env.MAX_TAGS_PER_USER_PER_DAY = '0';
  assert.strictEqual(getCap('vision_tag'), DEFAULT_CAPS.vision_tag);
  delete process.env.MAX_TAGS_PER_USER_PER_DAY;
});

test('checkDailyCap — under cap allows + decrements remaining', async () => {
  process.env.MAX_MMS_PER_USER_PER_DAY = '3';
  const userId = `test-user-${Date.now()}-a`;
  const r1 = await checkDailyCap('mms_intake', userId);
  assert.strictEqual(r1.allowed, true);
  assert.strictEqual(r1.cap, 3);
  assert.strictEqual(r1.remaining, 2);

  const r2 = await checkDailyCap('mms_intake', userId);
  assert.strictEqual(r2.allowed, true);
  assert.strictEqual(r2.remaining, 1);

  const r3 = await checkDailyCap('mms_intake', userId);
  assert.strictEqual(r3.allowed, true);
  assert.strictEqual(r3.remaining, 0);

  delete process.env.MAX_MMS_PER_USER_PER_DAY;
});

test('checkDailyCap — at-cap+1 denies', async () => {
  process.env.MAX_ENHANCEMENTS_PER_USER_PER_DAY = '2';
  const userId = `test-user-${Date.now()}-b`;
  await checkDailyCap('enhancement', userId); // 1
  await checkDailyCap('enhancement', userId); // 2
  const r3 = await checkDailyCap('enhancement', userId); // 3 — over
  assert.strictEqual(r3.allowed, false);
  delete process.env.MAX_ENHANCEMENTS_PER_USER_PER_DAY;
});

test('checkDailyCap — different users have isolated buckets', async () => {
  process.env.MAX_TAGS_PER_USER_PER_DAY = '1';
  const userA = `test-user-${Date.now()}-c`;
  const userB = `test-user-${Date.now()}-d`;
  const a = await checkDailyCap('vision_tag', userA);
  const b = await checkDailyCap('vision_tag', userB);
  assert.strictEqual(a.allowed, true);
  assert.strictEqual(b.allowed, true);
  // Each hits their own cap
  const a2 = await checkDailyCap('vision_tag', userA);
  assert.strictEqual(a2.allowed, false);
  const b2 = await checkDailyCap('vision_tag', userB);
  assert.strictEqual(b2.allowed, false);
  delete process.env.MAX_TAGS_PER_USER_PER_DAY;
});

test('checkDailyCap — different operations have isolated buckets', async () => {
  process.env.MAX_MMS_PER_USER_PER_DAY = '1';
  process.env.MAX_TAGS_PER_USER_PER_DAY = '1';
  const userId = `test-user-${Date.now()}-e`;
  await checkDailyCap('mms_intake', userId);          // 1 -> mms_intake cap reached
  const tagFirst = await checkDailyCap('vision_tag', userId); // first vision_tag -> allowed
  assert.strictEqual(tagFirst.allowed, true);
  // mms_intake now denied
  const mmsAgain = await checkDailyCap('mms_intake', userId);
  assert.strictEqual(mmsAgain.allowed, false);
  // vision_tag still has room? no, also hit cap on the previous call
  delete process.env.MAX_MMS_PER_USER_PER_DAY;
  delete process.env.MAX_TAGS_PER_USER_PER_DAY;
});

test('checkDailyCap — unknown operation throws', async () => {
  await assert.rejects(
    checkDailyCap('not_a_real_operation', 'user-x'),
    /Unknown cost operation/
  );
});

test.after(restoreEnv);
