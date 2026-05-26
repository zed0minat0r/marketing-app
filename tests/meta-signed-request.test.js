'use strict';

const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');

const { parseSignedRequest } = require('../lib/oauth-handlers/meta-data-deletion');

function base64UrlEncode(buf) {
  return buf.toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signRequest(payload, appSecret) {
  const payloadJson = JSON.stringify(payload);
  const encodedPayload = base64UrlEncode(Buffer.from(payloadJson));
  const sig = crypto.createHmac('sha256', appSecret).update(encodedPayload).digest();
  const encodedSig = base64UrlEncode(sig);
  return `${encodedSig}.${encodedPayload}`;
}

const TEST_SECRET = 'test-meta-app-secret-12345';

test('parseSignedRequest — valid signed_request returns payload', () => {
  const payload = {
    algorithm: 'HMAC-SHA256',
    user_id: '10157654321098765',
    issued_at: 1716740000,
  };
  const signed = signRequest(payload, TEST_SECRET);
  const result = parseSignedRequest(signed, TEST_SECRET);
  assert.ok(result);
  assert.strictEqual(result.user_id, '10157654321098765');
  assert.strictEqual(result.algorithm, 'HMAC-SHA256');
});

test('parseSignedRequest — wrong app secret returns null', () => {
  const payload = { algorithm: 'HMAC-SHA256', user_id: '12345' };
  const signed = signRequest(payload, TEST_SECRET);
  assert.strictEqual(parseSignedRequest(signed, 'wrong-secret'), null);
});

test('parseSignedRequest — wrong algorithm returns null', () => {
  const payload = { algorithm: 'NOT-HMAC', user_id: '12345' };
  const signed = signRequest(payload, TEST_SECRET);
  assert.strictEqual(parseSignedRequest(signed, TEST_SECRET), null);
});

test('parseSignedRequest — malformed (no dot) returns null', () => {
  assert.strictEqual(parseSignedRequest('not-a-signed-request', TEST_SECRET), null);
});

test('parseSignedRequest — empty / null returns null', () => {
  assert.strictEqual(parseSignedRequest('', TEST_SECRET), null);
  assert.strictEqual(parseSignedRequest(null, TEST_SECRET), null);
  assert.strictEqual(parseSignedRequest(undefined, TEST_SECRET), null);
});

test('parseSignedRequest — tampered payload returns null', () => {
  const payload = { algorithm: 'HMAC-SHA256', user_id: '12345' };
  const signed = signRequest(payload, TEST_SECRET);
  // Swap the encoded payload for a different one but keep the original sig
  const [sigPart] = signed.split('.');
  const tamperedPayload = base64UrlEncode(Buffer.from(JSON.stringify({ algorithm: 'HMAC-SHA256', user_id: '99999' })));
  const tampered = `${sigPart}.${tamperedPayload}`;
  assert.strictEqual(parseSignedRequest(tampered, TEST_SECRET), null);
});

test('parseSignedRequest — invalid JSON in payload returns null', () => {
  const encodedBadPayload = base64UrlEncode(Buffer.from('not json {'));
  const sig = crypto.createHmac('sha256', TEST_SECRET).update(encodedBadPayload).digest();
  const signed = `${base64UrlEncode(sig)}.${encodedBadPayload}`;
  assert.strictEqual(parseSignedRequest(signed, TEST_SECRET), null);
});
