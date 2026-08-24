'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');

const { extractCommentHints } = require('../lib/comment-replies');

describe('extractCommentHints (untrusted webhook payload)', () => {
  test('extracts a facebook comment add event', () => {
    const hints = extractCommentHints({
      object: 'page',
      entry: [{
        id: '111222333',
        changes: [{ field: 'feed', value: { item: 'comment', verb: 'add', comment_id: '111222333_444' } }],
      }],
    });
    assert.deepEqual(hints, [{ platform: 'facebook', commentId: '111222333_444', pageId: '111222333' }]);
  });

  test('extracts an instagram comment event', () => {
    const hints = extractCommentHints({
      object: 'instagram',
      entry: [{ id: '178999', changes: [{ field: 'comments', value: { id: '17900001' } }] }],
    });
    assert.deepEqual(hints, [{ platform: 'instagram', commentId: '17900001', pageId: '178999' }]);
  });

  test('ignores non-comment feed events and comment edits/removes', () => {
    const hints = extractCommentHints({
      entry: [{
        id: '1',
        changes: [
          { field: 'feed', value: { item: 'like', verb: 'add' } },
          { field: 'feed', value: { item: 'comment', verb: 'remove', comment_id: 'x' } },
          { field: 'feed', value: { item: 'comment', verb: 'edited', comment_id: 'y' } },
          { field: 'mention', value: {} },
        ],
      }],
    });
    assert.deepEqual(hints, []);
  });

  test('malformed and hostile payloads produce no hints and no throw', () => {
    assert.deepEqual(extractCommentHints(null), []);
    assert.deepEqual(extractCommentHints({}), []);
    assert.deepEqual(extractCommentHints({ entry: 'not-an-array' }), []);
    assert.deepEqual(extractCommentHints({ entry: [{ changes: [{ field: 'feed', value: null }] }] }), []);
  });

  test('bounds work per webhook call', () => {
    const changes = Array.from({ length: 50 }, (_, i) => ({
      field: 'feed', value: { item: 'comment', verb: 'add', comment_id: `c${i}` },
    }));
    const hints = extractCommentHints({ entry: [{ id: 'p', changes }] });
    assert.equal(hints.length, 10);
  });
});

describe('webhook handshake', () => {
  const handler = require('../api/meta/webhook');

  function makeRes() {
    const res = { statusCode: null, body: null };
    res.status = (c) => { res.statusCode = c; return res; };
    res.send = (b) => { res.body = b; return res; };
    res.json = (b) => { res.body = b; return res; };
    return res;
  }

  test('echoes challenge on valid verify token', async () => {
    process.env.META_WEBHOOK_VERIFY_TOKEN = 'sekrit';
    const res = makeRes();
    await handler({ method: 'GET', query: { 'hub.mode': 'subscribe', 'hub.verify_token': 'sekrit', 'hub.challenge': 'abc123' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body, 'abc123');
  });

  test('rejects wrong or missing verify token', async () => {
    process.env.META_WEBHOOK_VERIFY_TOKEN = 'sekrit';
    const res = makeRes();
    await handler({ method: 'GET', query: { 'hub.mode': 'subscribe', 'hub.verify_token': 'wrong', 'hub.challenge': 'abc' } }, res);
    assert.equal(res.statusCode, 403);
  });

  test('rejects handshake when no verify token is configured', async () => {
    delete process.env.META_WEBHOOK_VERIFY_TOKEN;
    const res = makeRes();
    await handler({ method: 'GET', query: { 'hub.mode': 'subscribe', 'hub.verify_token': '', 'hub.challenge': 'abc' } }, res);
    assert.equal(res.statusCode, 403);
  });
});
