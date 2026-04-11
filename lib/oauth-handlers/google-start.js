'use strict';

/**
 * GET /api/oauth/google/start?token=abc123
 *
 * Initiates Google OAuth 2.0 flow for Google Business Profile API.
 * Requests the business.manage scope for creating local posts.
 * Uses offline access_type to obtain a refresh token for long-lived access.
 */

const crypto = require('crypto');
const { getClient, createOAuthState } = require('../supabase');

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/business.manage',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

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
      return res.status(400).send('Invalid or expired link. Please text "Connect Google Business" again.');
    }

    if (oauthLink.used) {
      return res.status(400).send('This link has already been used. Please text "Connect Google Business" for a new link.');
    }

    if (new Date(oauthLink.expires_at) < new Date()) {
      return res.status(400).send('This link has expired. Please text "Connect Google Business" for a new link.');
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
      platform: 'google',
      state,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 min
    });

    // Build Google OAuth URL
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const appUrl = process.env.APP_URL || 'https://sidekick.app';
    const redirectUri = encodeURIComponent(`${appUrl}/api/oauth/google/callback`);
    const scopeEncoded = encodeURIComponent(GOOGLE_SCOPES);

    const googleAuthUrl = [
      'https://accounts.google.com/o/oauth2/v2/auth',
      `?client_id=${clientId}`,
      `&redirect_uri=${redirectUri}`,
      `&response_type=code`,
      `&scope=${scopeEncoded}`,
      `&state=${state}`,
      `&access_type=offline`,   // Required to receive a refresh token
      `&prompt=consent`,         // Force consent screen to always issue a refresh token
    ].join('');

    return res.redirect(302, googleAuthUrl);

  } catch (err) {
    console.error('Google OAuth start error:', err);
    return res.status(500).send('Something went wrong. Please try again.');
  }
};
