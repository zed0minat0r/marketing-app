'use strict';

/**
 * POST /api/jobs/collect-analytics
 *
 * Nightly QStash cron job (2am UTC).
 * Collects engagement metrics for all posted content from the last 24 hours.
 */

const { getAllUsersWithActiveAccounts, getClient, insertAnalyticsSnapshot } = require('../supabase');

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

async function collectLinkedInMetrics(ugcPostUrn, accessToken) {
  // LinkedIn UGC Post Statistics API
  // Requires the share URN — extract from the post URL or the stored URN
  // URL format: https://www.linkedin.com/feed/update/urn:li:ugcPost:{id}/
  // We encode the URN for use in the query parameter
  const encodedUrn = encodeURIComponent(ugcPostUrn);

  const url = `https://api.linkedin.com/v2/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${encodedUrn}&shares[0]=${encodedUrn}`;

  // Fallback: use the share statistics endpoint for member posts
  const memberUrl = `https://api.linkedin.com/v2/memberNetworkSizes?q=member&networks=List()`;

  // Use the ugcPost share statistics endpoint
  const statsUrl = `https://api.linkedin.com/v2/shareStatistics?q=activity&activity=${encodedUrn}`;

  const response = await fetch(statsUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'X-Restli-Protocol-Version': '2.0.0',
      'LinkedIn-Version': '202304',
    },
  });

  const data = await response.json();

  // Handle the case where stats are not yet available (post too new)
  if (data.status >= 400 || !data.elements) {
    // Return zeros gracefully — LinkedIn stats can take a few hours to populate
    return {
      impressions: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      clicks: 0,
      raw: data,
    };
  }

  const stats = data.elements?.[0]?.totalShareStatistics || {};

  return {
    impressions: stats.impressionCount || 0,
    likes: stats.likeCount || 0,
    comments: stats.commentCount || 0,
    shares: stats.shareCount || 0,
    clicks: stats.clickCount || 0,
    raw: data,
  };
}

