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
// BRANDED TEXT-AS-IMAGE FOR INSTAGRAM
// =============================================

/**
 * Generate a simple SVG image with post text on a branded background.
 * Returns a data: URL suitable for upload.
 * Since Instagram requires a publicly hosted image URL, we upload to
 * a public hosting service or use an inline approach.
 *
 * Strategy: Build an SVG, encode as base64 data URL.
 * For production, this is uploaded to a CDN/S3. Here we generate the SVG
 * and use the Vercel deployment URL if available to serve it, or fall back
 * to notifying the user that Instagram needs an image.
 */
function generateBrandedSvg(text) {
  // Wrap text at ~35 chars per line for readability in the image
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).trim().length > 35) {
      if (current) lines.push(current.trim());
      current = word;
    } else {
      current = current ? current + ' ' + word : word;
    }
  }
  if (current) lines.push(current.trim());

  // Limit to 8 lines to fit the 400x400 canvas
  const displayLines = lines.slice(0, 8);
  const lineHeight = 32;
  const startY = 200 - (displayLines.length * lineHeight) / 2 + 16;

  const textElements = displayLines.map((line, i) => {
    const y = startY + i * lineHeight;
    // Escape XML entities
    const escaped = line
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    return `<text x="200" y="${y}" text-anchor="middle" fill="white" font-size="20" font-family="Arial, sans-serif" font-weight="500">${escaped}</text>`;
  }).join('\n    ');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#4F46E5;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#7C3AED;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="400" height="400" fill="url(#bg)" rx="12"/>
  <text x="200" y="48" text-anchor="middle" fill="rgba(255,255,255,0.7)" font-size="13" font-family="Arial, sans-serif" letter-spacing="3">SIDEKICK</text>
  ${textElements}
  <text x="200" y="376" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-size="11" font-family="Arial, sans-serif">sidekick.app</text>
</svg>`;
}

/**
 * For Instagram text-only posts: generate a branded SVG image,
 * upload it to a publicly accessible URL, then use that URL.
 *
 * In production this should upload to S3/Cloudflare R2/Vercel Blob.
 * For now, we encode as a data URL and note the limitation.
 * The function returns null if no upload mechanism is available,
 * and the caller sends an SMS explaining the limitation.
 *
 * @param {string} content - Post text
 * @returns {Promise<string|null>} Public image URL or null
 */
async function generateInstagramImageUrl(content) {
  // If Vercel Blob is configured, upload the SVG as PNG equivalent
  // For now, attempt upload to a generic S3-compatible store via env vars
  const uploadUrl = process.env.IMAGE_UPLOAD_URL;
  const uploadToken = process.env.IMAGE_UPLOAD_TOKEN;

  if (!uploadUrl || !uploadToken) {
    // No upload mechanism configured — return null
    return null;
  }

  const svg = generateBrandedSvg(content);
  const svgBuffer = Buffer.from(svg, 'utf8');

  const filename = `sidekick-ig-${Date.now()}.svg`;

  const uploadRes = await fetch(`${uploadUrl}/${filename}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${uploadToken}`,
      'Content-Type': 'image/svg+xml',
      'Content-Length': String(svgBuffer.length),
    },
    body: svgBuffer,
  });

  if (!uploadRes.ok) {
    console.error('Image upload failed:', uploadRes.status, await uploadRes.text());
    return null;
  }

  // Return the public URL of the uploaded image
  const publicBase = process.env.IMAGE_PUBLIC_BASE_URL || uploadUrl;
  return `${publicBase}/${filename}`;
}

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
    // Text-only is not supported on IG feed.
    // Attempt to generate a branded image for the post.
    const generatedUrl = await generateInstagramImageUrl(content);
    if (!generatedUrl) {
      throw new Error('INSTAGRAM_NEEDS_IMAGE');
    }
    containerBody.image_url = generatedUrl;
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
        // media_url may be null — postToInstagram handles text-only via branded image generation
        url = await postToInstagram(account.platform_user_id, account.access_token, post.content, post.media_url || null);

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

      if (err.message === 'INSTAGRAM_NEEDS_IMAGE') {
        errors[platform] = 'Instagram requires an image for feed posts. Share an image URL with your post, or I can post text-only to Facebook and Twitter instead.';

        // Notify the user via SMS if we can look up their phone
        try {
          const { data: userData } = await getClient()
            .from('users')
            .select('phone')
            .eq('id', post.user_id)
            .single();
          if (userData?.phone) {
            const otherPlatforms = post.platforms.filter(p => p !== 'instagram');
            const altText = otherPlatforms.length > 0
              ? ` I posted it to ${otherPlatforms.join(' & ')} for you.`
              : ' Reply with an image URL to post to Instagram.';
            await sendSms(userData.phone,
              `Instagram needs an image for feed posts.${altText}`
            ).catch(console.error);
          }
        } catch (notifyErr) {
          console.error('Failed to notify user about Instagram image requirement:', notifyErr.message);
        }
      } else {
        errors[platform] = err.message;
      }
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
