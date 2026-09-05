'use strict';

/**
 * POST /api/jobs/weekly-summary
 *
 * QStash weekly cron (Monday 9am per user timezone).
 * Generates and sends weekly analytics summary via SMS.
 */

const { getClient, getWeeklyMetrics, upsertWeeklyAnalytics, updateUser } = require('../supabase');
const { computeInsights, evaluateExperiment, proposeExperiment } = require('../growth');
const { generateWeeklySummary } = require('../claude');
const { sendSms } = require('../sms-outbound');
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

  // ── PLANNER / WORKER. THE OLD SHAPE DID NOT SCALE AND FAILED SILENTLY. ────────────────────────
  // This used to load EVERY onboarded user in one query with no limit, then walk them one at a time
  // inside a single 300s function - and each one costs a Graph call, a Claude call and an SMS. At a
  // few seconds each that is roughly 60-70 customers before the function is killed mid-loop, and
  // everybody after that point silently gets nothing: no error raised, no text sent, nothing to see.
  //
  // So one invocation now PLANS: it pages through the eligible ids and enqueues them in small
  // batches, each batch delivered by QStash as its own invocation with its own budget. A call that
  // arrives WITH userIds is a worker and processes only those.
  //
  // Falls back to running inline when enqueueing is not possible, which preserves the old behaviour
  // rather than dropping the week's summaries entirely - but says so loudly, because that path has
  // the ceiling this change exists to remove.
  const BATCH_SIZE = 20;
  const PAGE_SIZE = 1000;
  const userIds = Array.isArray(req.body?.userIds) ? req.body.userIds : null;

  if (!userIds) {
    const ids = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error: pageErr } = await getClient()
        .from('users')
        .select('id')
        .eq('onboarding_complete', true)
        .is('opted_out_at', null)
        .range(from, from + PAGE_SIZE - 1);
      if (pageErr) {
        console.error('Weekly summary: failed to page users:', pageErr);
        return res.status(500).json({ error: pageErr.message });
      }
      ids.push(...(data || []).map((u) => u.id));
      if (!data || data.length < PAGE_SIZE) break;
    }

    const batches = [];
    for (let i = 0; i < ids.length; i += BATCH_SIZE) batches.push(ids.slice(i, i + BATCH_SIZE));

    // Anything run inline still has to be REPORTED. An earlier draft threw the inline results away
    // and answered with only the plan, so a caller that had actually sent summaries was told
    // nothing about them - the counts came back undefined.
    let enqueued = 0;
    let sent = 0;
    let skipped = 0;
    let weekStart = null;
    for (const batch of batches) {
      try {
        const { publishJob } = require('../qstash-publisher');
        await publishJob('weekly-summary', { userIds: batch });
        enqueued += 1;
      } catch (err) {
        console.error('Weekly summary: could not enqueue a batch, running it inline:', err.message);
        const out = await runBatch(batch);
        sent += out.sent;
        skipped += out.skipped;
        weekStart = out.weekStart;
      }
    }
    return res.status(200).json({
      success: true, planned: ids.length, batches: batches.length, enqueued, sent, skipped, weekStart,
    });
  }

  try {
    const out = await runBatch(userIds);
    return res.status(200).json({ success: true, ...out });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/**
 * Process one batch of users and RETURN the counts - deliberately no `res`. The planner calls this
 * inline when enqueueing fails, and it has no response to write to; an earlier draft of this took
 * `res` and would have thrown a TypeError on exactly that fallback path.
 */
async function runBatch(ids) {
  const { data: users, error } = await getClient()
    .from('users')
    .select('id, phone, business_name, business_type, tone, voice_notes, assistant_name, timezone, plan, content_insights, active_experiment')
    .eq('onboarding_complete', true)
    .is('opted_out_at', null)
    .in('id', ids);

  if (error) {
    console.error('Weekly summary: failed to fetch users:', error);
    throw new Error(error.message);
  }

  const weekStart = getLastMondayDate();

  // ALREADY-SENT GUARD. QStash retries a delivery that fails, and a batch that dies halfway through
  // gets redelivered - so without this, everyone the batch already texted gets their weekly summary a
  // second time. weekly_analytics is upserted on (user_id, week_start) and only carries sent_at when
  // a message actually went out, which makes it the natural record of who has already been done.
  //
  // Splitting into batches made the blast radius smaller (a retry now repeats at most one batch
  // rather than every customer) but it did not remove the duplicate, and a customer being texted the
  // same summary twice is both a bad look and a real SMS cost.
  const { data: alreadySent } = await getClient()
    .from('weekly_analytics')
    .select('user_id')
    .eq('week_start', weekStart)
    .not('sent_at', 'is', null)
    .in('user_id', ids);
  const done = new Set((alreadySent || []).map((r) => r.user_id));

  let sent = 0;
  let skipped = 0;

  for (const user of (users || [])) {
    if (done.has(user.id)) { skipped++; continue; }
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

      // ---- Adaptive loop: measure, learn, and set up the next test ----
      // 28-day window of published posts + their snapshots feeds the insight
      // computation (a single week is too thin for buckets).
      const since = new Date();
      since.setDate(since.getDate() - 28);
      const { data: recentPosts } = await getClient()
        .from('scheduled_posts')
        .select('id, content, topic, format, scheduled_for, created_at, status')
        .eq('user_id', user.id)
        .eq('status', 'posted')
        .gte('created_at', since.toISOString());
      let insights = user.content_insights || null;
      let experimentResult = null;
      let nextExperiment = user.active_experiment || null;
      if (recentPosts && recentPosts.length > 0) {
        const postIds = recentPosts.map(p => p.id);
        const { data: recentSnaps } = await getClient()
          .from('analytics_snapshots')
          .select('post_id, platform, snapshot_date, likes, comments, shares, saves, clicks, reach')
          .in('post_id', postIds);
        insights = computeInsights(recentPosts, recentSnaps || [], user.timezone);
        if (user.active_experiment && user.active_experiment.status === 'live') {
          experimentResult = evaluateExperiment(user.active_experiment, recentPosts, recentSnaps || [], user.timezone);
        }
        // Rotate to the next single test only once the current one has a
        // verdict (or there was none); an unresolved test stays live.
        if (!user.active_experiment || (experimentResult && experimentResult.verdict !== 'insufficient')) {
          nextExperiment = proposeExperiment(insights, user.active_experiment);
        }
        await updateUser(user.id, {
          content_insights: insights,
          active_experiment: nextExperiment,
        }).catch(err => console.error('Weekly summary: failed to store insights:', err.message));
      }

      // Generate summary with Claude
      const summary = await generateWeeklySummary(user, {
        postsCount: metrics.posts.length,
        totalReach,
        totalEngagement,
        prevReach,
        topPostContent: topPost?.content || null,
        topPostLikes: Number.isFinite(topPostLikes) ? topPostLikes : 0,
        insights,
        experiment: user.active_experiment || null,
        experimentResult,
        nextExperiment,
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

  return { sent, skipped, weekStart };
}
