'use strict';

/**
 * GET /api/oauth/linkedin/start?token=abc123
 *
 * Initiates LinkedIn OAuth 2.0 flow.
 * Requests w_member_social (post on behalf of user) and r_liteprofile scopes.
 */

const crypto = require('crypto');
const { getClient, createOAuthState } = require('../../../lib/supabase');

const LINKEDIN_SCOPES = [
  'w_member_social',
  'r_liteprofile',
  'r_emailaddress',
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
      return res.status(400).send('Invalid or expired link. Please text "Connect LinkedIn" again.');
    }

    if (oauthLink.used) {
      return res.status(400).send('This link has already been used. Please text "Connect LinkedIn" for a new link.');
    }

    if (new Date(oauthLink.expires_at) < new Date()) {
      return res.status(400).send('This link has expired. Please text "Connect LinkedIn" for a new link.');
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
      platform: 'linkedin',
      state,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 min
    });

    // Build LinkedIn OAuth URL
    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const appUrl = process.env.APP_URL || 'https://sidekick.app';
    const redirectUri = encodeURIComponent(`${appUrl}/api/oauth/linkedin/callback`);
    const scopeEncoded = encodeURIComponent(LINKEDIN_SCOPES);

    const linkedInAuthUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scopeEncoded}&state=${state}`;

    return res.redirect(302, linkedInAuthUrl);

  } catch (err) {
    console.error('LinkedIn OAuth start error:', err);
    return res.status(500).send('Something went wrong. Please try again.');
  }
};
