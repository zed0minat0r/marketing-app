'use strict';

/**
 * GET/POST /api/meta/webhook - Meta (Facebook/Instagram) webhook receiver.
 *
 * GET: subscription handshake - echoes hub.challenge when hub.verify_token
 * matches META_WEBHOOK_VERIFY_TOKEN.
 *
 * POST: comment notifications. TWO independent defences, because either alone is weaker:
 *
 *   1. X-HUB-SIGNATURE-256 IS VERIFIED. Meta signs the raw bytes with the app secret. This file used
 *      to skip it, on the reasoning that Vercel pre-parses the body so the raw bytes are not
 *      available. That was true once and is not true here any more: api/jobs/[action].js already
 *      disables bodyParser and reads the stream itself for QStash, and this route now does the same.
 *      Meta's own guidance is that validating is not mandatory but you should - and "we verify the
 *      signature" is a better answer at App Review than an explanation of why we do not.
 *
 *   2. The payload is still treated as an UNTRUSTED HINT even after the signature passes: we take
 *      only (platform, comment_id, page_id) and re-fetch the comment from the Graph API with our own
 *      stored page token. Signature verification protects the budget; the re-fetch protects the
 *      content. Keep both.
 *
 * One-time setup (Meta app dashboard -> Webhooks): subscribe the app to
 * Page "feed" and Instagram "comments", callback URL = this endpoint, verify
 * token = META_WEBHOOK_VERIFY_TOKEN. Page-level subscription happens
 * automatically at OAuth time (subscribed_apps in meta-callback).
 */

const crypto = require('crypto');
const { extractCommentHints, processCommentEvent } = require('../../lib/comment-replies');
const { checkRateLimit } = require('../../lib/rate-limit');

/** Raw request bytes. Meta signs these, so a re-serialized body can differ and fail on a byte. */
async function readRawBody(req) {
  if (req.body instanceof Buffer) return req.body;
  if (req.body && typeof req.body === 'object') return Buffer.from(JSON.stringify(req.body));
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

/** Constant-time compare of Meta's sha256= header against an HMAC of the raw body. */
function signatureValid(raw, header, secret) {
  if (typeof header !== 'string' || !header.startsWith('sha256=')) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(raw).digest('hex');
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

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

  const raw = await readRawBody(req);
  const secret = process.env.META_APP_SECRET;

  if (secret) {
    if (!signatureValid(raw, req.headers?.['x-hub-signature-256'], secret)) {
      console.warn('[meta-webhook] rejected: bad or missing X-Hub-Signature-256');
      return res.status(403).send('Forbidden');
    }
  } else {
    // FAIL OPEN, DELIBERATELY, AND ONLY HERE. Without the secret nothing can be verified, and
    // rejecting would silently kill comment replies during setup - a worse failure than the one this
    // guards against, and harder to diagnose. META_APP_SECRET is in config-check's required list, so
    // this state is a misconfiguration that shows up there rather than something to discover here.
    console.error('[meta-webhook] META_APP_SECRET is not set - processing UNVERIFIED payload');
  }

  let payload = {};
  try {
    payload = raw.length ? JSON.parse(raw.toString('utf8')) : {};
  } catch {
    return res.status(200).send('OK');   // unparseable: ack so Meta does not disable the subscription
  }

  const hints = extractCommentHints(payload);
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
      const { reportError } = require('../../lib/monitor');
      await reportError('meta-webhook', err, { commentId: hint.commentId }).catch(() => {});
    }
  }
  // Always a bare 200: no per-hint results to the unauthenticated caller
  // (that would be an oracle for tuning a flood), and no non-200s that would
  // make Meta disable the subscription over transient errors.
  return res.status(200).send('OK');
};

// Meta signs the raw bytes - Vercel's parser would consume them before we could check.
module.exports.config = { api: { bodyParser: false } };
