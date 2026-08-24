'use strict';

/**
 * Growth engine - pure analysis over posts + analytics snapshots.
 *
 * Everything here returns MEASURED conclusions or explicitly says there is
 * not enough data (RULE 7: never invent numbers). No I/O - callers fetch
 * rows and persist results.
 */

const MIN_BUCKET_SAMPLE = 3;   // below this, a bucket is a best-post callout, not a trend
const MIN_EXPERIMENT_POSTS = 2; // per arm, before an experiment verdict

/**
 * Engagement for one post: latest snapshot per platform, summed.
 * (Snapshots are cumulative per snapshot_date; the latest row per platform
 * is the current total for that platform.)
 */
function postEngagement(postId, snapshots) {
  const latestByPlatform = new Map();
  for (const s of snapshots) {
    if (s.post_id !== postId) continue;
    const prev = latestByPlatform.get(s.platform);
    if (!prev || s.snapshot_date > prev.snapshot_date) latestByPlatform.set(s.platform, s);
  }
  let engagement = 0;
  let reach = 0;
  for (const s of latestByPlatform.values()) {
    engagement += (s.likes || 0) + (s.comments || 0) + (s.shares || 0) + (s.saves || 0) + (s.clicks || 0);
    reach += s.reach || 0;
  }
  return { engagement, reach, measured: latestByPlatform.size > 0 };
}

function bucketWinner(scored, keyFn) {
  const buckets = new Map();
  for (const p of scored) {
    const key = keyFn(p);
    if (!key) continue;
    const b = buckets.get(key) || { key, count: 0, total: 0 };
    b.count += 1;
    b.total += p.engagement;
    buckets.set(key, b);
  }
  let winner = null;
  for (const b of buckets.values()) {
    if (b.count < MIN_BUCKET_SAMPLE) continue;
    const avg = b.total / b.count;
    if (!winner || avg > winner.avg) winner = { key: b.key, avg, count: b.count };
  }
  return winner;
}

/**
 * Compute rolling insights from published posts + their snapshots.
 *
 * @param {Array} posts - scheduled_posts rows (published; with topic/format/scheduled_for/content)
 * @param {Array} snapshots - analytics_snapshots rows for those posts
 * @param {string} timezone - user's IANA timezone for local-hour bucketing
 * @returns {Object} insights, always with { as_of, sample_size }; winner
 *   fields only when measured.
 */
function computeInsights(posts, snapshots, timezone) {
  const scored = [];
  for (const p of posts) {
    const { engagement, reach, measured } = postEngagement(p.id, snapshots);
    if (!measured) continue;
    let hourLocal = null;
    if (p.scheduled_for) {
      try {
        hourLocal = parseInt(new Intl.DateTimeFormat('en-US', {
          hour: 'numeric', hour12: false, timeZone: timezone || 'America/New_York',
        }).format(new Date(p.scheduled_for)), 10);
      } catch { hourLocal = null; }
    }
    scored.push({ id: p.id, content: p.content || '', topic: p.topic, format: p.format, hourLocal, engagement, reach });
  }

  const insights = {
    as_of: new Date().toISOString().slice(0, 10),
    sample_size: scored.length,
  };
  if (scored.length === 0) return insights;

  insights.avg_engagement = Math.round((scored.reduce((s, p) => s + p.engagement, 0) / scored.length) * 10) / 10;

  const best = scored.reduce((a, b) => (b.engagement > a.engagement ? b : a));
  insights.best_post = {
    content_preview: best.content.slice(0, 60),
    engagement: best.engagement,
    topic: best.topic || null,
    format: best.format || null,
  };

  const topTopic = bucketWinner(scored, (p) => p.topic);
  if (topTopic) insights.top_topic = { name: topTopic.key, avg_engagement: Math.round(topTopic.avg * 10) / 10, posts: topTopic.count };
  const topFormat = bucketWinner(scored, (p) => p.format);
  if (topFormat) insights.top_format = { name: topFormat.key, avg_engagement: Math.round(topFormat.avg * 10) / 10, posts: topFormat.count };
  const bestHour = bucketWinner(scored, (p) => (p.hourLocal === null ? null : String(p.hourLocal)));
  if (bestHour) insights.best_hour_local = { hour: parseInt(bestHour.key, 10), avg_engagement: Math.round(bestHour.avg * 10) / 10, posts: bestHour.count };

  return insights;
}

