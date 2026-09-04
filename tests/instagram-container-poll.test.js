'use strict';

/**
 * Instagram publishing waits for the container to finish processing.
 *
 * Publishing to Instagram is THREE calls: create the container, poll it until status_code is
 * FINISHED, then publish. The middle call was missing - the code created a container and published
 * it immediately. That usually works for a small image, which is why it survived; it fails when
 * Instagram is still transcoding, and it fails more as media gets bigger or the service gets busier.
 *
 * A mock that answers FINISHED on the first poll does not test anything, so these drive the states
 * that actually matter: a container that is still IN_PROGRESS, and one that fails outright.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { postToInstagram } = require('../lib/social-post');

const realFetch = globalThis.fetch;

/** @param statuses - status_code returned by each successive poll */
function mockGraph(statuses, { onPublish } = {}) {
  const calls = { status: 0, publish: 0 };
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('fields=status_code')) {
      const code = statuses[Math.min(calls.status, statuses.length - 1)];
      calls.status += 1;
      return { ok: true, json: async () => ({ status_code: code }) };
    }
    if (u.includes('/media_publish')) {
      calls.publish += 1;
      if (onPublish) onPublish();
      return { ok: true, json: async () => ({ id: '17900012345' }) };
    }
    if (u.includes('fields=permalink')) {
      return { ok: true, json: async () => ({ permalink: 'https://www.instagram.com/p/DAbCd123/' }) };
    }
    if (u.includes('/media')) {
      return { ok: true, json: async () => ({ id: 'container1' }) };
    }
    return { ok: false, status: 500, json: async () => ({ error: { message: 'unmocked ' + u } }) };
  };
  return calls;
}

test.after(() => { globalThis.fetch = realFetch; });

test('polls until FINISHED before publishing, and does not publish early', async () => {
  const calls = mockGraph(['IN_PROGRESS', 'IN_PROGRESS', 'FINISHED'], {
    onPublish: () => {
      // The publish call must not happen until the container reports FINISHED.
      assert.equal(calls.status, 3, 'published before the container was ready');
    },
  });

  const out = await postToInstagram('ig1', 'tok', 'caption', 'https://example.com/a.jpg');

  assert.equal(calls.status, 3, 'should have polled three times');
  assert.equal(calls.publish, 1, 'should publish exactly once');
  assert.match(out.url || out, /instagram\.com\/p\//);
});

test('throws instead of publishing when the container errors', async () => {
  const calls = mockGraph(['IN_PROGRESS', 'ERROR']);

  await assert.rejects(
    () => postToInstagram('ig1', 'tok', 'caption', 'https://example.com/a.jpg'),
    /container ERROR/,
  );
  assert.equal(calls.publish, 0, 'must not publish a container that failed');
});

test('does not hang when the API returns no status_code at all', async () => {
  const calls = mockGraph([undefined]);
  await postToInstagram('ig1', 'tok', 'caption', 'https://example.com/a.jpg');
  assert.equal(calls.publish, 1, 'a missing status field should not block publishing');
});
