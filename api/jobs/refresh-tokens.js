'use strict';

/**
 * POST /api/jobs/refresh-tokens
 *
 * QStash periodic job (every 50 days) to refresh expiring social media tokens.
 * Meta tokens expire after 60 days — refresh at day 50.
 * Twitter tokens expire periodically — refresh on 401.
 */

const { getClient, upsertSocialAccount } = require('../../lib/supabase');
const { sendSms } = require('../sms/outbound');

async function verifyQStashSignature(req) {
  const currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  if (!currentKey) return true;

  const signature = req.headers['upstash-signature'];
  if (!signature) return false;

  try {
    const { Receiver } = require('@upstash/qstash');
    const receiver = new Receiver({
      currentSigningKey: currentKey,
      nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY,
    });
    await receiver.verify({ signature, body: JSON.stringify(req.body) });
    return true;
  } catch {
    return false;
  }
}

async function refreshMetaToken(account) {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;

  const url = `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${account.access_token}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.error) throw new Error(data.error.message);

  const expiresIn = data.expires_in || 5184000;
  const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  await upsertSocialAccount({
    userId: account.user_id,
    platform: account.platform,
    platformUserId: account.platform_user_id,
    platformUsername: account.platform_username,
    accessToken: data.access_token,
    tokenExpiresAt,
    scopes: account.scopes,
  });

  return tokenExpiresAt;
}

async function refreshTwitterToken(account) {
  if (!account.refresh_token) {
    throw new Error('No refresh token — user must reconnect');
  }

  const clientId = process.env.TWITTER_CLIENT_ID;
  const clientSecret = process.env.TWITTER_CLIENT_SECRET;
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: account.refresh_token,
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

  const tokenExpiresAt = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000).toISOString()
    : null;

  await upsertSocialAccount({
    userId: account.user_id,
    platform: 'twitter',
    platformUserId: account.platform_user_id,
    platformUsername: account.platform_username,
    accessToken: data.access_token,
    refreshToken: data.refresh_token || account.refresh_token,
    tokenExpiresAt,
    scopes: account.scopes,
  });

  return tokenExpiresAt;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const isValid = await verifyQStashSignature(req);
  if (!isValid) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Find tokens expiring in the next 15 days
  const expiryThreshold = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();

  const { data: accounts, error } = await getClient()
    .from('social_accounts')
    .select('*, users!inner(phone)')
    .eq('is_active', true)
    .lt('token_expires_at', expiryThreshold)
    .not('token_expires_at', 'is', null);

  if (error) {
    console.error('Token refresh: failed to fetch accounts:', error);
    return res.status(500).json({ error: error.message });
  }

  let refreshed = 0;
  let failed = 0;

  for (const account of (accounts || [])) {
    try {
      if (account.platform === 'facebook' || account.platform === 'instagram') {
        await refreshMetaToken(account);
        refreshed++;
      } else if (account.platform === 'twitter') {
        await refreshTwitterToken(account);
        refreshed++;
      }
    } catch (err) {
      console.error(`Token refresh failed for account ${account.id}:`, err.message);
      failed++;

      // Notify user if refresh fails so they can reconnect
      if (account.users?.phone) {
        const platform = account.platform.charAt(0).toUpperCase() + account.platform.slice(1);
        await sendSms(account.users.phone,
          `Your ${platform} connection needs to be renewed. Text "Connect ${platform}" to reconnect.`
        ).catch(console.error);
      }

      // Mark account as inactive
      await getClient()
        .from('social_accounts')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', account.id)
        .catch(console.error);
    }
  }

  return res.status(200).json({
    success: true,
    refreshed,
    failed,
    accountsChecked: (accounts || []).length,
  });
};
