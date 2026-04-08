'use strict';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

// We need a valid ENCRYPTION_KEY (64 hex chars = 32 bytes) set before loading the module
const VALID_KEY = 'a'.repeat(64); // 64 hex 'a' chars = 32 bytes
const WRONG_KEY = 'b'.repeat(64);

// Helper to load crypto with a specific key (fresh require)
function loadCrypto(key) {
  // Clear the cached module so we get a fresh load
  const resolved = require.resolve('../lib/crypto');
  delete require.cache[resolved];
  if (key !== undefined) {
    process.env.ENCRYPTION_KEY = key;
  } else {
    delete process.env.ENCRYPTION_KEY;
  }
  return require('../lib/crypto');
}

describe('encrypt / decrypt roundtrip', () => {
  let encrypt, decrypt;

  beforeEach(() => {
    ({ encrypt, decrypt } = loadCrypto(VALID_KEY));
  });

  afterEach(() => {
    delete process.env.ENCRYPTION_KEY;
    delete require.cache[require.resolve('../lib/crypto')];
  });

  test('roundtrip: short string', () => {
    const plain = 'hello';
    assert.equal(decrypt(encrypt(plain)), plain);
  });

  test('roundtrip: long string', () => {
    const plain = 'a'.repeat(1000);
    assert.equal(decrypt(encrypt(plain)), plain);
  });

  test('roundtrip: empty string', () => {
    const plain = '';
    assert.equal(decrypt(encrypt(plain)), plain);
  });

  test('roundtrip: special characters', () => {
    const plain = '!@#$%^&*()_+{}[]|":<>?,./;\'\\`~';
    assert.equal(decrypt(encrypt(plain)), plain);
  });

  test('roundtrip: unicode / emoji', () => {
    const plain = 'Hello 🌎 こんにちは';
    assert.equal(decrypt(encrypt(plain)), plain);
  });

  test('roundtrip: newlines and tabs', () => {
    const plain = 'line1\nline2\ttabbed';
    assert.equal(decrypt(encrypt(plain)), plain);
  });

  test('roundtrip: OAuth token format', () => {
    const plain = 'EAABwzLixnjYBO1234567890abcdefghijklmnopqrstuvwxyz';
    assert.equal(decrypt(encrypt(plain)), plain);
  });

  test('roundtrip: JSON string', () => {
    const plain = JSON.stringify({ access_token: 'abc123', expires_in: 3600 });
    assert.equal(decrypt(encrypt(plain)), plain);
  });
});

describe('encrypt output format', () => {
  let encrypt, decrypt;

  beforeEach(() => {
    ({ encrypt, decrypt } = loadCrypto(VALID_KEY));
  });

  afterEach(() => {
    delete process.env.ENCRYPTION_KEY;
    delete require.cache[require.resolve('../lib/crypto')];
  });

  test('encrypted output differs from plaintext', () => {
    const plain = 'my-secret-token';
    const enc = encrypt(plain);
    assert.notEqual(enc, plain);
  });

  test('encrypted output has iv:tag:ciphertext format (3 colon-delimited parts)', () => {
    const enc = encrypt('test');
    const parts = enc.split(':');
    assert.equal(parts.length, 3);
  });

  test('iv is 24 hex chars (12 bytes)', () => {
    const enc = encrypt('test');
    const [iv] = enc.split(':');
    assert.equal(iv.length, 24);
    assert.match(iv, /^[0-9a-f]+$/);
  });

  test('auth tag is 32 hex chars (16 bytes)', () => {
    const enc = encrypt('test');
    const [, tag] = enc.split(':');
    assert.equal(tag.length, 32);
    assert.match(tag, /^[0-9a-f]+$/);
  });

  test('each encryption produces different ciphertext (random IV)', () => {
    const plain = 'same text';
    const enc1 = encrypt(plain);
    const enc2 = encrypt(plain);
    assert.notEqual(enc1, enc2);
  });
});

describe('null / undefined handling', () => {
  let encrypt, decrypt;

  beforeEach(() => {
    ({ encrypt, decrypt } = loadCrypto(VALID_KEY));
  });

  afterEach(() => {
    delete process.env.ENCRYPTION_KEY;
    delete require.cache[require.resolve('../lib/crypto')];
  });

  test('encrypt(null) returns null', () => {
    assert.equal(encrypt(null), null);
  });

  test('decrypt(null) returns null', () => {
    assert.equal(decrypt(null), null);
  });

  test('decrypt of non-encrypted payload returns as-is (legacy token)', () => {
    // A plain token without colons (or with wrong number of colons) should pass through
    const plain = 'legacy-token-no-colons';
    assert.equal(decrypt(plain), plain);
  });
});

describe('wrong key / tampered data', () => {
  afterEach(() => {
    delete process.env.ENCRYPTION_KEY;
    delete require.cache[require.resolve('../lib/crypto')];
  });

  test('decrypting with wrong key throws (GCM auth tag mismatch)', () => {
    const { encrypt: enc1 } = loadCrypto(VALID_KEY);
    const ciphertext = enc1('secret');

    const { decrypt: dec2 } = loadCrypto(WRONG_KEY);
    assert.throws(() => dec2(ciphertext));
  });

  test('tampered ciphertext throws', () => {
    const { encrypt, decrypt } = loadCrypto(VALID_KEY);
    const enc = encrypt('secret');
    const parts = enc.split(':');
    // Flip last char of ciphertext
    parts[2] = parts[2].slice(0, -1) + (parts[2].slice(-1) === 'a' ? 'b' : 'a');
    assert.throws(() => decrypt(parts.join(':')));
  });
});

describe('missing ENCRYPTION_KEY', () => {
  afterEach(() => {
    delete process.env.ENCRYPTION_KEY;
    delete require.cache[require.resolve('../lib/crypto')];
  });

  test('encrypt throws without ENCRYPTION_KEY', () => {
    const { encrypt } = loadCrypto(undefined);
    assert.throws(() => encrypt('test'), /ENCRYPTION_KEY/);
  });

  test('decrypt throws without ENCRYPTION_KEY for encrypted payload', () => {
    // First encrypt with valid key
    const { encrypt } = loadCrypto(VALID_KEY);
    const enc = encrypt('test');

    // Then try to decrypt without key
    const { decrypt } = loadCrypto(undefined);
    assert.throws(() => decrypt(enc), /ENCRYPTION_KEY/);
  });

  test('wrong key length throws', () => {
    const { encrypt } = loadCrypto('abc'); // too short
    assert.throws(() => encrypt('test'), /64 hex/);
  });
});
