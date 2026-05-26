'use strict';

/**
 * setup-qstash-schedules.js
 *
 * Creates the recurring QStash cron schedules that drive the periodic
 * job handlers under /api/jobs/*. WITHOUT THIS, the nightly analytics,
 * weekly summary, monthly generation reset, periodic token refresh, and
 * data-retention cleanup ALL NEVER FIRE — the handlers exist but no one
 * invokes them. Run this once per environment (prod, preview) after
 * setting APP_URL + QSTASH_TOKEN.
 *
 * Idempotent: re-running deletes existing schedules at the same destination
 * and re-creates them, so it's safe to run after env or schedule changes.
 *
 * Usage:
 *   APP_URL=https://sidekik.com QSTASH_TOKEN=... node dev/setup-qstash-schedules.js
 *
 * Or:
 *   npm run setup:qstash
 */

const { Client } = require('@upstash/qstash');

if (!process.env.QSTASH_TOKEN) {
  console.error('QSTASH_TOKEN is required. Set it in your env and try again.');
  process.exit(1);
}

const APP_URL = (process.env.APP_URL || 'https://sidekik.com').replace(/\/$/, '');

// Cron expressions are UTC. Sidekick is ET-leaning so most user-facing jobs
// fire at the UTC time that maps to a reasonable ET time year-round (we pay
// the DST drift rather than complicate the schedule).
const SCHEDULES = [
  {
    name: 'collect-analytics',
    cron: '0 6 * * *',          // 06:00 UTC = 1-2am ET nightly
    path: '/api/jobs/collect-analytics',
    body: {},
  },
  {
    name: 'weekly-summary',
    cron: '0 14 * * 1',         // 14:00 UTC Monday = 9-10am ET — Sidekick's "Monday morning summary"
    path: '/api/jobs/weekly-summary',
    body: {},
  },
  {
    name: 'reset-generations',
    cron: '5 0 1 * *',          // 00:05 UTC on the 1st of each month
    path: '/api/jobs/reset-generations',
    body: {},
  },
  {
    name: 'refresh-tokens',
    cron: '0 4 * * *',          // 04:00 UTC daily — catches anything within 15d of expiry
    path: '/api/jobs/refresh-tokens',
    body: {},
  },
  {
    name: 'cleanup-conversations',
    cron: '0 5 * * 0',          // 05:00 UTC every Sunday — purges 90+ day messages
    path: '/api/jobs/cleanup-conversations',
    body: {},
  },
];

async function main() {
  const client = new Client({ token: process.env.QSTASH_TOKEN });

  // List existing schedules so we can delete dupes pointed at our URL.
  let existing = [];
  try {
    existing = await client.schedules.list();
  } catch (err) {
    console.warn('Could not list existing schedules:', err.message);
  }

  for (const s of SCHEDULES) {
    const destination = `${APP_URL}${s.path}`;

    // Delete any existing schedules at this destination (idempotent setup).
    const dupes = existing.filter(e => e.destination === destination);
    for (const dup of dupes) {
      try {
        await client.schedules.delete(dup.scheduleId);
        console.log(`  ✓ removed stale schedule ${dup.scheduleId} for ${s.name}`);
      } catch (err) {
        console.warn(`  ! failed to delete ${dup.scheduleId}:`, err.message);
      }
    }

    try {
      const created = await client.schedules.create({
        destination,
        cron: s.cron,
        body: JSON.stringify(s.body),
        headers: { 'Content-Type': 'application/json' },
      });
      console.log(`  ✓ created ${s.name}  (${s.cron} UTC)  scheduleId=${created.scheduleId}`);
    } catch (err) {
      console.error(`  ✗ failed to create ${s.name}:`, err.message);
      process.exitCode = 1;
    }
  }

  console.log('\nDone. Re-run anytime to reset schedules from this file.');
}

main().catch(err => { console.error(err); process.exit(1); });
