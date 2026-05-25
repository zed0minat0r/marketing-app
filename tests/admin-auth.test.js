'use strict';

const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');

const { checkAdminAuth } = require('../lib/admin-auth');

function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}

const TEST_PASSWORD = 'horse-battery-staple';
const TEST_HASH = crypto.createHash('sha256').update(TEST_PASSWORD).digest('hex');

test('checkAdminAuth — missing config + requireConfig:true returns 503', () => {
  delete process.env.ADMIN_PASSWORD_HASH;
  const res = mockRes();
  const ok = checkAdminAuth({ headers: {} }, res);
  assert.strictEqual(ok, false);
  assert.strictEqual(res.statusCode, 503);
});

test('checkAdminAuth — missing config + requireConfig:false returns true (unauthenticated)', () => {
  delete process.env.ADMIN_PASSWORD_HASH;
  const res = mockRes();
  const ok = checkAdminAuth({ headers: {} }, res, { requireConfig: false });
  assert.strictEqual(ok, true);
  assert.strictEqual(res.statusCode, null);
});

test('checkAdminAuth — missing Authorization header returns 401', () => {
  process.env.ADMIN_PASSWORD_HASH = TEST_HASH;
  const res = mockRes();
  const ok = checkAdminAuth({ headers: {} }, res);
  assert.strictEqual(ok, false);
  assert.strictEqual(res.statusCode, 401);
  delete process.env.ADMIN_PASSWORD_HASH;
});

test('checkAdminAuth — wrong password returns 403', () => {
  process.env.ADMIN_PASSWORD_HASH = TEST_HASH;
  const res = mockRes();
  const ok = checkAdminAuth(
    { headers: { authorization: 'Bearer wrong-password' } },
    res
  );
  assert.strictEqual(ok, false);
  assert.strictEqual(res.statusCode, 403);
  delete process.env.ADMIN_PASSWORD_HASH;
});

test('checkAdminAuth — correct password returns true', () => {
  process.env.ADMIN_PASSWORD_HASH = TEST_HASH;
  const res = mockRes();
  const ok = checkAdminAuth(
    { headers: { authorization: `Bearer ${TEST_PASSWORD}` } },
    res
  );
  assert.strictEqual(ok, true);
  assert.strictEqual(res.statusCode, null);
  delete process.env.ADMIN_PASSWORD_HASH;
});

test('checkAdminAuth — malformed Authorization (no Bearer prefix) returns 401', () => {
  process.env.ADMIN_PASSWORD_HASH = TEST_HASH;
  const res = mockRes();
  const ok = checkAdminAuth(
    { headers: { authorization: TEST_PASSWORD } },
    res
  );
  assert.strictEqual(ok, false);
  assert.strictEqual(res.statusCode, 401);
  delete process.env.ADMIN_PASSWORD_HASH;
});
