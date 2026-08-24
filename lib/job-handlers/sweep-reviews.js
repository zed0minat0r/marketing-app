'use strict';

/**
 * POST /api/jobs/sweep-reviews (rides the daily dispatch cron)
 *
 * For every active user with a connected Google account: list unanswered
 * Google reviews, draft replies, and text the owner for approval. Capped at
 * 2 notifications per user per sweep so nobody wakes up to a wall of texts.
 */

const { getClient } = require('../supabase');
const { sweepReviewsForUser } = require('../review-replies');
const { requireCronAuth } = require('../cron-auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!requireCronAuth(req, res)) return;

  const { data: accounts, error } = await getClient()
    .from('social_accounts')
    .select('user_id')
    .eq('platform', 'google')
    .eq('is_active', true);
  if (error) {
    return res.status(500).json({ error: error.message });
  }

  const userIds = [...new Set((accounts || []).map(a => a.user_id))];
  let notified = 0;
  let checked = 0;
  for (const userId of userIds) {
    try {
      const { data: user } = await getClient()
        .from('users').select('*').eq('id', userId)
        .eq('onboarding_complete', true).is('opted_out_at', null)
        .single();
      if (!user) continue;
      checked++;
      const result = await sweepReviewsForUser(user);
      notified += result.notified || 0;
    } catch (err) {
      console.error(`Review sweep failed for user ${userId}:`, err.message);
    }
  }

  return res.status(200).json({ success: true, checked, notified });
};
