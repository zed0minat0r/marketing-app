'use strict';

/**
 * POST /api/jobs/publish
 *
 * QStash fires this at the scheduled time to publish a post.
 * Validates QStash signature, loads the post, publishes it,
 * and texts the user confirmation or failure notice.
 */

const { publishPost } = require('../../api/social/post');
const { getScheduledPost, getClient } = require('../supabase');
const { sendSms } = require('../../api/sms/outbound');

/**
 * Verify Upstash QStash signature.
 * QStash signs the request body with HMAC-SHA256.
 */
async function verifyQStashSignature(req) {
  const currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextKey = process.env.QSTASH_NEXT_SIGNING_KEY;

  if (!currentKey && !nextKey) {
    console.warn('QSTASH signing keys not set — skipping signature verification');
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

    const rawBody = JSON.stringify(req.body);
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
    .map(([platform, url]) => `${platform.charAt(0).toUpperCase() + platform.slice(1)}: ${url}`)
    .join('\n');

  return `Your post is now live!\n${urlLines}`;
}

function formatPublishFailureMessage(errors) {
  const errorLines = Object.entries(errors)
    .map(([platform, err]) => `${platform}: ${err}`)
    .join('\n');

  return `Post failed to publish:\n${errorLines}\n\nReply to try again or contact support.`;
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
        console.log(`Idempotency: post ${post_id} is currently publishing — skipping duplicate`);
        return res.status(200).json({ success: true, message: 'Publishing in progress (idempotent)' });
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

    // Text user success
    if (user) {
      const successMsg = formatPublishSuccessMessage(post, result.urls);
      await sendSms(user.phone, successMsg).catch(console.error);
    }

    // Handle partial failures
    if (Object.keys(result.errors || {}).length > 0) {
      const errorMsg = formatPublishFailureMessage(result.errors);
      if (user) {
        await sendSms(user.phone, `Note: Some platforms failed:\n${errorMsg}`).catch(console.error);
      }
    }

    return res.status(200).json({ success: true, urls: result.urls });

  } catch (err) {
    console.error('Publish job error:', err);

    // Check retry count — retry up to 3 times
    if (post && (post.retry_count || 0) < 3) {
      // Return 500 to trigger QStash retry
      return res.status(500).json({ error: err.message, retrying: true });
    }

    // Max retries exceeded — notify user
    if (user) {
      await sendSms(user.phone,
        `Your scheduled post failed after multiple attempts. Please try posting it manually.`
      ).catch(console.error);
    }

    return res.status(200).json({ error: err.message, maxRetriesExceeded: true });
  }
};
