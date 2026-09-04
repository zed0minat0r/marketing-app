'use strict';

/**
 * GET /api/oauth/meta/start?token=abc123
 *
 * Initiates Meta OAuth flow. The token was sent to the user via SMS.
 * Validates the token, creates an OAuth state for CSRF protection,
 * then redirects to Meta's OAuth consent screen.
 */

const crypto = require('crypto');
const { getClient, createOAuthState } = require('../supabase');

const META_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',
  'pages_manage_engagement',
  'instagram_basic',
  'instagram_content_publish',
  'instagram_manage_comments',
  'instagram_manage_insights',
  // business_management REMOVED 2026-09-04, with Matt's go-ahead. It triggers Meta's strictest App
  // Review track, and this app never used anything it gates. Every Graph call in lib/ and api/ was
  // enumerated before removing it:
  //   /me, /me/accounts, /{page}/feed, /{page}/subscribed_apps, /{ig}/media, /{ig}/media_publish,
  //   /{post}/insights, /{ig-media}/insights, /oauth/access_token
  // Not one /businesses call, and no Business Manager endpoint anywhere in the codebase. Pages are
  // listed via /me/accounts, which pages_show_list already covers - which was the stated reason for
  // requesting it in docs/META-APP-REVIEW.md, and it was never the reason it was needed.
  //
  // Asking for a permission you cannot demonstrate is its own documented rejection trap: "reviewers
  // reject business_management requested but not demonstrated".
].join(',');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).send('Method not allowed');
  }

  const { token } = req.query;

  if (!token) {
    return res.status(400).send('Missing token parameter');
  }

  try {
    // Validate the one-time SMS token
    const { data: oauthLink, error } = await getClient()
      .from('oauth_links')
      .select('user_id, expires_at, used')
      .eq('token', token)
      .single();

    if (error || !oauthLink) {
      return res.status(400).send('Invalid or expired link. Please text "Connect Instagram" again.');
    }

    if (oauthLink.used) {
      return res.status(400).send('This link has already been used. Please text "Connect Instagram" for a new link.');
    }

    if (new Date(oauthLink.expires_at) < new Date()) {
      return res.status(400).send('This link has expired. Please text "Connect Instagram" for a new link.');
    }

    // Mark the link as used
    await getClient()
      .from('oauth_links')
      .update({ used: true })
      .eq('token', token);

    // Generate CSRF state
    const state = crypto.randomBytes(32).toString('hex');

    await createOAuthState({
      userId: oauthLink.user_id,
      platform: 'meta',
      state,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 min
    });

    // Build Meta OAuth URL
    const appId = process.env.META_APP_ID;
    const appUrl = process.env.APP_URL || 'https://sidekik.com';
    const redirectUri = encodeURIComponent(`${appUrl}/api/oauth/meta/callback`);
    const scopeEncoded = encodeURIComponent(META_SCOPES);

    const metaAuthUrl = `https://www.facebook.com/v22.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&scope=${scopeEncoded}&state=${state}&response_type=code`;

    return res.redirect(302, metaAuthUrl);

  } catch (err) {
    console.error('Meta OAuth start error:', err);
    return res.status(500).send('Something went wrong. Please try again.');
  }
};
