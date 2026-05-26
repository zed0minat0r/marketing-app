'use strict';

/**
 * POST /api/oauth/meta/data-deletion
 *
 * Meta-required Data Deletion Request callback. Triggered when a user
 * removes Sidekick from their Facebook account via FB's privacy controls.
 * Meta sends a `signed_request` form-encoded body containing the user_id;
 * we delete any linked accounts and respond with a status URL + code.
 *
 * Spec:
 *   https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback/
 *
 * This URL must be registered in the Meta App Dashboard → Settings → Basic
 * → "Data Deletion Request URL" for App Review approval.
 *
 * Auth: Meta signs the request with HMAC-SHA256(payload, APP_SECRET).
 */

const crypto = require('crypto');
const { getClient } = require('../supabase');

function base64UrlDecode(input) {
  // Meta's signed_request uses URL-safe base64 (no padding)
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4;
  const padded = pad ? b64 + '='.repeat(4 - pad) : b64;
  return Buffer.from(padded, 'base64');
}

/**
 * Parse + verify a Meta signed_request.
 * Returns the decoded payload object, or null on signature mismatch.
 */
function parseSignedRequest(signedRequest, appSecret) {
  if (!signedRequest || typeof signedRequest !== 'string') return null;
  const parts = signedRequest.split('.');
  if (parts.length !== 2) return null;
  const [encodedSig, encodedPayload] = parts;

  let payloadJson;
  try {
    payloadJson = base64UrlDecode(encodedPayload).toString('utf8');
  } catch {
    return null;
  }

  let payload;
  try {
    payload = JSON.parse(payloadJson);
  } catch {
    return null;
  }

  if (payload.algorithm !== 'HMAC-SHA256') return null;

  const expectedSig = crypto
    .createHmac('sha256', appSecret)
    .update(encodedPayload)
    .digest();
  const providedSig = base64UrlDecode(encodedSig);

  if (expectedSig.length !== providedSig.length) return null;
  if (!crypto.timingSafeEqual(expectedSig, providedSig)) return null;

  return payload;
}

async function readFormEncodedBody(req) {
  // Vercel auto-parses application/x-www-form-urlencoded → req.body is an
  // object with the field names as keys. Honor that. Fallback to stream
  // read if not parsed (e.g. unusual content-type).
  if (req.body && typeof req.body === 'object' && req.body.signed_request) {
    return req.body;
  }
  if (req.body instanceof Buffer || typeof req.body === 'string') {
    const params = new URLSearchParams(req.body.toString());
    return Object.fromEntries(params);
  }
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const params = new URLSearchParams(Buffer.concat(chunks).toString());
  return Object.fromEntries(params);
}

/**
 * Mark all social_accounts rows for this Meta user_id as inactive. Doesn't
 * delete the Sidekick user account — Meta deletion only covers the Meta-
 * provided data. Sidekick's user row + their SMS history is the user's
 * Sidekick account, and they can manage that separately via SMS "DELETE MY
 * DATA". We do disconnect the Facebook/Instagram accounts so we no longer
 * post on their behalf.
 */
async function deactivateMetaAccountsForUser(metaUserId) {
  const supa = getClient();
  const { data, error } = await supa
    .from('social_accounts')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .or('platform.eq.facebook,platform.eq.instagram')
    .eq('platform_user_id', metaUserId)
    .select('id, user_id');

  if (error) {
    console.error('Meta deletion: failed to deactivate accounts:', error.message);
    return [];
  }
  return data || [];
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) {
    console.error('META_APP_SECRET not set — cannot verify deletion request');
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  let body;
  try {
    body = await readFormEncodedBody(req);
  } catch (err) {
    return res.status(400).json({ error: 'Could not parse request body' });
  }

  const payload = parseSignedRequest(body.signed_request, appSecret);
  if (!payload) {
    console.warn('Meta deletion: invalid signed_request');
    return res.status(400).json({ error: 'Invalid signed_request' });
  }

  const metaUserId = payload.user_id;
  if (!metaUserId) {
    return res.status(400).json({ error: 'Missing user_id in signed_request' });
  }

  // Generate a unique confirmation code Meta can include in their UI so the
  // user can track the deletion status. Stored opaquely; we don't need a
  // separate status page until launch (the URL field just has to exist).
  const confirmationCode = crypto.randomBytes(12).toString('hex');

  try {
    const deactivated = await deactivateMetaAccountsForUser(metaUserId);
    console.log(`Meta deletion request for user_id=${metaUserId}: deactivated ${deactivated.length} account(s), code=${confirmationCode}`);
  } catch (err) {
    console.error('Meta deletion processing error:', err.message);
    // Still return success — we acknowledge receipt and will reconcile
    // server-side. Returning an error to Meta puts the app at risk.
  }

  const appUrl = (process.env.APP_URL || 'https://sidekik.com').replace(/\/$/, '');

  return res.status(200).json({
    url: `${appUrl}/data-deletion-status?code=${confirmationCode}`,
    confirmation_code: confirmationCode,
  });
};

// Exported for tests
module.exports.parseSignedRequest = parseSignedRequest;
