'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { extractMedia, fetchTwilioMedia, ALLOWED_MIME, MAX_FILE_BYTES } = require('../lib/photo-intake');

test('extractMedia — empty / no media', () => {
  assert.deepStrictEqual(extractMedia({}), []);
  assert.deepStrictEqual(extractMedia({ NumMedia: '0' }), []);
  assert.deepStrictEqual(extractMedia({ NumMedia: 'abc' }), []);
});

test('extractMedia — single attachment', () => {
  const body = {
    NumMedia: '1',
    MediaUrl0: 'https://api.twilio.com/2010/Messages/MM123/Media/ME123',
    MediaContentType0: 'image/jpeg',
  };
  assert.deepStrictEqual(extractMedia(body), [
    {
      url: 'https://api.twilio.com/2010/Messages/MM123/Media/ME123',
      mimeType: 'image/jpeg',
    },
  ]);
});

test('extractMedia — multiple attachments preserve order', () => {
  const body = {
    NumMedia: '3',
    MediaUrl0: 'https://twilio.test/a',
    MediaContentType0: 'image/jpeg',
    MediaUrl1: 'https://twilio.test/b',
    MediaContentType1: 'image/png',
    MediaUrl2: 'https://twilio.test/c',
    MediaContentType2: 'image/heic',
  };
  const out = extractMedia(body);
  assert.strictEqual(out.length, 3);
  assert.strictEqual(out[0].url, 'https://twilio.test/a');
  assert.strictEqual(out[1].mimeType, 'image/png');
  assert.strictEqual(out[2].mimeType, 'image/heic');
});

test('extractMedia — mime is lowercased', () => {
  const body = {
    NumMedia: '1',
    MediaUrl0: 'https://twilio.test/x',
    MediaContentType0: 'IMAGE/JPEG',
  };
  assert.strictEqual(extractMedia(body)[0].mimeType, 'image/jpeg');
});

test('ALLOWED_MIME — accepts common image formats', () => {
  for (const mime of ['image/jpeg', 'image/png', 'image/heic', 'image/webp']) {
    assert.strictEqual(ALLOWED_MIME.has(mime), true, `${mime} should be allowed`);
  }
});

test('ALLOWED_MIME — rejects non-image formats', () => {
  for (const mime of ['application/pdf', 'video/mp4', 'text/plain', 'application/octet-stream']) {
    assert.strictEqual(ALLOWED_MIME.has(mime), false, `${mime} should be rejected`);
  }
});

test('MAX_FILE_BYTES — 10MB cap', () => {
  assert.strictEqual(MAX_FILE_BYTES, 10 * 1024 * 1024);
});

// Mock global fetch for fetchTwilioMedia tests
const realFetch = globalThis.fetch;
function withMockFetch(impl, fn) {
  globalThis.fetch = impl;
  return fn().finally(() => { globalThis.fetch = realFetch; });
}

test('fetchTwilioMedia — rejects OVERSIZED via Content-Length', async () => {
  await withMockFetch(
    async () => ({
      ok: true,
      headers: { get: (k) => k === 'content-length' ? String(MAX_FILE_BYTES + 1) : null },
      arrayBuffer: async () => { throw new Error('should not reach arrayBuffer'); },
    }),
    async () => {
      await assert.rejects(
        fetchTwilioMedia('https://twilio.test/oversized.jpg', 'image/jpeg'),
        err => err.code === 'OVERSIZED'
      );
    }
  );
});

test('fetchTwilioMedia — rejects EMPTY (0-byte body)', async () => {
  await withMockFetch(
    async () => ({
      ok: true,
      headers: { get: (k) => k === 'content-length' ? '0' : 'image/jpeg' },
      arrayBuffer: async () => new ArrayBuffer(0),
    }),
    async () => {
      await assert.rejects(
        fetchTwilioMedia('https://twilio.test/empty.jpg', 'image/jpeg'),
        err => err.code === 'EMPTY'
      );
    }
  );
});

test('fetchTwilioMedia — rejects oversized even when Content-Length lies', async () => {
  // Content-Length says 100 bytes but body is actually 11MB
  const fakeBig = new ArrayBuffer(MAX_FILE_BYTES + 1);
  await withMockFetch(
    async () => ({
      ok: true,
      headers: { get: (k) => k === 'content-length' ? '100' : 'image/jpeg' },
      arrayBuffer: async () => fakeBig,
    }),
    async () => {
      await assert.rejects(
        fetchTwilioMedia('https://twilio.test/lies.jpg', 'image/jpeg'),
        err => err.code === 'OVERSIZED'
      );
    }
  );
});

test('fetchTwilioMedia — happy path returns buffer + mime', async () => {
  const bytes = Buffer.from('FAKEJPEG');
  await withMockFetch(
    async () => ({
      ok: true,
      headers: {
        get: (k) => k === 'content-length' ? String(bytes.length)
                  : k === 'content-type' ? 'image/jpeg'
                  : null,
      },
      arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    }),
    async () => {
      const out = await fetchTwilioMedia('https://twilio.test/ok.jpg', 'image/jpeg');
      assert.strictEqual(out.buffer.length, bytes.length);
      assert.strictEqual(out.mimeType, 'image/jpeg');
    }
  );
});

test('fetchTwilioMedia — throws on non-2xx', async () => {
  await withMockFetch(
    async () => ({ ok: false, status: 502, headers: { get: () => null }, arrayBuffer: async () => new ArrayBuffer(0) }),
    async () => {
      await assert.rejects(
        fetchTwilioMedia('https://twilio.test/bad.jpg', 'image/jpeg'),
        /Twilio media fetch failed: 502/
      );
    }
  );
});
