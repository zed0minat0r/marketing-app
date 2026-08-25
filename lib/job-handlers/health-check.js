'use strict';

/**
 * POST /api/jobs/health-check (rides the daily dispatch cron)
 *
 * Looks for the failure modes that have historically been silent:
 *  - posts stuck in 'publishing' (a crashed publish attempt)
 *  - queued posts whose scheduled time passed with no attempt
 *  - social tokens expiring within 7 days (refresh job should prevent this)
 *  - error volume in the last 24h
 *  - required env vars missing
 *
 * Quiet when healthy; alerts the owner (email + SMS) when anything is off.
 */

const { getClient } = require('../supabase');
const { requireCronAuth } = require('../cron-auth');
const { maybeAlert } = require('../monitor');

const REQUIRED_ENV = [
  'SUPABASE_URL', 'SUPABASE_SERVICE_KEY',
  'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER',
  'ANTHROPIC_API_KEY', 'NOTIFY_EMAIL',
];

async function collectIssues() {
  const issues = [];
  const supa = getClient();
  const now = Date.now();
  const iso = (msAgo) => new Date(now - msAgo).toISOString();

  const missingEnv = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missingEnv.length) issues.push(`Missing env vars: ${missingEnv.join(', ')}`);

  const { data: stuck, error: stuckErr } = await supa
    .from('scheduled_posts').select('id,user_id,updated_at')
    .eq('status', 'publishing').lt('updated_at', iso(15 * 60 * 1000)).limit(10);
  if (stuckErr) issues.push(`DB check failed (scheduled_posts): ${stuckErr.message}`);
  else if (stuck?.length) issues.push(`${stuck.length} post(s) stuck in 'publishing' >15min: ${stuck.map(p => p.id).join(', ')}`);

  const { data: overdue } = await supa
    .from('scheduled_posts').select('id,scheduled_for')
    .eq('status', 'queued').lt('scheduled_for', iso(30 * 60 * 1000)).limit(10);
  if (overdue?.length) issues.push(`${overdue.length} queued post(s) overdue >30min (QStash delivery may be broken): ${overdue.map(p => p.id).join(', ')}`);

  const { data: expiring } = await supa
    .from('social_accounts').select('id,platform,user_id,token_expires_at')
    .eq('is_active', true).not('token_expires_at', 'is', null)
    .lt('token_expires_at', new Date(now + 7 * 24 * 3600 * 1000).toISOString()).limit(10);
  if (expiring?.length) issues.push(`${expiring.length} social token(s) expire within 7 days (refresh job may be failing): ${expiring.map(a => `${a.platform}/${a.user_id}`).join(', ')}`);

  const { count: errCount } = await supa
    .from('errors').select('id', { count: 'exact', head: true })
    .gte('created_at', iso(24 * 3600 * 1000));
  if ((errCount || 0) >= 5) issues.push(`${errCount} errors recorded in the last 24h - check the admin dashboard`);

  return issues;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!requireCronAuth(req, res)) return;

  let issues;
  try {
    issues = await collectIssues();
  } catch (err) {
    issues = [`Health check itself failed: ${err.message}`];
  }

  if (issues.length) {
    await maybeAlert('health-check', `Sidekick health check: ${issues.length} issue(s)`,
      issues.map((s, i) => `${i + 1}. ${s}`).join('\n'), { sms: true });
  }

  return res.status(200).json({ healthy: issues.length === 0, issues });
};

module.exports.collectIssues = collectIssues;
