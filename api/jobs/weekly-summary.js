'use strict';

/**
 * POST /api/jobs/weekly-summary
 *
 * QStash weekly cron (Monday 9am per user timezone).
 * Generates and sends weekly analytics summary via SMS.
 */

const { getClient, getWeeklyMetrics, upsertWeeklyAnalytics } = require('../../lib/supabase');
const { generateWeeklySummary } = require('../../lib/claude');
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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const isValid = await verifyQStashSignature(req);
  if (!isValid) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Get all users with connected social accounts
  const { data: users, error } = await getClient()
    .from('users')
    .select('id, phone, business_name, business_type, tone, timezone, plan')
    .eq('onboarding_complete', true);

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
      if (metrics.posts.length === 0) {
        skipped++;
        continue;
      }

      // Find top post by engagement
      let topPost = null;
      let maxEngagement = 0;
      for (const post of metrics.posts) {
        const postSnapshots = metrics.snapshots.filter(s => s.post_id === post.id);
        const engagement = postSnapshots.reduce((sum, s) =>
          sum + (s.likes || 0) + (s.comments || 0) + (s.shares || 0), 0
        );
        if (engagement > maxEngagement) {
          maxEngagement = engagement;
          topPost = post;
        }
      }

      // Get previous week for comparison
      const prevWeekStart = new Date(weekStart);
      prevWeekStart.setDate(prevWeekStart.getDate() - 7);
      const prevMetrics = await getWeeklyMetrics(user.id, prevWeekStart.toISOString().split('T')[0]);

      // Generate summary with Claude
      const summary = await generateWeeklySummary(user, {
        postsCount: metrics.posts.length,
        totalReach: metrics.totals.reach,
        totalEngagement: metrics.totals.engagement,
        prevReach: prevMetrics.totals.reach,
        topPostContent: topPost?.content,
        topPostLikes: topPost
          ? metrics.snapshots
              .filter(s => s.post_id === topPost.id)
              .reduce((sum, s) => sum + (s.likes || 0), 0)
          : 0,
      });

      // Send the summary
      await sendSms(user.phone, summary);
      sent++;

      // Store the weekly analytics record
      await upsertWeeklyAnalytics({
        userId: user.id,
        weekStart,
        postsCount: metrics.posts.length,
        totalReach: metrics.totals.reach,
        totalImpressions: metrics.totals.impressions,
        totalEngagement: metrics.totals.engagement,
        topPostId: topPost?.id || null,
        summaryText: summary,
        sentAt: new Date().toISOString(),
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
