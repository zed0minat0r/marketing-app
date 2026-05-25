'use strict';

/**
 * GET /api/admin/snapshot
 *
 * One-shot dashboard data fetch — returns stats, 7-day chart buckets, recent
 * users (with message counts), and recent errors. Replaces 4 separate
 * Supabase REST calls that the admin client was making with the anon key,
 * which are blocked by RLS in production.
 *
 * Auth: `Authorization: Bearer <admin-password>` (see lib/admin-auth.js).
 */

const { getClient } = require('../../lib/supabase');
const { checkAdminAuth } = require('../../lib/admin-auth');

const USER_LIMIT = 200;
const ERROR_LIMIT = 20;

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!checkAdminAuth(req, res)) return;

  const supa = getClient();

  try {
    const [
      stats,
      chart,
      users,
      errors,
    ] = await Promise.all([
      loadStats(supa),
      loadChart(supa),
      loadUsers(supa),
      loadErrors(supa),
    ]);

    return res.status(200).json({ stats, chart, users, errors });
  } catch (err) {
    console.error('admin/snapshot error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
};

async function loadStats(supa) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);

  const [total, active, today, week] = await Promise.all([
    supa.from('users').select('id', { count: 'exact', head: true }),
    supa.from('users').select('id', { count: 'exact', head: true }).eq('onboarding_complete', true),
    supa.from('conversations').select('id', { count: 'exact', head: true })
      .gte('created_at', todayStart.toISOString()),
    supa.from('conversations').select('id', { count: 'exact', head: true })
      .gte('created_at', weekStart.toISOString()),
  ]);

  return {
    total_users: total.count || 0,
    active_users: active.count || 0,
    messages_today: today.count || 0,
    messages_week: week.count || 0,
  };
}

async function loadChart(supa) {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    days.push({
      label: d.toLocaleDateString('en-US', { weekday: 'short' }),
      date: d.toISOString().split('T')[0],
      count: 0,
      isToday: i === 0,
    });
  }

  const weekStart = days[0].date + 'T00:00:00.000Z';
  const { data: msgs } = await supa
    .from('conversations')
    .select('created_at')
    .gte('created_at', weekStart)
    .order('created_at', { ascending: true })
    .limit(10000);

  for (const msg of (msgs || [])) {
    const d = msg.created_at.split('T')[0];
    const bucket = days.find(b => b.date === d);
    if (bucket) bucket.count++;
  }
  return days;
}

async function loadUsers(supa) {
  const { data: users } = await supa
    .from('users')
    .select('id,phone,business_name,business_type,plan,onboarding_complete,onboarding_step,created_at')
    .order('created_at', { ascending: false })
    .limit(USER_LIMIT);

  if (!users || users.length === 0) return [];

  // Per-user message counts + last message time.
  const userIds = users.map(u => u.id);
  const { data: convos } = await supa
    .from('conversations')
    .select('user_id,created_at')
    .in('user_id', userIds)
    .order('created_at', { ascending: false })
    .limit(10000);

  const userStats = {};
  for (const c of (convos || [])) {
    if (!userStats[c.user_id]) {
      userStats[c.user_id] = { count: 0, last_at: c.created_at };
    }
    userStats[c.user_id].count++;
  }

  return users.map(u => ({
    ...u,
    message_count: userStats[u.id]?.count || 0,
    last_message_at: userStats[u.id]?.last_at || null,
  }));
}

async function loadErrors(supa) {
  // 'errors' table may not exist yet — swallow and return [] if so.
  try {
    const { data, error } = await supa
      .from('errors')
      .select('id,message,user_id,created_at')
      .order('created_at', { ascending: false })
      .limit(ERROR_LIMIT);
    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}
