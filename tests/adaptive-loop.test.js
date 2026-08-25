'use strict';

/**
 * Adaptive-loop execution battery - runs the REAL weekly-summary handler
 * (and the real growth lib) against realistic post + snapshot data. The
 * status-string bug that silently killed this loop proved it had never been
 * executed; this battery keeps it executed forever.
 */

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

let users = [];
let posts = [];
let snapshots = [];
let userUpdates = [];
let smsSent = [];
let weeklyUpserts = [];

// ---- outbound ----
const outboundPath = require.resolve('../api/sms/outbound');
const outboundMock = async function handler(req, res) { res.status(200).json({}); };
outboundMock.sendSms = async (to, body) => { smsSent.push({ to, body }); return { sid: 'SM_x' }; };
require.cache[outboundPath] = { id: outboundPath, filename: outboundPath, loaded: true, exports: outboundMock };

// ---- claude (weekly summary generator) ----
require.cache[require.resolve('../lib/claude')] = {
  id: require.resolve('../lib/claude'), filename: require.resolve('../lib/claude'), loaded: true,
  exports: {
    // Echo the interesting inputs back so assertions can see what the
    // real job computed and passed in.
    generateWeeklySummary: async (user, metrics) => {
      const bits = [`posts:${metrics.postsCount}`, `reach:${metrics.totalReach}`];
      if (metrics.insights?.top_format) bits.push(`winner:${metrics.insights.top_format.name}`);
      if (metrics.experimentResult) bits.push(`verdict:${metrics.experimentResult.verdict}`);
      if (metrics.nextExperiment?.description) bits.push(`next:${metrics.nextExperiment.type}`);
      return bits.join(' | ');
    },
  },
};

// ---- cron auth ----
require.cache[require.resolve('../lib/cron-auth')] = {
  id: require.resolve('../lib/cron-auth'), filename: require.resolve('../lib/cron-auth'), loaded: true,
  exports: { requireCronAuth: () => true, checkVercelCronAuth: () => true },
};

// ---- supabase ----
function chainFor(table) {
  const state = { table, filters: [], gte: null };
  const rowsFor = () => {
    if (state.table === 'users') return users;
    if (state.table === 'scheduled_posts') {
      return posts.filter(p =>
        state.filters.every(([col, val]) => String(p[col]) === String(val)) &&
        (!state.gte || p.created_at >= state.gte));
    }
    if (state.table === 'analytics_snapshots') {
      const ids = state.inList || [];
      return snapshots.filter(s => ids.includes(s.post_id));
    }
    return [];
  };
  const chain = {
    select() { return chain; },
    eq(col, val) { state.filters.push([col, val]); return chain; },
    is() { return chain; },
    gte(_c, v) { state.gte = v; return chain; },
    in(_c, list) { state.inList = list; return chain; },
    then(resolve) { resolve({ data: rowsFor(), error: null }); },
  };
  return chain;
}
const supabasePath = require.resolve('../lib/supabase');
require.cache[supabasePath] = {
  id: supabasePath, filename: supabasePath, loaded: true,
  exports: {
    getClient: () => ({ from: (t) => chainFor(t) }),
    getWeeklyMetrics: async (userId, weekStart) => {
      const week = posts.filter(p => p.user_id === userId);
      return {
        posts: week,
        snapshots: snapshots.filter(s => week.some(p => p.id === s.post_id)),
        totals: { reach: 500, impressions: 800, engagement: 60 },
      };
    },
    upsertWeeklyAnalytics: async (row) => { weeklyUpserts.push(row); },
    updateUser: async (id, updates) => {
      userUpdates.push({ id, updates });
      const u = users.find(x => x.id === id);
      if (u) Object.assign(u, updates);
      return u;
    },
  },
};

const weeklySummary = require('../lib/job-handlers/weekly-summary');

