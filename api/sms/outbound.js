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
 * Send an SMS message via Twilio.
 *
 * @param {string} to - E.164 phone number (e.g., "+14845551234")
 * @param {string} body - Message text (up to 1600 chars for MMS, 160 for single SMS)
 * @returns {Promise<{sid: string, status: string}>}
 */
async function sendSms(to, body) {
  const client = getTwilioClient();
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!from) throw new Error('TWILIO_PHONE_NUMBER must be set');
  if (!to) throw new Error('Recipient phone number is required');
  if (!body) throw new Error('Message body is required');

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
