'use strict';

const { createClient } = require('@supabase/supabase-js');
const { encrypt, decrypt } = require('./crypto');

let _client = null;

function getClient() {
  if (!_client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    }

    _client = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return _client;
}

// =============================================
// USER HELPERS
// =============================================

async function getUserByPhone(phone) {
  const { data, error } = await getClient()
    .from('users')
    .select('*')
    .eq('phone', phone)
    .single();

  if (error && error.code === 'PGRST116') {
    return null; // Not found
  }
  if (error) throw error;
  return data;
}

async function createUser(phone) {
  const { data, error } = await getClient()
    .from('users')
    .insert({
      phone,
      onboarding_complete: false,
      onboarding_step: 'name',
      plan: 'starter',
      generations_used: 0,
      generations_limit: 50,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function updateUser(userId, updates) {
  const { data, error } = await getClient()
    .from('users')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function incrementGenerationsUsed(userId) {
  const { data, error } = await getClient()
    .rpc('increment_generations_used', { user_id_input: userId });

  if (error) {
    // Fallback to manual increment if RPC not available
    const user = await getClient()
      .from('users')
      .select('generations_used')
      .eq('id', userId)
      .single();

    if (user.error) throw user.error;

    const { error: updateError } = await getClient()
      .from('users')
      .update({ generations_used: (user.data.generations_used || 0) + 1 })
      .eq('id', userId);

    if (updateError) throw updateError;
  }
  return data;
}

async function deleteUser(userId) {
  // Cascades to conversations, social_accounts, scheduled_posts, etc.
  const { error } = await getClient()
    .from('users')
    .delete()
    .eq('id', userId);

  if (error) throw error;
}

// =============================================
// CONVERSATION HELPERS
// =============================================

async function logMessage({ userId, direction, body, intent, twilioSid, claudeModel, tokensUsed }) {
  const { data, error } = await getClient()
    .from('conversations')
    .insert({
      user_id: userId,
      direction,
      body,
      intent: intent || null,
      twilio_sid: twilioSid || null,
      claude_model: claudeModel || null,
      tokens_used: tokensUsed || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function getRecentMessages(userId, limit = 20) {
  const { data, error } = await getClient()
    .from('conversations')
    .select('direction, body, created_at, intent')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  // Return in chronological order (oldest first)
  return (data || []).reverse();
}

// =============================================
// SOCIAL ACCOUNT HELPERS
// =============================================

async function getSocialAccounts(userId) {
  const { data, error } = await getClient()
    .from('social_accounts')
    .select('platform, platform_username, platform_user_id, is_active, token_expires_at')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (error) throw error;
  // This query doesn't select token fields, so no decryption needed
  return data || [];
}

async function getSocialAccount(userId, platform) {
  const { data, error } = await getClient()
    .from('social_accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('platform', platform)
    .eq('is_active', true)
    .single();

  if (error && error.code === 'PGRST116') return null;
  if (error) throw error;
  return _decryptAccount(data);
}

async function upsertSocialAccount({ userId, platform, platformUserId, platformUsername, accessToken, refreshToken, tokenExpiresAt, scopes }) {
  // Encrypt tokens before storing
  let encryptedAccess = null;
  let encryptedRefresh = null;
  try {
    encryptedAccess = accessToken ? encrypt(accessToken) : null;
    encryptedRefresh = refreshToken ? encrypt(refreshToken) : null;
  } catch (cryptoErr) {
    // If ENCRYPTION_KEY is not set (e.g., local dev without it), store plaintext with warning
    console.warn('Token encryption skipped (ENCRYPTION_KEY not configured):', cryptoErr.message);
    encryptedAccess = accessToken || null;
    encryptedRefresh = refreshToken || null;
  }

  const { data, error } = await getClient()
    .from('social_accounts')
    .upsert({
      user_id: userId,
      platform,
      platform_user_id: platformUserId,
      platform_username: platformUsername,
      access_token: encryptedAccess,
      refresh_token: encryptedRefresh || null,
      token_expires_at: tokenExpiresAt || null,
      scopes: scopes || [],
      is_active: true,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,platform,platform_user_id',
    })
    .select()
    .single();

  if (error) throw error;

  // Return with decrypted tokens for immediate use
  return _decryptAccount(data);
}

/**
 * Decrypt token fields on a social_accounts row.
 * Safe to call with plaintext tokens (will return as-is if not encrypted format).
 */
function _decryptAccount(account) {
  if (!account) return account;
  try {
    return {
      ...account,
      access_token: account.access_token ? decrypt(account.access_token) : null,
      refresh_token: account.refresh_token ? decrypt(account.refresh_token) : null,
    };
  } catch (err) {
    console.warn('Token decryption failed — using raw value:', err.message);
    return account;
  }
}

// =============================================
// SCHEDULED POSTS HELPERS
// =============================================

async function createScheduledPost({ userId, platforms, content, mediaUrl, scheduledFor, status }) {
  const { data, error } = await getClient()
    .from('scheduled_posts')
    .insert({
      user_id: userId,
      platforms,
      content,
      media_url: mediaUrl || null,
      scheduled_for: scheduledFor || null,
      status: status || 'draft',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function getScheduledPost(postId) {
  const { data, error } = await getClient()
    .from('scheduled_posts')
    .select('*')
    .eq('id', postId)
    .single();

  if (error) throw error;
  return data;
}

async function updateScheduledPost(postId, updates) {
  const { data, error } = await getClient()
    .from('scheduled_posts')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', postId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function getUpcomingPosts(userId, limit = 10) {
  const { data, error } = await getClient()
    .from('scheduled_posts')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['queued', 'draft'])
    .order('scheduled_for', { ascending: true, nullsFirst: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

async function cancelPost(postId, userId) {
  const { data, error } = await getClient()
    .from('scheduled_posts')
    .update({ status: 'canceled', updated_at: new Date().toISOString() })
    .eq('id', postId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// =============================================
// OAUTH STATE HELPERS
// =============================================

async function createOAuthState({ userId, platform, state, expiresAt }) {
  const { data, error } = await getClient()
    .from('oauth_states')
    .insert({
      user_id: userId,
      platform,
      state,
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function getAndDeleteOAuthState(state) {
  const { data, error } = await getClient()
    .from('oauth_states')
    .select('*')
    .eq('state', state)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (error && error.code === 'PGRST116') return null;
  if (error) throw error;

  // Delete it (one-time use)
  await getClient()
    .from('oauth_states')
    .delete()
    .eq('id', data.id);

  return data;
}

// =============================================
// ANALYTICS HELPERS
// =============================================

async function insertAnalyticsSnapshot({ postId, platform, impressions, reach, likes, comments, shares, saves, clicks, rawData }) {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await getClient()
    .from('analytics_snapshots')
    .upsert({
      post_id: postId,
      platform,
      impressions: impressions || 0,
      reach: reach || 0,
      likes: likes || 0,
      comments: comments || 0,
      shares: shares || 0,
      saves: saves || 0,
      clicks: clicks || 0,
      raw_data: rawData || null,
      snapshot_date: today,
    }, {
      onConflict: 'post_id,platform,snapshot_date',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function getWeeklyMetrics(userId, weekStart) {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  // Get all posts for this user in this week
  const { data: posts, error: postsError } = await getClient()
    .from('scheduled_posts')
    .select('id, platforms, content, created_at')
    .eq('user_id', userId)
    .eq('status', 'posted')
    .gte('created_at', weekStart)
    .lt('created_at', weekEnd.toISOString());

  if (postsError) throw postsError;

  if (!posts || posts.length === 0) {
    return { posts: [], snapshots: [], totals: { reach: 0, impressions: 0, engagement: 0 } };
  }

  const postIds = posts.map(p => p.id);
  const { data: snapshots, error: snapshotsError } = await getClient()
    .from('analytics_snapshots')
    .select('*')
    .in('post_id', postIds);

  if (snapshotsError) throw snapshotsError;

  const totals = (snapshots || []).reduce((acc, s) => ({
    reach: acc.reach + (s.reach || 0),
    impressions: acc.impressions + (s.impressions || 0),
    engagement: acc.engagement + (s.likes || 0) + (s.comments || 0) + (s.shares || 0),
  }), { reach: 0, impressions: 0, engagement: 0 });

  return { posts, snapshots: snapshots || [], totals };
}

async function upsertWeeklyAnalytics({ userId, weekStart, postsCount, totalReach, totalImpressions, totalEngagement, topPostId, summaryText, sentAt }) {
  const { data, error } = await getClient()
    .from('weekly_analytics')
    .upsert({
      user_id: userId,
      week_start: weekStart,
      posts_count: postsCount || 0,
      total_reach: totalReach || 0,
      total_impressions: totalImpressions || 0,
      total_engagement: totalEngagement || 0,
      top_post_id: topPostId || null,
      summary_text: summaryText || null,
      sent_at: sentAt || null,
    }, {
      onConflict: 'user_id,week_start',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// =============================================
// REFERRAL HELPERS
// =============================================

/**
 * Generate and store a referral code for a user.
 * Idempotent: returns existing code if already set.
 */
async function ensureReferralCode(userId) {
  // Check if already has a code
  const { data: existing, error: fetchErr } = await getClient()
    .from('users')
    .select('referral_code')
    .eq('id', userId)
    .single();
  if (fetchErr) throw fetchErr;
  if (existing.referral_code) return existing.referral_code;

  // Generate via DB function
  const { data: code, error: genErr } = await getClient().rpc('generate_referral_code');
  if (genErr) throw genErr;

  const { error: updateErr } = await getClient()
    .from('users')
    .update({ referral_code: code, updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (updateErr) throw updateErr;

  return code;
}

/**
 * Assign a queue position to a user if they do not have one yet.
 */
async function ensureQueuePosition(userId) {
  const { data: existing, error: fetchErr } = await getClient()
    .from('users')
    .select('queue_position')
    .eq('id', userId)
    .single();
  if (fetchErr) throw fetchErr;
  if (existing.queue_position) return existing.queue_position;

  const { data: pos, error: rpcErr } = await getClient().rpc('assign_queue_position', {
    user_id_input: userId,
  });
  if (rpcErr) throw rpcErr;
  return pos;
}

/**
 * Get a user by their referral code.
 */
async function getUserByReferralCode(code) {
  const { data, error } = await getClient()
    .from('users')
    .select('*')
    .eq('referral_code', code)
    .single();

  if (error && error.code === 'PGRST116') return null;
  if (error) throw error;
  return data;
}

/**
 * Create a referral record.
 */
async function createReferral({ referrerUserId, referredEmail, referredPhone, status }) {
  const { data, error } = await getClient()
    .from('referrals')
    .insert({
      referrer_user_id: referrerUserId,
      referred_email: referredEmail || null,
      referred_phone: referredPhone || null,
      status: status || 'pending',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Mark a referral as converted.
 */
async function convertReferral(referralId) {
  const { data, error } = await getClient()
    .from('referrals')
    .update({ status: 'converted' })
    .eq('id', referralId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Credit a referrer using the DB stored procedure.
 * Returns { new_referral_count, new_queue_position, reward_claimed }.
 */
async function creditReferrer(referrerId) {
  const { data, error } = await getClient().rpc('credit_referrer', {
    referrer_id_input: referrerId,
  });
  if (error) throw error;
  return data && data[0] ? data[0] : data;
}

/**
 * Get referral stats for a user.
 */
async function getReferralStats(userId) {
  const { data: user, error: userErr } = await getClient()
    .from('users')
    .select('referral_code, queue_position, referral_count, referral_reward_claimed')
    .eq('id', userId)
    .single();
  if (userErr) throw userErr;

  const { data: referrals, error: refErr } = await getClient()
    .from('referrals')
    .select('id, referred_phone, referred_email, status, created_at')
    .eq('referrer_user_id', userId)
    .order('created_at', { ascending: false });
  if (refErr) throw refErr;

  return {
    referralCode: user.referral_code,
    queuePosition: user.queue_position,
    referralCount: user.referral_count || 0,
    rewardClaimed: user.referral_reward_claimed || false,
    referrals: referrals || [],
  };
}

// =============================================
// USER MANAGEMENT
// =============================================

async function getAllUsersWithActiveAccounts() {
  const { data, error } = await getClient()
    .from('users')
    .select(`
      id, phone, business_name, business_type, tone, timezone, plan,
      social_accounts!inner(platform, is_active)
    `)
    .eq('onboarding_complete', true)
    .eq('social_accounts.is_active', true);

  if (error) throw error;
  return data || [];
}

module.exports = {
  getClient,
  getUserByPhone,
  createUser,
  updateUser,
  incrementGenerationsUsed,
  deleteUser,
  logMessage,
  getRecentMessages,
  getSocialAccounts,
  getSocialAccount,
  upsertSocialAccount,
  createScheduledPost,
  getScheduledPost,
  updateScheduledPost,
  getUpcomingPosts,
  cancelPost,
  createOAuthState,
  getAndDeleteOAuthState,
  insertAnalyticsSnapshot,
  getWeeklyMetrics,
  upsertWeeklyAnalytics,
  getAllUsersWithActiveAccounts,
  // Referral helpers
  ensureReferralCode,
  ensureQueuePosition,
  getUserByReferralCode,
  createReferral,
  convertReferral,
  creditReferrer,
  getReferralStats,
};
