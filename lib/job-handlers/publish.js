'use strict';

/**
 * POST /api/jobs/publish
 *
 * QStash fires this at the scheduled time to publish a post.
 * Validates QStash signature, loads the post, publishes it,
 * and texts the user confirmation or failure notice.
 */

const { publishPost } = require('../social-post');
const { getScheduledPost, getClient } = require('../supabase');
const { sendSms } = require('../sms-outbound');

/**
 * Verify Upstash QStash signature.
 * QStash signs the request body with HMAC-SHA256.
 */
async function verifyQStashSignature(req) {
  const currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextKey = process.env.QSTASH_NEXT_SIGNING_KEY;

  if (!currentKey && !nextKey) {
    // FAIL CLOSED in production - an unsigned publish trigger must never run.
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
      console.error('QStash signing keys not set in production - refusing request');
      return false;
    }
    console.warn('QSTASH signing keys not set - skipping signature verification (dev)');
    return true;
  }

  const signature = req.headers['upstash-signature'];
  if (!signature) return false;

  // QStash uses JWT-based signing — verify using the SDK if available,
  // otherwise fall back to basic verification
  try {
    const { Receiver } = require('@upstash/qstash');
    const receiver = new Receiver({
      currentSigningKey: currentKey,
      nextSigningKey: nextKey,
    });

    // Verify the RAW bytes QStash signed (router attaches req.rawBody);
    // re-serialized JSON is only a last-resort fallback.
    const rawBody = req.rawBody && req.rawBody.length
      ? req.rawBody.toString('utf8')
      : JSON.stringify(req.body);
    await receiver.verify({
      signature,
      body: rawBody,
    });
    return true;
  } catch (err) {
    // If QStash SDK not available, check if it's a known key format
    console.error('QStash signature verification failed:', err.message);
    return false;
  }
}

function formatPublishSuccessMessage(post, urls) {
  const urlLines = Object.entries(urls)
    .filter(([platform]) => platform !== 'instagram_media_id')
    .map(([platform, url]) => `${platform.charAt(0).toUpperCase() + platform.slice(1)}: ${url}`)
    .join('\n');

  return `Your post is now live!\n${urlLines}`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify QStash signature
  const isValid = await verifyQStashSignature(req);
  if (!isValid) {
    console.error('Invalid QStash signature');
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { post_id } = req.body || {};

  if (!post_id) {
    return res.status(400).json({ error: 'post_id is required' });
  }

  let post = null;
  let user = null;

  try {
    post = await getScheduledPost(post_id);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Idempotency check: if already posted or publishing, return early
    // This prevents double-publishing when QStash retries the same job
    if (post.status === 'posted') {
      console.log(`Idempotency: post ${post_id} already posted — skipping`);
      return res.status(200).json({ success: true, message: 'Already posted (idempotent)' });
    }
    if (post.status === 'publishing') {
      // Another invocation is in flight — check if it's stale (>5 min)
      const updatedAt = new Date(post.updated_at || 0);
      const staleCutoff = new Date(Date.now() - 5 * 60 * 1000);
      if (updatedAt > staleCutoff) {
        // 503 (not 200): if the in-flight attempt died mid-publish, a 200
        // here would mark the QStash message delivered and the post would be
        // stuck in 'publishing' forever. A 503 makes QStash retry after
        // backoff, by which time the row is either 'posted' (200 above) or
        // stale enough for the claim to recover it.
        console.log(`Idempotency: post ${post_id} is currently publishing - retry later`);
        return res.status(503).json({ success: false, message: 'Publishing in progress - retry' });
      }
      // Stale "publishing" status — reset and try again
      console.warn(`Post ${post_id} stuck in "publishing" for >5min — retrying`);
    }
    if (post.status === 'canceled') {
      return res.status(200).json({ success: false, message: 'Post was canceled' });
    }

    // Get user for SMS notification
    const { data: userData } = await getClient()
      .from('users')
      .select('phone, business_name')
      .eq('id', post.user_id)
      .single();
    user = userData;

    // Publish the post
    const result = await publishPost(post_id);

    if (result.alreadyPosted) {
      return res.status(200).json({ success: true, message: 'Already posted' });
    }
    if (result.alreadyPublishing) {
      // Same reasoning as above: let QStash retry rather than swallowing it.
      return res.status(503).json({ success: false, message: 'Publishing in progress - retry' });
    }

    // ONE combined result text: what went live, plus anything that failed
    if (user) {
      let msg = formatPublishSuccessMessage(post, result.urls);
      const failedEntries = Object.entries(result.errors || {});
      if (failedEntries.length > 0) {
        msg += `\n\nDidn't make it:\n${failedEntries.map(([p, e]) => `${p}: ${e}`).join('\n')}`;
      }
      await sendSms(user.phone, msg).catch(console.error);
    }

    return res.status(200).json({ success: true, urls: result.urls });

  } catch (err) {
    console.error('Publish job error:', err);

    // publishPost increments retry_count BEFORE throwing, so this attempt's
    // number is (stale row count + 1). Retry silently up to 3 attempts; only
    // the FINAL failure texts the user - retries must not spam near-identical
    // messages.
    const attemptsSoFar = (post?.retry_count || 0) + 1;
    if (post && attemptsSoFar < 3) {
      // Return 500 to trigger QStash retry
      return res.status(500).json({ error: err.message, retrying: true, attempt: attemptsSoFar });
    }

    // Final attempt failed - one honest message with the actual reason
    if (user) {
      await sendSms(user.phone,
        `Your post couldn't be published after ${attemptsSoFar} attempts. Reply YES to try again, or EDIT to change it. (${String(err.message).slice(0, 120)})`
      ).catch(console.error);
    }

    return res.status(200).json({ error: err.message, maxRetriesExceeded: true });
  }
};
