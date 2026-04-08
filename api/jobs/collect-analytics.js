'use strict';

/**
 * POST /api/jobs/collect-analytics
 *
 * Nightly QStash cron job (2am UTC).
 * Collects engagement metrics for all posted content from the last 24 hours.
 */

const { getAllUsersWithActiveAccounts, getClient, insertAnalyticsSnapshot } = require('../../lib/supabase');

async function verifyQStashSignature(req) {
  const currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  if (!currentKey) return true; // Skip in dev

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

async function collectFacebookInsights(postId, fbPostId, pageToken) {
  const metrics = ['post_impressions_unique', 'post_impressions', 'post_reactions_by_type_total', 'post_clicks'];

  const url = `https://graph.facebook.com/v19.0/${fbPostId}/insights?metric=${metrics.join(',')}&access_token=${pageToken}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.error) throw new Error(data.error.message);

  const results = { raw: data };
  for (const item of (data.data || [])) {
    switch (item.name) {
      case 'post_impressions_unique': results.reach = item.values?.[0]?.value || 0; break;
      case 'post_impressions': results.impressions = item.values?.[0]?.value || 0; break;
      case 'post_clicks': results.clicks = item.values?.[0]?.value || 0; break;
      case 'post_reactions_by_type_total': {
        const reactions = item.values?.[0]?.value || {};
        results.likes = Object.values(reactions).reduce((sum, v) => sum + (v || 0), 0);
        break;
      }
    }
  }

  // Get comments count
  const commentsRes = await fetch(`https://graph.facebook.com/v19.0/${fbPostId}?fields=comments.summary(true)&access_token=${pageToken}`);
  const commentsData = await commentsRes.json();
  results.comments = commentsData.comments?.summary?.total_count || 0;

  // Get shares count
  const sharesRes = await fetch(`https://graph.facebook.com/v19.0/${fbPostId}?fields=shares&access_token=${pageToken}`);
  const sharesData = await sharesRes.json();
  results.shares = sharesData.shares?.count || 0;

  return results;
}

async function collectInstagramInsights(postId, igMediaId, accessToken) {
  const url = `https://graph.facebook.com/v19.0/${igMediaId}/insights?metric=reach,impressions,likes,comments,shares,saved&access_token=${accessToken}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.error) throw new Error(data.error.message);

  const results = { raw: data };
  for (const item of (data.data || [])) {
    switch (item.name) {
      case 'reach': results.reach = item.values?.[0]?.value || 0; break;
      case 'impressions': results.impressions = item.values?.[0]?.value || 0; break;
      case 'likes': results.likes = item.values?.[0]?.value || 0; break;
      case 'comments': results.comments = item.values?.[0]?.value || 0; break;
      case 'shares': results.shares = item.values?.[0]?.value || 0; break;
      case 'saved': results.saves = item.values?.[0]?.value || 0; break;
    }
  }

  return results;
}

async function collectTwitterMetrics(tweetId, accessToken) {
  const url = `https://api.twitter.com/2/tweets/${tweetId}?tweet.fields=public_metrics,non_public_metrics`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await response.json();

  if (data.errors) throw new Error(data.errors[0]?.message || 'Twitter API error');

  const metrics = data.data?.public_metrics || {};
  const nonPublic = data.data?.non_public_metrics || {};

  return {
    impressions: metrics.impression_count || nonPublic.impression_count || 0,
    likes: metrics.like_count || 0,
    comments: metrics.reply_count || 0,
    shares: metrics.retweet_count || 0,
    clicks: nonPublic.url_link_clicks || 0,
    raw: data,
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const isValid = await verifyQStashSignature(req);
  if (!isValid) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const since = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(); // Last 25 hours

  try {
    // Get all posts that were published in the last 25 hours
    const { data: posts, error } = await getClient()
      .from('scheduled_posts')
      .select('id, user_id, platforms, published_urls, content')
      .eq('status', 'posted')
      .gte('updated_at', since);

    if (error) throw error;

    let collected = 0;
    let failed = 0;

    for (const post of (posts || [])) {
      for (const platform of post.platforms) {
        const platformPostId = post.published_urls?.[platform];
        if (!platformPostId) continue;

        try {
          const { getSocialAccount } = require('../../lib/supabase');
          const account = await getSocialAccount(post.user_id, platform);
          if (!account) continue;

          let metrics = {};

          if (platform === 'facebook') {
            const fbPostId = platformPostId.split('/posts/').join('_');
            metrics = await collectFacebookInsights(post.id, fbPostId, account.access_token);
          } else if (platform === 'instagram') {
            const igMediaId = platformPostId.split('/p/')[1]?.split('/')[0] || platformPostId;
            metrics = await collectInstagramInsights(post.id, igMediaId, account.access_token);
          } else if (platform === 'twitter') {
            const tweetId = platformPostId.split('/status/')[1]?.split('/')[0] || platformPostId;
            metrics = await collectTwitterMetrics(tweetId, account.access_token);
          }

          await insertAnalyticsSnapshot({
            postId: post.id,
            platform,
            impressions: metrics.impressions || 0,
            reach: metrics.reach || 0,
            likes: metrics.likes || 0,
            comments: metrics.comments || 0,
            shares: metrics.shares || 0,
            saves: metrics.saves || 0,
            clicks: metrics.clicks || 0,
            rawData: metrics.raw || null,
          });

          collected++;

        } catch (err) {
          console.error(`Analytics collection failed for post ${post.id} on ${platform}:`, err.message);
          failed++;
        }
      }
    }

    return res.status(200).json({
      success: true,
      collected,
      failed,
      postsProcessed: (posts || []).length,
    });

  } catch (err) {
    console.error('Analytics collection job error:', err);
    return res.status(500).json({ error: err.message });
  }
};
