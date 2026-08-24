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
const { checkRateLimit } = require('../../lib/rate-limit');

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
  for (const hint of hints) {
    try {
      // Flood guard: forged hints are cheap to send and each costs Graph +
      // Claude + SMS work downstream. Cap processing per page id.
      const { allowed } = await checkRateLimit(`metahook:${hint.pageId}`, 10, 60 * 1000);
      if (!allowed) {
        console.warn('[meta-webhook] rate limited page', hint.pageId);
        continue;
      }
      const result = await processCommentEvent(hint);
      console.log('[meta-webhook]', hint.platform, hint.commentId, '->', result);
    } catch (err) {
      console.error('[meta-webhook] processing failed:', err.message);
    }
  }
  // Always a bare 200: no per-hint results to the unauthenticated caller
  // (that would be an oracle for tuning a flood), and no non-200s that would
  // make Meta disable the subscription over transient errors.
  return res.status(200).send('OK');
};
