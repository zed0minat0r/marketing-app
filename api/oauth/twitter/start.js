'use strict';

/**
 * GET /api/oauth/twitter/start?token=abc123
 *
 * Initiates X (Twitter) OAuth 2.0 PKCE flow.
 * Sends user to Twitter's authorization page.
 */

const crypto = require('crypto');
const { getClient, createOAuthState } = require('../../../lib/supabase');

const TWITTER_SCOPES = [
  'tweet.read',
  'tweet.write',
  'users.read',
  'offline.access',
].join(' ');

function generatePKCE() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');
  return { verifier, challenge };
}

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

    if (error || !oauthLink || oauthLink.used || new Date(oauthLink.expires_at) < new Date()) {
      return res.status(400).send('Invalid or expired link. Please text "Connect Twitter" again.');
    }

    // Mark as used
    await getClient()
      .from('oauth_links')
      .update({ used: true })
      .eq('token', token);

    const { verifier, challenge } = generatePKCE();
    const state = crypto.randomBytes(32).toString('hex');

    // Store state + PKCE verifier
    await getClient()
      .from('oauth_states')
      .insert({
        user_id: oauthLink.user_id,
        platform: 'twitter',
        state: `${state}:${verifier}`, // Pack verifier into state field
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      });

    const clientId = process.env.TWITTER_CLIENT_ID;
    const appUrl = process.env.APP_URL || 'https://textmarketer.com';
    const redirectUri = encodeURIComponent(`${appUrl}/api/oauth/twitter/callback`);
    const scopeEncoded = encodeURIComponent(TWITTER_SCOPES);

    const twitterAuthUrl = `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scopeEncoded}&state=${state}&code_challenge=${challenge}&code_challenge_method=S256`;

    return res.redirect(302, twitterAuthUrl);

  } catch (err) {
    console.error('Twitter OAuth start error:', err);
    return res.status(500).send('Something went wrong. Please try again.');
  }
};