async function collectPinterestMetrics(pinId, accessToken) {
  // Pinterest Pin Analytics API (v5)
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const metrics = ['IMPRESSION', 'SAVE', 'PIN_CLICK', 'OUTBOUND_CLICK'].join(',');
  const url = `https://api.pinterest.com/v5/pins/${pinId}/analytics?start_date=${yesterday}&end_date=${today}&metric_types=${metrics}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = await response.json();

  if (data.code) {
    // Non-fatal: analytics may not be available immediately
    console.warn(`Pinterest analytics not available for pin ${pinId}:`, data.message);
    return { impressions: 0, saves: 0, clicks: 0, raw: data };
  }

  // Aggregate all_no_product metrics across date range
  const allDays = data.all?.daily_metrics || [];
  const totals = allDays.reduce((acc, day) => ({
    impressions: acc.impressions + (day.IMPRESSION || 0),
    saves: acc.saves + (day.SAVE || 0),
    clicks: acc.clicks + (day.PIN_CLICK || 0) + (day.OUTBOUND_CLICK || 0),
  }), { impressions: 0, saves: 0, clicks: 0 });

  return {
    impressions: totals.impressions,
    saves: totals.saves,
    clicks: totals.clicks,
    raw: data,
  };
}

async function collectGoogleBusinessMetrics(locationName, accessToken) {
  // Google Business Profile Insights API
  // Fetches views and clicks for a location
  const endTime = new Date().toISOString();
  const startTime = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();

  const body = {
    locationNames: [locationName],
    basicRequest: {
      metricRequests: [
        { metric: 'QUERIES_DIRECT', options: ['AGGREGATED_TOTAL'] },
        { metric: 'QUERIES_INDIRECT', options: ['AGGREGATED_TOTAL'] },
        { metric: 'VIEWS_MAPS', options: ['AGGREGATED_TOTAL'] },
        { metric: 'VIEWS_SEARCH', options: ['AGGREGATED_TOTAL'] },
        { metric: 'ACTIONS_WEBSITE', options: ['AGGREGATED_TOTAL'] },
        { metric: 'ACTIONS_PHONE', options: ['AGGREGATED_TOTAL'] },
      ],
      timeRange: { startTime, endTime },
    },
  };

  const response = await fetch('https://mybusiness.googleapis.com/v4/locations:reportInsights', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (data.error) {
    console.warn('Google Business insights error:', data.error.message);
    return { impressions: 0, clicks: 0, raw: data };
  }

  const locationMetrics = data.locationMetrics?.[0]?.metricValues || [];
  let views = 0;
  let clicks = 0;

  for (const mv of locationMetrics) {
    const total = mv.value?.metricOption === 'AGGREGATED_TOTAL'
      ? parseInt(mv.value?.uint64Values?.[0] || '0', 10)
      : 0;

    switch (mv.metric) {
      case 'VIEWS_MAPS':
      case 'VIEWS_SEARCH':
        views += total;
        break;
      case 'ACTIONS_WEBSITE':
      case 'ACTIONS_PHONE':
        clicks += total;
        break;
    }
  }

  return { impressions: views, clicks, raw: data };
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
        const platformPostUrl = post.published_urls?.[platform];
        if (!platformPostUrl) {
          console.warn(`Analytics: no URL for post ${post.id} on ${platform}, skipping`);
          continue;
        }

        try {
          const { getSocialAccount } = require('../supabase');
          const account = await getSocialAccount(post.user_id, platform);
          if (!account) continue;

          let metrics = {};

          if (platform === 'facebook') {
            // URL format: https://facebook.com/PAGEID/posts/POSTID
            let fbPostId;
            try {
              const url = new URL(platformPostUrl);
              const parts = url.pathname.split('/').filter(Boolean);
              // parts = ['PAGEID', 'posts', 'POSTID'] -> join as 'PAGEID_POSTID'
              const postsIdx = parts.indexOf('posts');
              if (postsIdx !== -1 && parts[postsIdx - 1] && parts[postsIdx + 1]) {
                fbPostId = `${parts[postsIdx - 1]}_${parts[postsIdx + 1]}`;
              }
            } catch (_) { /* invalid URL */ }

            if (!fbPostId || !fbPostId.includes('_')) {
              console.error(`Analytics: could not parse Facebook post ID from URL: ${platformPostUrl}`);
              failed++;
              continue;
            }
            metrics = await collectFacebookInsights(post.id, fbPostId, account.access_token);

          } else if (platform === 'instagram') {
            // URL format: https://instagram.com/p/MEDIAID/
            let igMediaId;
            try {
              const url = new URL(platformPostUrl);
              const parts = url.pathname.split('/').filter(Boolean);
              // parts = ['p', 'MEDIAID']
              if (parts[0] === 'p' && parts[1]) {
                igMediaId = parts[1];
              }
            } catch (_) { /* invalid URL */ }

            if (!igMediaId) {
              console.error(`Analytics: could not parse Instagram media ID from URL: ${platformPostUrl}`);
              failed++;
              continue;
            }
            metrics = await collectInstagramInsights(post.id, igMediaId, account.access_token);

          } else if (platform === 'twitter') {
            // URL format: https://twitter.com/i/web/status/TWEETID
            let tweetId;
            try {
              const url = new URL(platformPostUrl);
              const parts = url.pathname.split('/').filter(Boolean);
              const statusIdx = parts.indexOf('status');
              if (statusIdx !== -1 && parts[statusIdx + 1]) {
                tweetId = parts[statusIdx + 1];
              }
            } catch (_) { /* invalid URL */ }

            if (!tweetId) {
              console.error(`Analytics: could not parse tweet ID from URL: ${platformPostUrl}`);
              failed++;
              continue;
            }
            metrics = await collectTwitterMetrics(tweetId, account.access_token);

          } else if (platform === 'linkedin') {
            // URL format: https://www.linkedin.com/feed/update/urn:li:ugcPost:{id}/
            // Extract the full URN from the URL path
            let postUrn;
            try {
              const url = new URL(platformPostUrl);
              const parts = url.pathname.split('/').filter(Boolean);
              // parts = ['feed', 'update', 'urn:li:ugcPost:xxx']
              const updateIdx = parts.indexOf('update');
              if (updateIdx !== -1 && parts[updateIdx + 1]) {
                postUrn = decodeURIComponent(parts[updateIdx + 1]);
              }
            } catch (_) { /* invalid URL */ }

            if (!postUrn) {
              console.error(`Analytics: could not parse LinkedIn post URN from URL: ${platformPostUrl}`);
              failed++;
              continue;
            }
            metrics = await collectLinkedInMetrics(postUrn, account.access_token);

          } else if (platform === 'pinterest') {
            // URL format: https://www.pinterest.com/pin/{pinId}/
            let pinId;
            try {
              const url = new URL(platformPostUrl);
              const parts = url.pathname.split('/').filter(Boolean);
              // parts = ['pin', 'pinId']
              if (parts[0] === 'pin' && parts[1]) {
                pinId = parts[1];
              }
            } catch (_) { /* invalid URL */ }

            if (!pinId) {
              console.error(`Analytics: could not parse Pinterest pin ID from URL: ${platformPostUrl}`);
              failed++;
              continue;
            }
            metrics = await collectPinterestMetrics(pinId, account.access_token);

          } else if (platform === 'google') {
            // For Google Business, we need the location resource name.
            // The post URL points to the dashboard — we use the account's stored data.
            // Google Business insights are location-level, not post-level.
            // We fetch location metrics and attribute them to the most recent post.

            // Refresh token if needed (Google tokens expire in 1 hour)
            let accessToken = account.access_token;
            if (account.refresh_token &&
                account.token_expires_at &&
                new Date(account.token_expires_at) < new Date(Date.now() + 60 * 1000)) {
              try {
                const clientId = process.env.GOOGLE_CLIENT_ID;
                const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
                const body = new URLSearchParams({
                  client_id: clientId,
                  client_secret: clientSecret,
                  refresh_token: account.refresh_token,
                  grant_type: 'refresh_token',
                });
                const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                  body: body.toString(),
                });
                const tokenData = await tokenRes.json();
                if (!tokenData.error) {
                  accessToken = tokenData.access_token;
                }
              } catch (refreshErr) {
                console.warn('Google token refresh in analytics failed:', refreshErr.message);
              }
            }

            // Get location name from the Business Profile API
            const accountsRes = await fetch(
              'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
              { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            const accountsData = await accountsRes.json();
            const gbAccount = accountsData.accounts?.[0];

            if (!gbAccount) {
              console.warn(`Analytics: no Google Business account found for user ${post.user_id}`);
              failed++;
              continue;
            }

            const locationsRes = await fetch(
              `https://mybusinessbusinessinformation.googleapis.com/v1/${gbAccount.name}/locations?readMask=name`,
              { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            const locationsData = await locationsRes.json();
            const location = locationsData.locations?.[0];

            if (!location) {
              console.warn(`Analytics: no Google Business locations found for user ${post.user_id}`);
              failed++;
              continue;
            }

            metrics = await collectGoogleBusinessMetrics(location.name, accessToken);
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
