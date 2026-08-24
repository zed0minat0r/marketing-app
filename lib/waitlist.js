'use strict';

/**
 * Waitlist signup helpers — validation, phone normalization, and the
 * owner-notification email body. Pure functions; storage lives in the
 * api/waitlist.js handler.
 */

// Where signup notifications go. Override with NOTIFY_EMAIL in env.
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || 'mmodica3@gmail.com';

// The exact consent language shown beside the checkbox on the landing page.
// Stored with each row as TCPA evidence of what the person agreed to.
const CONSENT_LANGUAGE =
  'I agree to receive recurring SMS messages from Sidekick about my account, ' +
  'onboarding, and waitlist updates. Msg frequency varies. Msg & data rates may ' +
  'apply. Reply STOP to opt out, HELP for help.';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validateEmail(email) {
  return typeof email === 'string' && email.length <= 254 && EMAIL_RE.test(email.trim());
}

/**
 * Normalize a US/Canada phone number to E.164 (+1XXXXXXXXXX).
 * Returns null if it can't be normalized.
 */
function normalizePhone(raw) {
  if (typeof raw !== 'string') return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Build the owner-notification email for one signup.
 * Returns { to, subject, html }.
 */
function buildNotificationEmail(row, position) {
  const e = escapeHtml;
  const subject = `New Sidekick signup: ${row.email}`;
  const html = `
    <h2>New Sidekick waitlist signup</h2>
    <table cellpadding="4" style="border-collapse:collapse">
      <tr><td><strong>Email</strong></td><td>${e(row.email)}</td></tr>
      <tr><td><strong>Phone</strong></td><td>${e(row.phone)}</td></tr>
      <tr><td><strong>SMS consent</strong></td><td>${row.sms_consent ? 'YES (checkbox actively checked)' : 'NO'}</td></tr>
      <tr><td><strong>Plan interest</strong></td><td>${e(row.plan || 'none selected')}</td></tr>
      <tr><td><strong>Referred by</strong></td><td>${e(row.referred_by || 'direct')}</td></tr>
      <tr><td><strong>Their referral code</strong></td><td>${e(row.referral_code || '')}</td></tr>
      <tr><td><strong>Queue position</strong></td><td>#${Number(position)}</td></tr>
      <tr><td><strong>Signed up</strong></td><td>${e(row.consent_at || new Date().toISOString())}</td></tr>
    </table>
    <p style="color:#666;font-size:12px">Consent language shown at opt-in: ${e(CONSENT_LANGUAGE)}</p>
  `;
  return { to: NOTIFY_EMAIL, subject, html };
}

module.exports = {
  NOTIFY_EMAIL,
  CONSENT_LANGUAGE,
  validateEmail,
  normalizePhone,
  buildNotificationEmail,
};
