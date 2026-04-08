'use strict';

/**
 * POST /api/social/post
 *
 * Internal endpoint: Publish content to a social platform.
 * Called after user approves a post draft.
 *
 * Body: { post_id: "uuid" }
 * Response: { success: true, urls: {...} }
 */

const { getScheduledPost, updateScheduledPost, getSocialAccount, getClient } = require('../../lib/supabase');
const { sendSms } = require('../sms/outbound');

// =============================================
// FACEBOOK POSTING
// =============================================

async function postToFacebook(pageId, pageToken, content) {
  const response = await fetch(`https://graph.facebook.com/v19.0/${pageId}/feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: content,
      access_token: pageToken,
    }),
  });

  const data = await response.json();
  if (data.error) throw new Error(`Facebook: ${data.error.message}`);

  return `https://facebook.com/${data.id.replace('_', '/posts/')}`;
}

// =============================================
// INSTAGRAM POSTING
// =============================================

async function postToInstagram(igUserId, accessToken, content, mediaUrl) {
  // Step 1: Create media container
  const containerBody = { caption: content, access_token: accessToken };
  if (mediaUrl) {
    containerBody.image_url = mediaUrl;
  } else {
    // Text-only not supported on IG feed — requires image
    // Use a placeholder approach or skip. For now, require media.
    throw new Error('Instagram requires an image URL for feed posts');
  }

  const containerRes = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(containerBody),
  });

  const containerData = await containerRes.json();
  if (containerData.error) throw new Error(`Instagram create: ${containerData.error.message}`);

  const containerId = containerData.id;

  // Step 2: Publish the container
  const publishRes = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creation_id: containerId,
      access_token: accessToken,
    }),
  });

  const publishData = await publishRes.json();
  if (publishData.error) throw new Error(`Instagram publish: ${publishData.error.message}`);

  return `https://instagram.com/p/${publishData.id}`;
}

// =============================================
// TWITTER POSTING
// =============================================

async function postToTwitter(accessToken, content) {
  const response = await fetch('https://api.twitter.com/2/tweets', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ text: content.slice(0, 280) }),
  });

  const data = await response.json();
  if (data.errors) throw new Error(`Twitter: ${data.errors[0]?.message}`);
  if (!data.data?.id) throw new Error('Twitter: No tweet ID returned');

  return `https://twitter.com/i/web/status/${data.data.id}`;
}

// =============================================
// REFRESH TWITTER TOKEN
// =============================================

async function refreshTwitterToken(account) {
  if (!account.refresh_token) throw new Error('No refresh token available');

  const clientId = process.env.TWITTER_CLIENT_ID;
  const clientSecret = process.env.TWITTER_CLIENT_SECRET;
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: account.refresh_token,
  });

  const response = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: body.toString(),
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error_description || data.error);

  // Update stored token
  const { upsertSocialAccount } = require('../../lib/supabase');
  await upsertSocialAccount({
    userId: account.user_id,
    platform: 'twitter',
    platformUserId: account.platform_user_id,
    platformUsername: account.platform_username,
    accessToken: data.access_token,
    refreshToken: data.refresh_token || account.refresh_token,
    tokenExpiresAt: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : null,
    scopes: (data.scope || '').split(' '),
  });

  return data.access_token;
}

// =============================================
// MAIN PUBLISH FUNCTION
// =============================================

/**
 * Publish a scheduled post to all its platforms.
 *
 * @param {string} postId - UUID of the scheduled_posts record
 * @returns {Promise<{success: boolean, urls: Object, errors: Object}>}
 */
async function publishPost(postId) {
  const post = await getScheduledPost(postId);

  if (!post) throw new Error(`Post ${postId} not found`);
  if (post.status === 'posted') return { success: true, alreadyPosted: true };
  if (post.status === 'canceled') throw new Error('Post has been canceled');

  // Mark as publishing
  await updateScheduledPost(postId, { status: 'publishing' });

  const urls = {};
  const errors = {};

  for (const platform of post.platforms) {
    try {
      const account = await getSocialAccount(post.user_id, platform);

      if (!account) {
        errors[platform] = `No ${platform} account connected`;
        continue;
      }

      let url;

      if (platform === 'facebook') {
        url = await postToFacebook(account.platform_user_id, account.access_token, post.content);

      } else if (platform === 'instagram') {
        if (!post.media_url) {
          errors[platform] = 'Instagram posts require an image. Share an image URL to post to Instagram.';
          continue;
        }
        url = await postToInstagram(account.platform_user_id, account.access_token, post.content, post.media_url);

      } else if (platform === 'twitter') {
        let accessToken = account.access_token;

        // Check if token is expired
        if (account.token_expires_at && new Date(account.token_expires_at) < new Date()) {
          accessToken = await refreshTwitterToken(account);
        }

        url = await postToTwitter(accessToken, post.content);
      }

      if (url) urls[platform] = url;

    } catch (err) {
      console.error(`Error posting to ${platform}:`, err.message);
      errors[platform] = err.message;
    }
  }

  const successCount = Object.keys(urls).length;
  const errorCount = Object.keys(errors).length;

  if (successCount > 0) {
    // Update post as published
    await updateScheduledPost(postId, {
      status: 'posted',
      published_urls: urls,
      error_message: errorCount > 0 ? JSON.stringify(errors) : null,
    });

    return { success: true, urls, errors };
  } else {
    // All platforms failed
    const errorMsg = Object.entries(errors)
      .map(([p, e]) => `${p}: ${e}`)
      .join('; ');

    await updateScheduledPost(postId, {
      status: 'failed',
      error_message: errorMsg,
      retry_count: (post.retry_count || 0) + 1,
    });

    throw new Error(`All platforms failed: ${errorMsg}`);
  }
}

// =============================================
// VERCEL HANDLER
// =============================================

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { post_id } = req.body || {};

  if (!post_id) {
    return res.status(400).json({ error: 'post_id is required' });
  }

  try {
    const result = await publishPost(post_id);

    if (result.alreadyPosted) {
      return res.status(200).json({ success: true, message: 'Already posted' });
    }

    return res.status(200).json({
      success: true,
      urls: result.urls,
      errors: result.errors,
    });

  } catch (err) {
    console.error('Social post error:', err);
    return res.status(500).json({ error: err.message });
  }
};

module.exports.publishPost = publishPost;
