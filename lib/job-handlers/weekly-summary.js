'use strict';

/**
 * POST /api/jobs/weekly-summary
 *
 * QStash weekly cron (Monday 9am per user timezone).
 * Generates and sends weekly analytics summary via SMS.
 */

const { getClient, getWeeklyMetrics, upsertWeeklyAnalytics } = require('../supabase');
const { generateWeeklySummary } = require('../claude');
const { sendSms } = require('../../api/sms/outbound');
const { requireCronAuth } = require('../cron-auth');

function getMondayOfCurrentWeek() {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon...
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split('T')[0];
}

function getLastMondayDate() {
  const monday = new Date(getMondayOfCurrentWeek());
  monday.setDate(monday.getDate() - 7);
  return monday.toISOString().split('T')[0];
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!requireCronAuth(req, res)) return;

  // Get all users with completed onboarding who haven't opted out of SMS.
  // (sendSms also gates on opted_out_at, but filtering at the SQL level here
  // means we don't burn Claude tokens generating summaries that won't ship.)
  const { data: users, error } = await getClient()
    .from('users')
    .select('id, phone, business_name, business_type, tone, voice_notes, assistant_name, timezone, plan')
    .eq('onboarding_complete', true)
    .is('opted_out_at', null);

  if (error) {
    console.error('Weekly summary: failed to fetch users:', error);
    return res.status(500).json({ error: error.message });
  }

  const weekStart = getLastMondayDate();
  let sent = 0;
  let skipped = 0;

  for (const user of (users || [])) {
    try {
      const metrics = await getWeeklyMetrics(user.id, weekStart);

      // Skip if no posts this week
      if (!metrics.posts || metrics.posts.length === 0) {
        skipped++;
        continue;
      }

      // Find top post by engagement (guard against NaN)
      let topPost = null;
      let maxEngagement = 0;
      for (const post of metrics.posts) {
        const postSnapshots = metrics.snapshots.filter(s => s.post_id === post.id);
        const rawEngagement = postSnapshots.reduce((sum, s) =>
          sum + (s.likes || 0) + (s.comments || 0) + (s.shares || 0), 0
        );
        const engagement = Number.isFinite(rawEngagement) ? rawEngagement : 0;
        if (engagement > maxEngagement) {
          maxEngagement = engagement;
          topPost = post;
        }
      }

      // Guard totals against NaN
      const totalReach = Number.isFinite(metrics.totals.reach) ? metrics.totals.reach : 0;
      const totalEngagement = Number.isFinite(metrics.totals.engagement) ? metrics.totals.engagement : 0;
      const totalImpressions = Number.isFinite(metrics.totals.impressions) ? metrics.totals.impressions : 0;

      // Get previous week for comparison
      const prevWeekStart = new Date(weekStart);
      prevWeekStart.setDate(prevWeekStart.getDate() - 7);
      const prevMetrics = await getWeeklyMetrics(user.id, prevWeekStart.toISOString().split('T')[0]);
      const prevReach = Number.isFinite(prevMetrics?.totals?.reach) ? prevMetrics.totals.reach : 0;

      // Compute top post likes safely
      const topPostLikes = topPost
        ? metrics.snapshots
            .filter(s => s.post_id === topPost.id)
            .reduce((sum, s) => sum + (s.likes || 0), 0)
        : 0;

      // Generate summary with Claude
      const summary = await generateWeeklySummary(user, {
        postsCount: metrics.posts.length,
        totalReach,
        totalEngagement,
        prevReach,
        topPostContent: topPost?.content || null,
        topPostLikes: Number.isFinite(topPostLikes) ? topPostLikes : 0,
      });

      // Send the summary. sendSms returns { skipped: true } when the user
      // has opted out between the SQL filter above and now (race) — don't
      // count those as sent, and don't claim we sent them in the analytics
      // table.
      const smsResult = await sendSms(user.phone, summary);
      const didDeliver = !smsResult?.skipped;
      if (didDeliver) sent++; else skipped++;

      // Store the weekly analytics record. Always persist the computed
      // summary text — but only mark sent_at when we actually delivered.
      await upsertWeeklyAnalytics({
        userId: user.id,
        weekStart,
        postsCount: metrics.posts.length,
        totalReach,
        totalImpressions,
        totalEngagement,
        topPostId: topPost?.id || null,
        summaryText: summary,
        sentAt: didDeliver ? new Date().toISOString() : null,
      });

    } catch (err) {
      console.error(`Weekly summary failed for user ${user.id}:`, err.message);
      skipped++;
    }
  }

  return res.status(200).json({
    success: true,
    sent,
    skipped,
    weekStart,
  });
};
