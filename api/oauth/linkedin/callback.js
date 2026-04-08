'use strict';

/**
 * GET /api/oauth/linkedin/callback?code=xxx&state=yyy
 *
 * Handles LinkedIn OAuth redirect. Exchanges the authorization code for
 * access tokens, fetches user profile, stores in DB, and texts confirmation.
 *
 * LinkedIn tokens expire after 60 days. The API does not issue refresh tokens
 * on the basic Marketing Developer Platform — users must reconnect at expiry.
 */

const { getAndDeleteOAuthState, upsertSocialAccount, getClient } = require('../../../lib/supabase');
const { sendSms } = require('../../sms/outbound');

async function exchangeCodeForToken(code, redirectUri) {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error_description || data.error);

  return data; // { access_token, expires_in, scope }
}

async function getLinkedInProfile(accessToken) {
  const response = await fetch('https://api.linkedin.com/v2/me?projection=(id,localizedFirstName,localizedLastName)', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'LinkedIn-Version': '202304',
    },
  });

  const data = await response.json();
  if (data.status >= 400) throw new Error(data.message || 'LinkedIn profile fetch failed');

  return {
    id: data.id,
    name: `${data.localizedFirstName || ''} ${data.localizedLastName || ''}`.trim() || data.id,
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).send('Method not allowed');
  }

  const { code, state, error: oauthError } = req.query;

  if (oauthError) {
    return res.redirect(302, '/connected?status=error&platform=linkedin&reason=' + encodeURIComponent(oauthError));
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
    const redirectUri = `${appUrl}/api/oauth/linkedin/callback`;

    // Exchange code for access token
    const tokenData = await exchangeCodeForToken(code, redirectUri);
    const accessToken = tokenData.access_token;

    // LinkedIn tokens expire in 60 days by default
    const expiresIn = tokenData.expires_in || 5184000;
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Get profile info
    const profile = await getLinkedInProfile(accessToken);

    // Store the account with encrypted token
    await upsertSocialAccount({
      userId,
      platform: 'linkedin',
      platformUserId: profile.id,
      platformUsername: profile.name,
      accessToken,
      tokenExpiresAt,
      scopes: (tokenData.scope || 'w_member_social r_liteprofile').split(' '),
    });

    // Get user's phone number and text them
    const { data: user } = await getClient()
      .from('users')
      .select('phone, business_name')
      .eq('id', userId)
      .single();

    if (user) {
      await sendSms(user.phone,
        `LinkedIn connected! I can now post to your profile as ${profile.name}.\n\nTry: "Write a LinkedIn post about our new product launch"`
      );
    }

    return res.redirect(302, '/connected?status=success&platform=linkedin');

  } catch (err) {
    console.error('LinkedIn OAuth callback error:', err);
    return res.redirect(302, '/connected?status=error&platform=linkedin');
  }
};
