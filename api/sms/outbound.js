'use strict';

/**
 * POST /api/sms/outbound
 *
 * Internal SMS sender. Sends a message via Twilio REST API.
 * Not publicly accessible — called from other Vercel functions.
 *
 * Body: { to: "+1...", body: "..." }
 */

const twilio = require('twilio');
const { requireInternalAuth } = require('../../lib/internal-auth');
const { getClient: getSupabase } = require('../../lib/supabase');

let _client = null;

function getTwilioClient() {
  if (!_client) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!accountSid || !authToken) {
      throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set');
    }
    _client = twilio(accountSid, authToken);
  }
  return _client;
}

/**
 * Check if a recipient is currently opted out. Reads `opted_out_at` on the
 * `users` row matching the phone. Returns false on miss / DB error so we
 * never block sending due to a transient lookup issue.
 *
 * Bypassed entirely for compliance-required messages (STOP / HELP / START
 * replies) by passing { force: true } to sendSms.
 */
async function isOptedOut(toPhone) {
  try {
    const { data, error } = await getSupabase()
      .from('users')
      .select('opted_out_at')
      .eq('phone', toPhone)
      .single();
    if (error || !data) return false;
    return Boolean(data.opted_out_at);
  } catch {
    return false;
  }
}

/**
 * Send an SMS message via Twilio.
 *
 * @param {string} to - E.164 phone number (e.g., "+14845551234")
 * @param {string} body - Message text (up to 1600 chars for MMS, 160 for single SMS)
 * @param {Object} [opts]
 * @param {boolean} [opts.force=false] - bypass opt-out gate (used only for the
 *   STOP/HELP/START compliance acknowledgments themselves)
 * @returns {Promise<{sid: string, status: string, skipped?: boolean}>}
 */
async function sendSms(to, body, opts = {}) {
  if (!to) throw new Error('Recipient phone number is required');
  if (!body) throw new Error('Message body is required');

  // Honor opt-out unless explicitly forced (compliance acks).
  if (!opts.force && await isOptedOut(to)) {
    console.log(`Skipping SMS to ${to} — user is opted out`);
    return { sid: null, status: 'skipped_optout', skipped: true };
  }

  const client = getTwilioClient();
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!from) throw new Error('TWILIO_PHONE_NUMBER must be set');

  // Trim to 1600 chars (Twilio MMS limit; 4 SMS segments)
  const trimmedBody = body.slice(0, 1600);

  const message = await client.messages.create({
    from,
    to,
    body: trimmedBody,
  });

  return {
    sid: message.sid,
    status: message.status,
  };
}

// Vercel serverless handler (for internal use)
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Internal endpoints require shared-secret auth
  if (!requireInternalAuth(req, res)) return;

  const { to, body } = req.body || {};

  if (!to || !body) {
    return res.status(400).json({ error: 'to and body are required' });
  }

  try {
    const result = await sendSms(to, body);
    return res.status(200).json(result);
  } catch (err) {
    console.error('SMS send error:', err);
    return res.status(500).json({ error: err.message });
  }
};

// Export the sendSms function for direct use from other modules
module.exports.sendSms = sendSms;