function makeRes() {
  const res = { statusCode: null, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}
const run = async () => {
  const res = makeRes();
  await weeklySummary({ method: 'POST', headers: {} }, res);
  return res;
};

function seedUser(extra = {}) {
  users = [{
    id: 'u1', phone: '+15550001111', business_name: 'Mikes Pizza', business_type: 'restaurant',
    tone: 'casual', timezone: 'America/New_York', plan: 'starter',
    content_insights: null, active_experiment: null, ...extra,
  }];
}

function seedPerformingPosts() {
  posts = []; snapshots = [];
  // 4 winning "offer" posts, 3 weak "tip" posts - published, within 28 days
  for (let i = 0; i < 4; i++) {
    posts.push({ id: `o${i}`, user_id: 'u1', status: 'posted', content: `offer ${i}`, topic: 'weekend special', format: 'offer', scheduled_for: '2026-08-20T23:00:00Z', created_at: '2026-08-19T00:00:00Z' });
    snapshots.push({ post_id: `o${i}`, platform: 'instagram', snapshot_date: '2026-08-23', likes: 20, comments: 2, shares: 1, saves: 0, clicks: 0, reach: 300 });
  }
  for (let i = 0; i < 3; i++) {
    posts.push({ id: `t${i}`, user_id: 'u1', status: 'posted', content: `tip ${i}`, topic: 'marketing tip', format: 'tip', scheduled_for: '2026-08-20T15:00:00Z', created_at: '2026-08-19T00:00:00Z' });
    snapshots.push({ post_id: `t${i}`, platform: 'instagram', snapshot_date: '2026-08-23', likes: 2, comments: 0, shares: 0, saves: 0, clicks: 0, reach: 40 });
  }
}

beforeEach(() => { users = []; posts = []; snapshots = []; userUpdates = []; smsSent = []; weeklyUpserts = []; });

describe('adaptive loop, actually executed', () => {
  test('first run computes insights, stores them, proposes an experiment, and the SMS carries it', async () => {
    seedUser();
    seedPerformingPosts();
    const res = await run();
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.sent, 1);

    const stored = userUpdates.find(u => u.updates.content_insights);
    assert.ok(stored, 'insights must be persisted');
    assert.equal(stored.updates.content_insights.top_format.name, 'offer');
    assert.equal(stored.updates.content_insights.sample_size, 7);
    assert.ok(stored.updates.active_experiment, 'an experiment must be proposed');
    assert.equal(stored.updates.active_experiment.status, 'live');

    assert.equal(smsSent.length, 1);
    assert.match(smsSent[0].body, /winner:offer/);
    assert.match(smsSent[0].body, /next:posting_time/);
  });

  test('second run evaluates the live experiment and rotates to the next dimension', async () => {
    seedUser({
      content_insights: { as_of: '2026-08-18', sample_size: 7 },
      active_experiment: { type: 'posting_time', variant: '19', control: '11', started_at: '2026-08-10T00:00:00Z', status: 'live', description: 'posting at 19:00 local' },
    });
    seedPerformingPosts(); // offers posted 23:00Z = 19:00 ET (variant arm); tips 15:00Z = 11:00 ET (control)
    const res = await run();
    assert.equal(res.statusCode, 200);

    const stored = userUpdates.find(u => u.updates.active_experiment);
    assert.ok(stored);
    assert.equal(stored.updates.active_experiment.type, 'format', 'experiment must rotate posting_time -> format');
    assert.match(smsSent[0].body, /verdict:variant/, 'the 19:00 arm measurably won and the verdict must say so');
  });

  test('no published posts = no invented insights, user untouched', async () => {
    seedUser();
    posts = []; snapshots = [];
    const res = await run();
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.sent, 0);
    assert.equal(userUpdates.length, 0, 'nothing may be stored when nothing was measured');
    assert.equal(smsSent.length, 0);
  });

  test('an unresolved experiment stays live instead of rotating', async () => {
    seedUser({
      active_experiment: { type: 'format', variant: 'question', control: 'offer', started_at: '2026-08-10T00:00:00Z', status: 'live', description: 'leading with a question post' },
    });
    // Only 1 measured post per arm -> insufficient data
    posts = [
      { id: 'q1', user_id: 'u1', status: 'posted', content: 'q', topic: 'x', format: 'question', scheduled_for: '2026-08-20T15:00:00Z', created_at: '2026-08-19T00:00:00Z' },
      { id: 'o1', user_id: 'u1', status: 'posted', content: 'o', topic: 'x', format: 'offer', scheduled_for: '2026-08-20T15:00:00Z', created_at: '2026-08-19T00:00:00Z' },
    ];
    snapshots = [
      { post_id: 'q1', platform: 'instagram', snapshot_date: '2026-08-23', likes: 5, comments: 0, shares: 0, saves: 0, clicks: 0, reach: 50 },
      { post_id: 'o1', platform: 'instagram', snapshot_date: '2026-08-23', likes: 3, comments: 0, shares: 0, saves: 0, clicks: 0, reach: 30 },
    ];
    await run();
    const stored = userUpdates.find(u => u.updates.active_experiment);
    assert.ok(stored);
    assert.equal(stored.updates.active_experiment.type, 'format', 'insufficient data must NOT rotate the experiment');
    assert.equal(stored.updates.active_experiment.started_at, '2026-08-10T00:00:00Z', 'the live experiment must be preserved, not restarted');
  });
});
