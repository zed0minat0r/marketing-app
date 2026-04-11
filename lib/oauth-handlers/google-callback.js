'use strict';

/**
 * GET /api/oauth/google/callback?code=xxx&state=yyy
 *
 * Handles Google OAuth redirect for Google Business Profile API.
 * Exchanges authorization code for access + refresh tokens, fetches
 * the user's Business Profile account, stores in DB, and texts confirmation.
 *
 * Google access tokens expire in 1 hour; refresh tokens do not expire
 * unless revoked by the user or unused for 6+ months.
 */

const { getAndDeleteOAuthState, upsertSocialAccount, getClient } = require('../supabase');
const { sendSms } = require('../../api/sms/outbound');

async function exchangeCodeForToken(code, redirectUri) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error_description || data.error);

  return data; // { access_token, expires_in, refresh_token, scope, token_type }
}

async function getGoogleUserInfo(accessToken) {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message || 'Google userinfo fetch failed');

  return {
    id: data.id,
    name: data.name || data.email || data.id,
    email: data.email,
  };
}

async function getGoogleBusinessAccounts(accessToken) {
  // Fetch Google Business Profile accounts linked to this Google account
  const response = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await response.json();

  // It is not an error if the user has no business accounts yet
  if (data.error && data.error.code !== 404) {
    console.warn('Google Business accounts fetch warning:', data.error.message);
  }

  return data.accounts || [];
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).send('Method not allowed');
  }

  const { code, state, error: oauthError } = req.query;

  if (oauthError) {
    return res.redirect(302, '/connected?status=error&platform=google&reason=' + encodeURIComponent(oauthError));
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
    const redirectUri = `${appUrl}/api/oauth/google/callback`;

    // Exchange code for tokens
    const tokenData = await exchangeCodeForToken(code, redirectUri);
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token || null;

    // Google access tokens expire in 1 hour
    const expiresIn = tokenData.expires_in || 3600;
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Get Google user info
    const googleUser = await getGoogleUserInfo(accessToken);

    // Attempt to fetch Business Profile accounts (non-fatal if none exist)
    const businessAccounts = await getGoogleBusinessAccounts(accessToken);

    // Determine the display name: use first business account or Google profile name
    const primaryBusiness = businessAccounts[0];
    const displayName = primaryBusiness
      ? primaryBusiness.accountName || googleUser.name
      : googleUser.name;

    // Store the account with encrypted tokens
    // platformUserId stores the Google user ID; business account name stored separately if needed
    await upsertSocialAccount({
      userId,
      platform: 'google',
      platformUserId: googleUser.id,
      platformUsername: displayName,
      accessToken,
      refreshToken,
      tokenExpiresAt,
      scopes: (tokenData.scope || '').split(' '),
    });

    // Get user's phone number and text them
    const { data: user } = await getClient()
      .from('users')
      .select('phone, business_name')
      .eq('id', userId)
      .single();

    if (user) {
      const businessInfo = primaryBusiness
        ? `I found your Business Profile: "${displayName}".`
        : 'I connected your Google account. Make sure you have a Google Business Profile set up to enable posting.';

      await sendSms(user.phone,
        `Google Business connected! ${businessInfo}\n\nTry: "Post an update to my Google Business listing"`
      );
    }

    return res.redirect(302, '/connected?status=success&platform=google');

  } catch (err) {
    console.error('Google OAuth callback error:', err);
    return res.redirect(302, '/connected?status=error&platform=google');
  }
};
