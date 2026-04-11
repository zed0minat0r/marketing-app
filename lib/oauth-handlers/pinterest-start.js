'use strict';

/**
 * GET /api/oauth/pinterest/start?token=abc123
 *
 * Initiates Pinterest OAuth 2.0 flow (API v5).
 * Requests pins:read and pins:write scopes for pin creation.
 */

const crypto = require('crypto');
const { getClient, createOAuthState } = require('../supabase');

const PINTEREST_SCOPES = [
  'pins:read',
  'pins:write',
  'boards:read',
  'user_accounts:read',
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
      return res.status(400).send('Invalid or expired link. Please text "Connect Pinterest" again.');
    }

    if (oauthLink.used) {
      return res.status(400).send('This link has already been used. Please text "Connect Pinterest" for a new link.');
    }

    if (new Date(oauthLink.expires_at) < new Date()) {
      return res.status(400).send('This link has expired. Please text "Connect Pinterest" for a new link.');
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
      platform: 'pinterest',
      state,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 min
    });

    // Build Pinterest OAuth URL
    const clientId = process.env.PINTEREST_CLIENT_ID;
    const appUrl = process.env.APP_URL || 'https://sidekick.app';
    const redirectUri = encodeURIComponent(`${appUrl}/api/oauth/pinterest/callback`);
    const scopeEncoded = encodeURIComponent(PINTEREST_SCOPES);

    const pinterestAuthUrl = `https://www.pinterest.com/oauth/?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scopeEncoded}&state=${state}`;

    return res.redirect(302, pinterestAuthUrl);

  } catch (err) {
    console.error('Pinterest OAuth start error:', err);
    return res.status(500).send('Something went wrong. Please try again.');
  }
};
