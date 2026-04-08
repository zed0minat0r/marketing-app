'use strict';

/**
 * AES-256-GCM encryption/decryption for sensitive data (OAuth tokens).
 * Requires ENCRYPTION_KEY env var — 64 hex chars (32 bytes).
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;   // 96-bit IV recommended for GCM
const TAG_LENGTH = 16;  // 128-bit auth tag

function getKey() {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex) throw new Error('ENCRYPTION_KEY env var is required');
  if (hex.length !== 64) throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  return Buffer.from(hex, 'hex');
}

/**
 * Encrypt plaintext string.
 * Returns a colon-delimited string: iv:authTag:ciphertext (all hex).
 *
 * @param {string} plaintext
 * @returns {string} encrypted payload
 */
function encrypt(plaintext) {
  if (plaintext == null) return null;

  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(String(plaintext), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    iv.toString('hex'),
    tag.toString('hex'),
    encrypted.toString('hex'),
  ].join(':');
}

/**
 * Decrypt an encrypted payload produced by encrypt().
 *
 * @param {string} payload - iv:authTag:ciphertext (hex)
 * @returns {string} plaintext
 */
function decrypt(payload) {
  if (payload == null) return null;

  const parts = payload.split(':');
  if (parts.length !== 3) {
    // Not an encrypted payload (legacy plain token) — return as-is
    return payload;
  }

  const [ivHex, tagHex, encryptedHex] = parts;
  const key = getKey();
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const encryptedData = Buffer.from(encryptedHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(encryptedData),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

module.exports = { encrypt, decrypt };