/**
 * Evaluate the live experiment against measured posts.
 * Variant arm = posts matching the experiment's variant condition;
 * control arm = the rest.
 *
 * @returns {{verdict: 'variant'|'control'|'insufficient', detail: string,
 *            variant_avg?: number, control_avg?: number}}
 */
function evaluateExperiment(experiment, posts, snapshots, timezone) {
  if (!experiment || !experiment.type) return { verdict: 'insufficient', detail: 'no experiment' };

  const matchesVariant = (p) => {
    if (experiment.type === 'posting_time') {
      if (!p.scheduled_for) return false;
      try {
        const h = parseInt(new Intl.DateTimeFormat('en-US', {
          hour: 'numeric', hour12: false, timeZone: timezone || 'America/New_York',
        }).format(new Date(p.scheduled_for)), 10);
        return String(h) === String(experiment.variant);
      } catch { return false; }
    }
    if (experiment.type === 'format') return p.format === experiment.variant;
    if (experiment.type === 'topic') return p.topic === experiment.variant;
    return false;
  };

  const arms = { variant: [], control: [] };
  for (const p of posts) {
    if (new Date(p.created_at || 0) < new Date(experiment.started_at || 0)) continue;
    const { engagement, measured } = postEngagement(p.id, snapshots);
    if (!measured) continue;
    arms[matchesVariant(p) ? 'variant' : 'control'].push(engagement);
  }

  if (arms.variant.length < MIN_EXPERIMENT_POSTS || arms.control.length < MIN_EXPERIMENT_POSTS) {
    return {
      verdict: 'insufficient',
      detail: `need ${MIN_EXPERIMENT_POSTS}+ measured posts per arm (have ${arms.variant.length} variant, ${arms.control.length} control)`,
    };
  }

  const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const variantAvg = Math.round(avg(arms.variant) * 10) / 10;
  const controlAvg = Math.round(avg(arms.control) * 10) / 10;
  return {
    verdict: variantAvg > controlAvg ? 'variant' : 'control',
    detail: `variant avg ${variantAvg} vs control avg ${controlAvg} engagement/post`,
    variant_avg: variantAvg,
    control_avg: controlAvg,
  };
}

/**
 * Propose the next single experiment. v1 rotates the dimension so one thing
 * changes at a time; the variant comes from measured insights when available.
 */
function proposeExperiment(insights, lastExperiment) {
  const order = ['posting_time', 'format', 'topic'];
  const lastIdx = lastExperiment ? order.indexOf(lastExperiment.type) : -1;
  const type = order[(lastIdx + 1) % order.length];

  const started_at = new Date().toISOString();

  if (type === 'posting_time') {
    const current = insights?.best_hour_local?.hour;
    // Test evening posting unless evening already won
    const variant = current === 19 ? 12 : 19;
    return {
      type, variant: String(variant), control: current != null ? String(current) : 'usual times', started_at, status: 'live',
      description: `posting at ${variant}:00 local`,
    };
  }
  if (type === 'format') {
    const current = insights?.top_format?.name;
    const variant = current === 'question' ? 'offer' : 'question';
    return { type, variant, control: current || 'usual mix', started_at, status: 'live', description: `leading with a ${variant} post` };
  }
  const currentTopic = insights?.top_topic?.name;
  return {
    type: 'topic',
    variant: 'behind_the_scenes',
    control: currentTopic || 'usual topics',
    started_at,
    status: 'live',
    description: 'a behind-the-scenes post about the people/process',
  };
}

module.exports = {
  postEngagement,
  computeInsights,
  evaluateExperiment,
  proposeExperiment,
  MIN_BUCKET_SAMPLE,
  MIN_EXPERIMENT_POSTS,
};
