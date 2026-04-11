'use strict';

/**
 * GET /api/oauth/twitter/callback?code=xxx&state=yyy
 *
 * Handles X/Twitter OAuth 2.0 PKCE callback.
 * Exchanges code for tokens using PKCE verifier.
 */

const { upsertSocialAccount, getClient } = require('../supabase');
const { sendSms } = require('../../api/sms/outbound');

async function exchangeCodeForToken(code, verifier, redirectUri) {
  const clientId = process.env.TWITTER_CLIENT_ID;
  const clientSecret = process.env.TWITTER_CLIENT_SECRET;

  // Twitter OAuth 2.0 requires Basic auth with client_id:client_secret
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
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
  return data; // { access_token, refresh_token, expires_in, scope }
}

async function getTwitterUser(accessToken) {
  const response = await fetch('https://api.twitter.com/2/users/me?user.fields=id,name,username', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await response.json();
  if (data.errors) throw new Error(data.errors[0]?.message || 'Failed to get Twitter user');
  return data.data; // { id, name, username }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).send('Method not allowed');
  }

  const { code, state, error: oauthError } = req.query;

  if (oauthError) {
    return res.redirect(302, '/connected?status=error&platform=twitter&reason=' + encodeURIComponent(oauthError));
  }

  if (!code || !state) {
    return res.status(400).send('Missing code or state parameter');
  }

  try {
    // Look up the stored state (which packs the PKCE verifier)
    const { data: storedState, error } = await getClient()
      .from('oauth_states')
      .select('*')
      .like('state', `${state}:%`) // state is "randomHex:pkceVerifier"
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !storedState) {
      return res.status(400).send('Invalid or expired OAuth state. Please start over.');
    }

    // Delete the state (one-time use)
    await getClient()
      .from('oauth_states')
      .delete()
      .eq('id', storedState.id);

    // Extract PKCE verifier from packed state
    const verifier = storedState.state.split(':').slice(1).join(':');
    const userId = storedState.user_id;

    const appUrl = process.env.APP_URL || 'https://sidekick.app';
    const redirectUri = `${appUrl}/api/oauth/twitter/callback`;

    // Exchange code for tokens
    const tokenData = await exchangeCodeForToken(code, verifier, redirectUri);

    // Get Twitter user info
    const twitterUser = await getTwitterUser(tokenData.access_token);

    // Calculate token expiry
    const tokenExpiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null;

    // Store the account
    await upsertSocialAccount({
      userId,
      platform: 'twitter',
      platformUserId: twitterUser.id,
      platformUsername: twitterUser.username,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || null,
      tokenExpiresAt,
      scopes: (tokenData.scope || '').split(' '),
    });

    // Text the user confirmation
    const { data: user } = await getClient()
      .from('users')
      .select('phone')
      .eq('id', userId)
      .single();

    if (user) {
      await sendSms(user.phone,
        `X/Twitter connected! Posting as @${twitterUser.username}.\n\nTry: "Tweet about our latest update"`
      );
    }

    return res.redirect(302, '/connected?status=success&platform=twitter');

  } catch (err) {
    console.error('Twitter OAuth callback error:', err);
    return res.redirect(302, '/connected?status=error&platform=twitter');
  }
};
