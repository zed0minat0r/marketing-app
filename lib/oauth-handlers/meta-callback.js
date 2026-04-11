'use strict';

/**
 * GET /api/oauth/meta/callback?code=xxx&state=yyy
 *
 * Handles Meta OAuth redirect. Exchanges the authorization code for
 * access tokens, fetches connected pages/IG accounts, stores in DB,
 * and texts the user confirmation.
 */

const { getAndDeleteOAuthState, upsertSocialAccount, getUserByPhone, getClient } = require('../supabase');
const { sendSms } = require('../../api/sms/outbound');

async function exchangeCodeForToken(code, redirectUri) {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;

  const url = `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.error) throw new Error(data.error.message);
  return data; // { access_token, token_type, expires_in }
}

async function getLongLivedToken(shortToken) {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;

  const url = `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortToken}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.error) throw new Error(data.error.message);
  return data; // { access_token, token_type, expires_in }
}

async function getConnectedAccounts(accessToken) {
  // Get Facebook Pages
  const pagesRes = await fetch(`https://graph.facebook.com/v19.0/me/accounts?access_token=${accessToken}&fields=id,name,access_token,instagram_business_account`);
  const pagesData = await pagesRes.json();

  if (pagesData.error) throw new Error(pagesData.error.message);

  return pagesData.data || [];
}

async function getUserIdFromToken(accessToken) {
  const res = await fetch(`https://graph.facebook.com/v19.0/me?access_token=${accessToken}&fields=id,name`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).send('Method not allowed');
  }

  const { code, state, error: oauthError } = req.query;

  if (oauthError) {
    return res.redirect(302, '/connected?status=error&platform=instagram&reason=' + encodeURIComponent(oauthError));
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
    const redirectUri = `${appUrl}/api/oauth/meta/callback`;

    // Exchange code for short-lived token
    const shortTokenData = await exchangeCodeForToken(code, redirectUri);

    // Exchange for long-lived token (60 days)
    const longTokenData = await getLongLivedToken(shortTokenData.access_token);
    const accessToken = longTokenData.access_token;

    // Calculate expiry (default 60 days if not provided)
    const expiresIn = longTokenData.expires_in || 5184000; // 60 days in seconds
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Get user info
    const meData = await getUserIdFromToken(accessToken);

    // Save Facebook user account
    await upsertSocialAccount({
      userId,
      platform: 'facebook',
      platformUserId: meData.id,
      platformUsername: meData.name,
      accessToken,
      tokenExpiresAt,
      scopes: ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts'],
    });

    // Get connected pages and Instagram accounts
    const pages = await getConnectedAccounts(accessToken);
    const connectedHandles = [];

    for (const page of pages) {
      // Save Facebook Page
      await upsertSocialAccount({
        userId,
        platform: 'facebook',
        platformUserId: page.id,
        platformUsername: page.name,
        accessToken: page.access_token || accessToken, // Pages have their own tokens
        tokenExpiresAt,
        scopes: ['pages_manage_posts'],
      });
      connectedHandles.push(`FB: ${page.name}`);

      // If page has Instagram business account, save that too
      if (page.instagram_business_account) {
        const igId = page.instagram_business_account.id;

        // Fetch IG username
        const igRes = await fetch(`https://graph.facebook.com/v19.0/${igId}?fields=id,username&access_token=${page.access_token || accessToken}`);
        const igData = await igRes.json();

        await upsertSocialAccount({
          userId,
          platform: 'instagram',
          platformUserId: igId,
          platformUsername: igData.username || `ig_${igId}`,
          accessToken: page.access_token || accessToken,
          tokenExpiresAt,
          scopes: ['instagram_basic', 'instagram_content_publish'],
        });
        connectedHandles.push(`IG: @${igData.username || igId}`);
      }
    }

    // Get user's phone number and text them
    const { data: user } = await getClient()
      .from('users')
      .select('phone, business_name')
      .eq('id', userId)
      .single();

    if (user) {
      const accountsList = connectedHandles.length > 0
        ? connectedHandles.join(', ')
        : 'your Facebook account';

      await sendSms(user.phone,
        `Connected! I can now post to: ${accountsList}\n\nTry: "Write a post about our latest special"`
      );
    }

    return res.redirect(302, '/connected?status=success&platform=instagram');

  } catch (err) {
    console.error('Meta OAuth callback error:', err);
    return res.redirect(302, '/connected?status=error&platform=instagram');
  }
};
