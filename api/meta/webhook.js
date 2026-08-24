'use strict';

/**
 * GET/POST /api/meta/webhook - Meta (Facebook/Instagram) webhook receiver.
 *
 * GET: subscription handshake - echoes hub.challenge when hub.verify_token
 * matches META_WEBHOOK_VERIFY_TOKEN.
 *
 * POST: comment notifications. The payload is treated as an UNTRUSTED HINT:
 * we never act on its content directly - we extract (platform, comment_id,
 * page_id) and re-fetch the comment from the Graph API with our own stored
 * page token. A forged event can only make us look up a comment on a page we
 * already manage. (Vercel pre-parses the JSON body, so the raw bytes needed
 * for X-Hub-Signature-256 verification aren't reliably available - the
 * re-fetch design makes the signature unnecessary for safety.)
 *
 * One-time setup (Meta app dashboard -> Webhooks): subscribe the app to
 * Page "feed" and Instagram "comments", callback URL = this endpoint, verify
 * token = META_WEBHOOK_VERIFY_TOKEN. Page-level subscription happens
 * automatically at OAuth time (subscribed_apps in meta-callback).
 */

const { extractCommentHints, processCommentEvent } = require('../../lib/comment-replies');

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    const expected = process.env.META_WEBHOOK_VERIFY_TOKEN;
    if (mode === 'subscribe' && expected && token === expected) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Forbidden');
  }

  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  const hints = extractCommentHints(req.body);
  const results = [];
  for (const hint of hints) {
    try {
      results.push({ ...hint, result: await processCommentEvent(hint) });
    } catch (err) {
      console.error('[meta-webhook] processing failed:', err.message);
      results.push({ ...hint, result: 'error' });
    }
  }
  // Always 200 so Meta doesn't disable the subscription over transient errors
  return res.status(200).json({ received: hints.length, results });
};
