'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');

const {
  validateEmail,
  normalizePhone,
  buildNotificationEmail,
  NOTIFY_EMAIL,
  CONSENT_LANGUAGE,
} = require('../lib/waitlist');

describe('validateEmail', () => {
  test('accepts normal addresses', () => {
    assert.equal(validateEmail('owner@shop.com'), true);
    assert.equal(validateEmail('a.b+tag@sub.domain.co'), true);
  });
  test('rejects junk', () => {
    assert.equal(validateEmail(''), false);
    assert.equal(validateEmail('not-an-email'), false);
    assert.equal(validateEmail('a@b'), false);
    assert.equal(validateEmail('a b@c.com'), false);
    assert.equal(validateEmail(null), false);
    assert.equal(validateEmail(undefined), false);
  });
});

describe('normalizePhone', () => {
  test('formats 10-digit US numbers to E.164', () => {
    assert.equal(normalizePhone('(484) 555-0123'), '+14845550123');
    assert.equal(normalizePhone('484-555-0123'), '+14845550123');
    assert.equal(normalizePhone('4845550123'), '+14845550123');
  });
  test('accepts 11 digits with leading 1', () => {
    assert.equal(normalizePhone('1 484 555 0123'), '+14845550123');
    assert.equal(normalizePhone('+1 (484) 555-0123'), '+14845550123');
  });
  test('rejects short, long, and non-string input', () => {
    assert.equal(normalizePhone('555-0123'), null);
    assert.equal(normalizePhone('123456789012'), null);
    assert.equal(normalizePhone(''), null);
    assert.equal(normalizePhone(null), null);
    assert.equal(normalizePhone(4845550123), null);
  });
});

describe('buildNotificationEmail', () => {
  const row = {
    email: 'owner@shop.com',
    phone: '+14845550123',
    sms_consent: true,
    consent_at: '2026-08-24T00:00:00.000Z',
    plan: 'starter',
    referred_by: 'abc123',
    referral_code: 'xyz789',
  };

  test('goes to the owner notification address', () => {
    const note = buildNotificationEmail(row, 7);
    assert.equal(note.to, NOTIFY_EMAIL);
  });
  test('subject names the signup email', () => {
    const note = buildNotificationEmail(row, 7);
    assert.ok(note.subject.includes('owner@shop.com'));
  });
  test('html carries every field and the consent language', () => {
    const note = buildNotificationEmail(row, 7);
    for (const needle of ['owner@shop.com', '+14845550123', 'starter', 'abc123', 'xyz789', '#7', 'YES']) {
      assert.ok(note.html.includes(needle), `missing ${needle}`);
    }
    assert.ok(note.html.includes(CONSENT_LANGUAGE.slice(0, 40)));
  });
  test('escapes html in user-controlled fields', () => {
    const evil = { ...row, email: '<script>x</script>@a.com', plan: '<img src=x>' };
    const note = buildNotificationEmail(evil, 1);
    assert.ok(!note.html.includes('<script>'));
    assert.ok(!note.html.includes('<img'));
  });
});
