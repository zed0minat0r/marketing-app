'use strict';

/**
 * GET /api/oauth/pinterest/callback?code=xxx&state=yyy
 *
 * Handles Pinterest OAuth redirect (API v5).
 * Pinterest issues long-lived tokens (no expiry by default) and does not
 * use refresh tokens on the standard OAuth flow — tokens remain valid
 * until the user revokes access.
 */

const { getAndDeleteOAuthState, upsertSocialAccount, getClient } = require('../supabase');
const { sendSms } = require('../../api/sms/outbound');

async function exchangeCodeForToken(code, redirectUri) {
  const clientId = process.env.PINTEREST_CLIENT_ID;
  const clientSecret = process.env.PINTEREST_CLIENT_SECRET;

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });

  const response = await fetch('https://api.pinterest.com/v5/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: body.toString(),
  });

  const data = await response.json();
  if (data.code) throw new Error(data.message || 'Pinterest token exchange failed');

  return data; // { access_token, token_type, expires_in, refresh_token, scope }
}

async function getPinterestUserInfo(accessToken) {
  const response = await fetch('https://api.pinterest.com/v5/user_account', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await response.json();
  if (data.code) throw new Error(data.message || 'Pinterest profile fetch failed');

  return {
    id: data.username,
    name: data.business_name || data.username,
    username: data.username,
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).send('Method not allowed');
  }

  const { code, state, error: oauthError } = req.query;

  if (oauthError) {
    return res.redirect(302, '/connected?status=error&platform=pinterest&reason=' + encodeURIComponent(oauthError));
  }

  if (!code || !state) {
    return res.status(400).send('Missing code or state parameter');
  }

  try {
    // Validate CSRF state
    const oauthState = await getAndDeleteOAuthState(state);
    if (!oauthState) {
      return res.status(400).send('Invalid or expired OAuth state. Please start over.');
    }

    const userId = oauthState.user_id;
    const appUrl = process.env.APP_URL || 'https://sidekick.app';
    const redirectUri = `${appUrl}/api/oauth/pinterest/callback`;

    // Exchange code for access token
    const tokenData = await exchangeCodeForToken(code, redirectUri);
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token || null;

    // Pinterest tokens may have no expiry; if expires_in is provided use it
    const tokenExpiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null;

    // Get user info
    const profile = await getPinterestUserInfo(accessToken);

    // Store the account with encrypted token
    await upsertSocialAccount({
      userId,
      platform: 'pinterest',
      platformUserId: profile.id,
      platformUsername: profile.name,
      accessToken,
      refreshToken,
      tokenExpiresAt,
      scopes: (tokenData.scope || 'pins:read,pins:write,boards:read').split(/[, ]/),
    });

    // Get user's phone number and text them
    const { data: user } = await getClient()
      .from('users')
      .select('phone, business_name')
      .eq('id', userId)
      .single();

    if (user) {
      await sendSms(user.phone,
        `Pinterest connected! I can now create pins for @${profile.username}.\n\nTry: "Create a Pinterest pin about our summer sale" (include an image URL for best results)`
      );
    }

    return res.redirect(302, '/connected?status=success&platform=pinterest');

  } catch (err) {
    console.error('Pinterest OAuth callback error:', err);
    return res.redirect(302, '/connected?status=error&platform=pinterest');
  }
};
