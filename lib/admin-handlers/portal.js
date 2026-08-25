'use strict';

/**
 * GET /api/admin/portal
 *
 * One-shot feed for the Sidekick section of admin.penntechsolutions.com:
 * everything Matt monitors, in one authenticated call. The Next.js dashboard
 * fetches this SERVER-SIDE with the admin password in an env var, so the
 * password never reaches a browser.
 *
 * Auth: `Authorization: Bearer <admin-password>` (see lib/admin-auth.js).
 */

const { getClient } = require('../supabase');
const { checkAdminAuth } = require('../admin-auth');
const { collectIssues } = require('../job-handlers/health-check');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!checkAdminAuth(req, res)) return;

  const supa = getClient();
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  try {
    const [users, waitlistCount, waitlistRecent, postCounts, postsRecent, errorsRecent, health, messagesWeek] =
      await Promise.all([
        supa.from('users')
          .select('id,business_name,business_type,phone,plan,onboarding_complete,generations_used,generations_limit,created_at')
          .order('created_at', { ascending: false }).limit(50),
        supa.from('waitlist').select('id', { count: 'exact', head: true }),
        supa.from('waitlist').select('id,email,phone,plan,source,created_at')
          .order('created_at', { ascending: false }).limit(10),
        supa.from('scheduled_posts').select('status'),
        supa.from('scheduled_posts')
          .select('id,user_id,content,status,platforms,scheduled_for,error_message,created_at')
          .order('created_at', { ascending: false }).limit(10),
        supa.from('errors').select('id,source,message,user_id,created_at')
          .order('created_at', { ascending: false }).limit(10),
        collectIssues().catch((e) => [`health check failed: ${e.message}`]),
        supa.from('conversations').select('id', { count: 'exact', head: true })
          .gte('created_at', weekAgo),
      ]);

    const byStatus = {};
    for (const p of (postCounts.data || [])) byStatus[p.status] = (byStatus[p.status] || 0) + 1;

    return res.status(200).json({
      generatedAt: new Date().toISOString(),
      health: { healthy: health.length === 0, issues: health },
      stats: {
        users: (users.data || []).length,
        activeUsers: (users.data || []).filter(u => u.onboarding_complete).length,
        waitlist: waitlistCount.count || 0,
        messagesWeek: messagesWeek.count || 0,
        posts: byStatus,
      },
      users: users.data || [],
      waitlist: waitlistRecent.data || [],
      posts: (postsRecent.data || []).map(p => ({
        ...p,
        content: p.content ? p.content.slice(0, 140) : '',
      })),
      errors: errorsRecent.data || [],
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
};
