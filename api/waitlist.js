'use strict';

/**
 * POST /api/waitlist — store a landing-page signup and notify the owner.
 *
 * Body (JSON): {
 *   email:        string  (required)
 *   phone:        string  (required — any US format, normalized to E.164)
 *   consent:      boolean (required — must be true; the SMS checkbox)
 *   plan:         string  (optional — starter/growth/pro)
 *   ref:          string  (optional — ?ref= code that brought them here)
 *   referralCode: string  (optional — this signup's own shareable code)
 * }
 *
 * Returns: { ok: true, position } — position is the real row count.
 * The notification email is best-effort: a signup is never rejected
 * because email sending failed.
 *
 * CORS: the form is served from GitHub Pages and the Vercel domain.
 */

const { getClient } = require('../lib/supabase');
const { sendEmail } = require('../lib/email');
const { checkRateLimit } = require('../lib/rate-limit');
const {
  CONSENT_LANGUAGE,
  validateEmail,
  normalizePhone,
  buildNotificationEmail,
} = require('../lib/waitlist');

const ALLOWED_ORIGINS = [
  'https://zed0minat0r.github.io',
  'https://marketing-app-navy.vercel.app',
];

function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    'unknown';
  const limit = await checkRateLimit(`waitlist:${ip}`, 10, 60 * 1000);
  if (!limit.allowed) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const body = req.body || {};
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const phone = normalizePhone(body.phone || '');

  if (!validateEmail(email)) {
    return res.status(400).json({ error: 'Enter a valid email address' });
  }
  if (!phone) {
    return res.status(400).json({ error: 'Enter a valid US phone number' });
  }
  if (body.consent !== true) {
    return res.status(400).json({ error: 'SMS consent is required' });
  }

  const row = {
    email,
    phone,
    sms_consent: true,
    consent_language: CONSENT_LANGUAGE,
    consent_at: new Date().toISOString(),
    plan: typeof body.plan === 'string' && body.plan ? body.plan.slice(0, 32) : null,
    referred_by: typeof body.ref === 'string' && body.ref ? body.ref.slice(0, 32) : null,
    referral_code: typeof body.referralCode === 'string' && body.referralCode ? body.referralCode.slice(0, 32) : null,
    source: 'landing',
  };

  let position;
  try {
    const db = getClient();
    const { error: upsertError } = await db
      .from('waitlist')
      .upsert(row, { onConflict: 'phone' });
    if (upsertError) throw upsertError;

    const { count, error: countError } = await db
      .from('waitlist')
      .select('*', { count: 'exact', head: true });
    if (countError) throw countError;
    position = count;
  } catch (err) {
    console.error('[waitlist] storage failed:', err.message);
    return res.status(500).json({ error: 'Could not save your signup — please try again' });
  }

  let emailSent = false;
  try {
    const note = buildNotificationEmail(row, position);
    const result = await sendEmail(note.to, note.subject, note.html);
    emailSent = !!result.ok;
    if (!result.ok) console.error('[waitlist] notification email failed:', result.error);
  } catch (err) {
    console.error('[waitlist] notification email threw:', err.message);
  }

  return res.status(200).json({ ok: true, position, emailSent });
};
