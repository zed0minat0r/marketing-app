'use strict';

/**
 * The Meta webhook verifies X-Hub-Signature-256.
 *
 * Meta signs the RAW request bytes with the app secret. This endpoint used to skip the check on the
 * reasoning that Vercel consumes the raw body before we can see it - no longer true here, since the
 * route now disables bodyParser and reads the stream itself, the same way the QStash jobs route does.
 *
 * Without this, anyone who guessed a page id could make the app spend Graph calls, Claude calls and
 * SMS sends. The re-fetch design already stopped a forger injecting CONTENT; this stops them
 * spending money.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const handler = require('../api/meta/webhook');

const SECRET = 'test-app-secret';
const BODY = { object: 'page', entry: [{ id: 'page1', changes: [] }] };

function sign(bodyObj, secret = SECRET) {
  const raw = Buffer.from(JSON.stringify(bodyObj));
  return 'sha256=' + crypto.createHmac('sha256', secret).update(raw).digest('hex');
}

function makeRes() {
  const res = { statusCode: null, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.send = (b) => { res.body = b; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

const post = (headers, body = BODY) => ({ method: 'POST', headers, body, query: {} });

describe('meta webhook signature', () => {
  test('accepts a correctly signed payload', async () => {
    process.env.META_APP_SECRET = SECRET;
    const res = makeRes();
    await handler(post({ 'x-hub-signature-256': sign(BODY) }), res);
    assert.equal(res.statusCode, 200);
  });

  test('rejects a payload signed with the wrong secret', async () => {
    process.env.META_APP_SECRET = SECRET;
    const res = makeRes();
    await handler(post({ 'x-hub-signature-256': sign(BODY, 'not-the-secret') }), res);
    assert.equal(res.statusCode, 403);
  });

  test('rejects a missing signature header', async () => {
    process.env.META_APP_SECRET = SECRET;
    const res = makeRes();
    await handler(post({}), res);
    assert.equal(res.statusCode, 403);
  });

  test('rejects a signature for a different body', async () => {
    process.env.META_APP_SECRET = SECRET;
    const res = makeRes();
    await handler(post({ 'x-hub-signature-256': sign({ object: 'page', entry: [] }) }), res);
    assert.equal(res.statusCode, 403);
  });

  test('processes unverified when no secret is configured, by design', async () => {
    delete process.env.META_APP_SECRET;
    const res = makeRes();
    await handler(post({}), res);
    assert.equal(res.statusCode, 200, 'must not silently kill comment replies during setup');
    process.env.META_APP_SECRET = SECRET;
  });
});
