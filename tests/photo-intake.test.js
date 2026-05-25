'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { extractMedia, ALLOWED_MIME, MAX_FILE_BYTES } = require('../lib/photo-intake');

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
