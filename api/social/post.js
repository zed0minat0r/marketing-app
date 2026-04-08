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

const { getScheduledPost, updateScheduledPost, getSocialAccount, upsertSocialAccount, getClient } = require('../../lib/supabase');
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
// LINKEDIN POSTING (UGC Post API)
// =============================================

/**
 * Post to LinkedIn as the authenticated member.
 * Supports text-only and text + link or image attachments.
 *
 * @param {string} personUrn - LinkedIn member URN (urn:li:person:{id})
 * @param {string} accessToken
 * @param {string} content - Post text
 * @param {string|null} linkUrl - Optional link to include
 * @param {string|null} imageUrl - Optional image URL
 * @returns {Promise<string>} Post URL
 */
async function postToLinkedIn(personUrn, accessToken, content, linkUrl, imageUrl) {
  // Build the UGC post body
  const shareContent = {
    shareCommentary: {
      text: content,
    },
    shareMediaCategory: 'NONE',
  };

  if (linkUrl) {
    shareContent.shareMediaCategory = 'ARTICLE';
    shareContent.media = [{
      status: 'READY',
      originalUrl: linkUrl,
    }];
  } else if (imageUrl) {
    shareContent.shareMediaCategory = 'IMAGE';
    shareContent.media = [{
      status: 'READY',
      media: imageUrl,
      description: { text: content.slice(0, 200) },
    }];
  }

  const body = {
    author: personUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': shareContent,
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
    },
  };

  const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'X-Restli-Protocol-Version': '2.0.0',
      'LinkedIn-Version': '202304',
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (data.status >= 400 || data.serviceErrorCode) {
    throw new Error(`LinkedIn: ${data.message || JSON.stringify(data)}`);
  }

  // Extract post ID from the response header or body
  const postUrn = data.id || response.headers?.get('x-restli-id') || '';
  const postId = postUrn.split(':').pop() || postUrn;

  return postId ? `https://www.linkedin.com/feed/update/${postUrn}/` : 'https://www.linkedin.com/';
}

// =============================================
// PINTEREST PIN CREATION (API v5)
// =============================================

/**
 * Create a Pinterest pin.
 * Pinterest requires an image URL. If none is provided and no fallback is
 * available, we throw PINTEREST_NEEDS_IMAGE so the caller can notify the user.
 *
 * @param {string} accessToken
 * @param {string} content - Pin description
 * @param {string|null} imageUrl - Public image URL
 * @param {string|null} boardId - Target board ID (uses first board if null)
 * @param {string|null} linkUrl - Optional destination link
 * @returns {Promise<string>} Pin URL
 */
async function postToPinterest(accessToken, content, imageUrl, boardId, linkUrl) {
  // Pinterest requires an image — no text-only pins
  if (!imageUrl) {
    throw new Error('PINTEREST_NEEDS_IMAGE');
  }

  // If no boardId provided, fetch the user's first board
  let targetBoardId = boardId;
  if (!targetBoardId) {
    const boardsRes = await fetch('https://api.pinterest.com/v5/boards?page_size=1', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const boardsData = await boardsRes.json();
    if (boardsData.code) throw new Error(boardsData.message || 'Pinterest boards fetch failed');

    const firstBoard = boardsData.items?.[0];
    if (!firstBoard) throw new Error('Pinterest: No boards found. Create a board on Pinterest first.');
    targetBoardId = firstBoard.id;
  }

  const pinBody = {
    board_id: targetBoardId,
    description: content,
    media_source: {
      source_type: 'image_url',
      url: imageUrl,
    },
  };

  if (linkUrl) {
    pinBody.link = linkUrl;
  }

  const response = await fetch('https://api.pinterest.com/v5/pins', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(pinBody),
  });

  const data = await response.json();
  if (data.code) throw new Error(`Pinterest: ${data.message || JSON.stringify(data)}`);

  return `https://www.pinterest.com/pin/${data.id}/`;
}

// =============================================
// GOOGLE BUSINESS PROFILE POSTING
// =============================================

/**
 * Refresh a Google access token using the stored refresh token.
 */
async function refreshGoogleAccessToken(refreshToken) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error_description || data.error);

  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString(),
  };
}

/**
 * Get the first Google Business Profile location for the authenticated account.
 * Returns { name, accountName } where name is the resource name (accounts/xxx/locations/yyy).
 */
