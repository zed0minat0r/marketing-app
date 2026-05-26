'use strict';

/**
 * QStash publisher — the OUTBOUND side of QStash.
 *
 * Until now the codebase only consumed QStash (verifying inbound signatures
 * on /api/jobs/* handlers). Nothing was publishing TO QStash, which meant
 * scheduled_posts with status='queued' just sat in the DB and never fired.
 *
 * `scheduleSocialPublish({ postId, scheduledFor })` enqueues a delayed job
 * that, when it fires, hits /api/jobs/publish with {post_id} in the body.
 * QStash then handles delivery + retries.
 */

let _client = null;
function getClient() {
  if (!_client) {
    const token = process.env.QSTASH_TOKEN;
    if (!token) throw new Error('QSTASH_TOKEN must be set to schedule publishing');
    const { Client } = require('@upstash/qstash');
    _client = new Client({ token });
  }
  return _client;
}

function buildPublishUrl() {
  const appUrl = (process.env.APP_URL || 'https://sidekik.com').replace(/\/$/, '');
  return `${appUrl}/api/jobs/publish`;
}

/**
 * Schedule a publish job.
 * - If scheduledFor is null/undefined → fires immediately (delay 1s)
 * - Otherwise fires at the given ISO timestamp
 *
 * Returns { messageId } so the caller can persist it to scheduled_posts.qstash_message_id
 * (enables cancellation later).
 */
async function scheduleSocialPublish({ postId, scheduledFor }) {
  const client = getClient();
  const url = buildPublishUrl();

  const opts = {
    url,
    body: JSON.stringify({ post_id: postId }),
    headers: { 'Content-Type': 'application/json' },
  };

  if (scheduledFor) {
    const target = new Date(scheduledFor);
    if (Number.isNaN(target.getTime())) {
      throw new Error(`Invalid scheduledFor: ${scheduledFor}`);
    }
    const delaySec = Math.max(1, Math.floor((target.getTime() - Date.now()) / 1000));
    opts.delay = delaySec;
  } else {
    // Immediate — small delay to ensure the row is committed in Supabase
    // before the worker reads it.
    opts.delay = 1;
  }

  const res = await client.publishJSON({
    url: opts.url,
    body: { post_id: postId },
    delay: opts.delay,
  });

  return { messageId: res.messageId };
}

/**
 * Enqueue a Replicate enhancement job for a single photo. Used by the MMS
 * intake pipeline — enhancement can take 60-90s which doesn't fit inside
 * the webhook's 30s maxDuration. The job runs under /api/jobs/* with a
 * 300s budget.
 */
async function scheduleEnhancement(photoId) {
  const client = getClient();
  const appUrl = (process.env.APP_URL || 'https://sidekik.com').replace(/\/$/, '');
  const res = await client.publishJSON({
    url: `${appUrl}/api/jobs/enhance-photo`,
    body: { photo_id: photoId },
    delay: 1,
  });
  return { messageId: res.messageId };
}

/**
 * Best-effort cancellation — used when the user cancels a scheduled post
 * before it fires. Swallows errors (the message may have already been
 * delivered, in which case there's nothing to cancel).
 */
async function cancelScheduledPublish(messageId) {
  if (!messageId) return;
  try {
    const client = getClient();
    await client.messages.delete(messageId);
  } catch (err) {
    console.warn(`QStash cancel failed for ${messageId}:`, err.message);
  }
}

module.exports = {
  scheduleSocialPublish,
  scheduleEnhancement,
  cancelScheduledPublish,
};
