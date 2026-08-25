'use strict';

/**
 * Daily job dispatcher — GET/POST /api/jobs/dispatch
 *
 * Vercel Hobby allows at most 2 cron jobs, each daily-granularity. The five
 * periodic jobs therefore run behind ONE daily cron (14:00 UTC, see
 * vercel.json) and this dispatcher decides which of them today gets:
 *
 *   - collect-analytics:     every day
 *   - refresh-tokens:        every day
 *   - weekly-summary:        Mondays   (14:00 UTC = morning US time)
 *   - cleanup-conversations: Sundays
 *   - reset-generations:     1st of the month
 *
 * Cron auth is checked by each sub-handler against the same request headers,
 * so the Vercel-supplied `Authorization: Bearer ${CRON_SECRET}` flows through.
 * Sub-jobs run sequentially; one failure doesn't stop the rest.
 */

const SUBJOBS = [
  { name: 'collect-analytics', handler: () => require('./collect-analytics'), when: () => true },
  { name: 'refresh-tokens', handler: () => require('./refresh-tokens'), when: () => true },
  { name: 'sweep-reviews', handler: () => require('./sweep-reviews'), when: () => true },
  { name: 'weekly-summary', handler: () => require('./weekly-summary'), when: (d) => d.getUTCDay() === 1 },
  { name: 'cleanup-conversations', handler: () => require('./cleanup-conversations'), when: (d) => d.getUTCDay() === 0 },
  { name: 'reset-generations', handler: () => require('./reset-generations'), when: (d) => d.getUTCDate() === 1 },
  { name: 'health-check', handler: () => require('./health-check'), when: () => true },
];

function stubRes() {
  const r = {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; },
    send(body) { this.body = body; return this; },
    end() { return this; },
    setHeader() { return this; },
  };
  return r;
}

module.exports = async function handler(req, res) {
  const { requireCronAuth } = require('../cron-auth');
  if (!requireCronAuth(req, res)) return;

  const now = new Date();
  const results = [];

  for (const job of SUBJOBS) {
    if (!job.when(now)) {
      results.push({ job: job.name, skipped: true });
      continue;
    }
    // Prefer fanning each job out as its own QStash-delivered invocation so
    // one slow job can't eat the shared function budget (Hobby caps a
    // function at 60s without Fluid). Falls back to inline execution when
    // enqueueing isn't possible.
    try {
      const { publishJob } = require('../qstash-publisher');
      const { messageId } = await publishJob(job.name);
      results.push({ job: job.name, enqueued: true, messageId });
      continue;
    } catch (err) {
      console.warn(`[dispatch] enqueue failed for ${job.name}, running inline:`, err.message);
    }
    const sub = stubRes();
    try {
      await job.handler()(req, sub);
      results.push({ job: job.name, status: sub.statusCode, body: sub.body });
    } catch (err) {
      const { reportError } = require('../monitor');
      await reportError(`job:${job.name}`, err).catch(() => {});
      results.push({ job: job.name, status: 500, error: err.message });
    }
  }

  return res.status(200).json({ ok: true, ranAt: now.toISOString(), results });
};