async function getGoogleBusinessLocation(accessToken) {
  // First get accounts
  const accountsRes = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const accountsData = await accountsRes.json();

  if (accountsData.error) throw new Error(`Google Business: ${accountsData.error.message}`);

  const account = accountsData.accounts?.[0];
  if (!account) throw new Error('Google Business: No business accounts found. Set up a Google Business Profile first.');

  // Get locations for this account
  const locationsRes = await fetch(
    `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=name,title`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const locationsData = await locationsRes.json();

  if (locationsData.error) throw new Error(`Google Business: ${locationsData.error.message}`);

  const location = locationsData.locations?.[0];
  if (!location) throw new Error('Google Business: No locations found under your business account.');

  return { locationName: location.name, title: location.title || account.accountName };
}

/**
 * Create a Google Business Profile local post.
 * Supports text-only (STANDARD) or text with image (STANDARD with media).
 *
 * @param {string} accessToken
 * @param {string} content - Post text (max 1500 chars)
 * @param {string|null} imageUrl - Optional image URL
 * @param {string|null} locationName - GBP location resource name (fetched automatically if null)
 * @returns {Promise<string>} Post URL
 */
async function postToGoogleBusiness(accessToken, content, imageUrl, locationName) {
  let location = locationName;

  if (!location) {
    const locationData = await getGoogleBusinessLocation(accessToken);
    location = locationData.locationName;
  }

  const postBody = {
    languageCode: 'en',
    summary: content.slice(0, 1500),
    topicType: 'STANDARD',
  };

  if (imageUrl) {
    postBody.media = [{
      mediaFormat: 'PHOTO',
      sourceUrl: imageUrl,
    }];
  }

  const response = await fetch(
    `https://mybusiness.googleapis.com/v4/${location}/localPosts`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(postBody),
    }
  );

  const data = await response.json();
  if (data.error) throw new Error(`Google Business: ${data.error.message}`);

  // Extract post name for URL construction
  // Resource name format: accounts/{accountId}/locations/{locationId}/localPosts/{postId}
  const parts = (data.name || '').split('/');
  const postId = parts[parts.length - 1];
  const locationId = parts[3] || '';
  const accountId = parts[1] || '';

  const postUrl = accountId && locationId && postId
    ? `https://business.google.com/dashboard/l/${locationId}`
    : 'https://business.google.com/';

  return postUrl;
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

      } else if (platform === 'linkedin') {
        let accessToken = account.access_token;

        // Refresh if expired (LinkedIn tokens expire after 60 days)
        if (account.token_expires_at && new Date(account.token_expires_at) < new Date()) {
          throw new Error('LINKEDIN_TOKEN_EXPIRED');
        }

        // Build the member URN from the stored platform_user_id
        const personUrn = `urn:li:person:${account.platform_user_id}`;
        url = await postToLinkedIn(
          personUrn,
          accessToken,
          post.content,
          post.link_url || null,
          post.media_url || null
        );

      } else if (platform === 'pinterest') {
        let accessToken = account.access_token;

        // Pinterest tokens are long-lived; no refresh needed unless expires_at set
        if (account.token_expires_at && new Date(account.token_expires_at) < new Date()) {
          throw new Error('PINTEREST_TOKEN_EXPIRED');
        }

        url = await postToPinterest(
          accessToken,
          post.content,
          post.media_url || null,
          post.board_id || null,
          post.link_url || null
        );

      } else if (platform === 'google') {
        let accessToken = account.access_token;

        // Google access tokens expire in 1 hour — always refresh if expiry is set
        if (account.refresh_token &&
            account.token_expires_at &&
            new Date(account.token_expires_at) < new Date(Date.now() + 60 * 1000)) {
          const refreshed = await refreshGoogleAccessToken(account.refresh_token);
          accessToken = refreshed.accessToken;

          // Update stored token
          await upsertSocialAccount({
            userId: account.user_id,
            platform: 'google',
            platformUserId: account.platform_user_id,
            platformUsername: account.platform_username,
            accessToken: refreshed.accessToken,
            refreshToken: account.refresh_token,
            tokenExpiresAt: refreshed.expiresAt,
            scopes: account.scopes,
          });
        }

        url = await postToGoogleBusiness(
          accessToken,
          post.content,
          post.media_url || null,
          post.location_name || null
        );
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
      } else if (err.message === 'PINTEREST_NEEDS_IMAGE') {
        errors[platform] = 'Pinterest requires an image URL to create a pin. Reply with your post text and an image URL.';

        try {
          const { data: userData } = await getClient()
            .from('users')
            .select('phone')
            .eq('id', post.user_id)
            .single();
          if (userData?.phone) {
            await sendSms(userData.phone,
              'Pinterest requires an image to create a pin. Reply with an image URL along with your post text.'
            ).catch(console.error);
          }
        } catch (notifyErr) {
          console.error('Failed to notify user about Pinterest image requirement:', notifyErr.message);
        }

      } else if (err.message === 'LINKEDIN_TOKEN_EXPIRED') {
        errors[platform] = 'LinkedIn connection has expired. Please reconnect by texting "Connect LinkedIn".';

        try {
          const { data: userData } = await getClient()
            .from('users')
            .select('phone')
            .eq('id', post.user_id)
            .single();
          if (userData?.phone) {
            await sendSms(userData.phone,
              'Your LinkedIn connection has expired. Text "Connect LinkedIn" to reconnect.'
            ).catch(console.error);
          }
        } catch (notifyErr) {
          console.error('Failed to notify user about LinkedIn token expiry:', notifyErr.message);
        }

      } else if (err.message === 'PINTEREST_TOKEN_EXPIRED') {
        errors[platform] = 'Pinterest connection has expired. Please reconnect by texting "Connect Pinterest".';

        try {
          const { data: userData } = await getClient()
            .from('users')
            .select('phone')
            .eq('id', post.user_id)
            .single();
          if (userData?.phone) {
            await sendSms(userData.phone,
              'Your Pinterest connection has expired. Text "Connect Pinterest" to reconnect.'
            ).catch(console.error);
          }
        } catch (notifyErr) {
          console.error('Failed to notify user about Pinterest token expiry:', notifyErr.message);
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
