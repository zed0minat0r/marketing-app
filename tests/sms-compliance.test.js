'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { resolveComplianceAction, COMPLIANCE_REPLIES } = require('../lib/sms-compliance');

test('resolveComplianceAction — STOP keywords', () => {
  for (const kw of ['STOP', 'stop', 'Stop', 'STOPALL', 'UNSUBSCRIBE', 'unsub', 'CANCEL', 'END', 'QUIT', 'optout', 'OPT-OUT']) {
    assert.strictEqual(resolveComplianceAction(kw), 'stop', `${kw} should resolve to stop`);
  }
});

test('resolveComplianceAction — START keywords', () => {
  for (const kw of ['START', 'start', 'Unstop', 'OPTIN', 'opt-in']) {
    assert.strictEqual(resolveComplianceAction(kw), 'start', `${kw} should resolve to start`);
  }
});

test('resolveComplianceAction — HELP keywords', () => {
  for (const kw of ['HELP', 'help', 'INFO', 'support']) {
    assert.strictEqual(resolveComplianceAction(kw), 'help', `${kw} should resolve to help`);
  }
});

test('resolveComplianceAction — YES is ambiguous, returns null', () => {
  // YES is technically a CTIA-listed opt-in but we use it for draft approval.
  // Returning null lets the regular flow handle it.
  assert.strictEqual(resolveComplianceAction('YES'), null);
  assert.strictEqual(resolveComplianceAction('yes'), null);
});

test('resolveComplianceAction — keyword with extra args does NOT match', () => {
  // "CANCEL 1" must NOT trigger opt-out — that's our scheduled-post cancel.
  assert.strictEqual(resolveComplianceAction('CANCEL 1'), null);
  assert.strictEqual(resolveComplianceAction('STOP it now'), null);
  assert.strictEqual(resolveComplianceAction('help me with my account'), null);
});

test('resolveComplianceAction — trailing punctuation accepted', () => {
  assert.strictEqual(resolveComplianceAction('STOP.'), 'stop');
  assert.strictEqual(resolveComplianceAction('HELP!'), 'help');
  assert.strictEqual(resolveComplianceAction('Stop?'), 'stop');
});

test('resolveComplianceAction — whitespace trimmed', () => {
  assert.strictEqual(resolveComplianceAction('  STOP  '), 'stop');
  assert.strictEqual(resolveComplianceAction('\nHELP\n'), 'help');
});

test('resolveComplianceAction — empty / null returns null', () => {
  assert.strictEqual(resolveComplianceAction(''), null);
  assert.strictEqual(resolveComplianceAction(null), null);
  assert.strictEqual(resolveComplianceAction(undefined), null);
});

test('resolveComplianceAction — unrelated text returns null', () => {
  assert.strictEqual(resolveComplianceAction('Write a post about pizza'), null);
  assert.strictEqual(resolveComplianceAction('What can you do?'), null);
});

test('COMPLIANCE_REPLIES — all required disclosures present', () => {
  // STOP reply: confirm opt-out + opt-in hint + help info
  assert.match(COMPLIANCE_REPLIES.stop, /unsubscribed|opt(ed)? out/i);
  assert.match(COMPLIANCE_REPLIES.stop, /START/);
  assert.match(COMPLIANCE_REPLIES.stop, /HELP/);

  // START reply: welcome back + cost notice + opt-out hint
  assert.match(COMPLIANCE_REPLIES.start, /STOP/);
  assert.match(COMPLIANCE_REPLIES.start, /msg.*data rates|rates may apply/i);

  // HELP reply: brand + support contact + opt-out + cost notice
  assert.match(COMPLIANCE_REPLIES.help, /Sidekick/i);
  assert.match(COMPLIANCE_REPLIES.help, /STOP/);
  assert.match(COMPLIANCE_REPLIES.help, /msg.*data rates|rates may apply/i);
});
