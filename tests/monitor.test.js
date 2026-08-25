'use strict';

/**
 * Monitoring battery - the alerting layer must (1) record and alert,
 * (2) dedupe within the window, (3) NEVER throw even with the DB down,
 * and the health check must find stuck work and stay quiet when healthy.
 */

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

let dbRows = { errors: [], alert_state: [] };
let dbDown = false;
let emails = [];
let texts = [];
let healthData = { stuck: [], overdue: [], expiring: [], errCount: 0 };

function tableChain(table) {
  if (dbDown) throw new Error('db unreachable');
  const state = { table };
  const chain = {
    insert(row) { state.op = 'insert'; state.row = row; return chain; },
    select(cols, opts) {
      if (opts?.head && state.table === 'errors') {
        return { gte: async () => ({ count: healthData.errCount, error: null }) };
      }
      return chain;
    },
    update(vals) { state.op = 'update'; state.row = vals; return chain; },
    upsert(vals) {
      const i = dbRows.alert_state.findIndex(r => r.key === vals.key);
      if (i >= 0) dbRows.alert_state[i] = vals; else dbRows.alert_state.push(vals);
      return { then: (r) => r({ error: null }) };
    },
    eq(col, val) {
      if (col === 'key') state.key = val;
      return chain;
    },
    lt() { return chain; },
    not() { return chain; },
    gte() { return chain; },
    limit() {
      // health-check listing paths
      if (state.table === 'scheduled_posts') {
        const rows = state.wantsOverdue ? healthData.overdue : healthData.stuck;
        return { then: (r) => r({ data: rows, error: null }) };
      }
      if (state.table === 'social_accounts') {
        return { then: (r) => r({ data: healthData.expiring, error: null }) };
      }
      return { then: (r) => r({ data: [], error: null }) };
    },
    maybeSingle: async () => ({ data: dbRows.alert_state.find(r => r.key === state.key) || null, error: null }),
    single: async () => {
      if (state.op === 'insert') {
        const row = { id: 'e' + (dbRows.errors.length + 1), ...state.row };
        dbRows.errors.push(row);
        return { data: row, error: null };
      }
      return { data: null, error: null };
    },
    then(resolve) {
      if (state.op === 'update') {
        const r = dbRows.alert_state.find(x => x.key === state.key);
        if (r) Object.assign(r, state.row);
      }
      resolve({ data: [], error: null });
    },
  };
  // crude marker: second eq('status','queued') call pattern
  const origEq = chain.eq;
  chain.eq = (col, val) => { if (val === 'queued') state.wantsOverdue = true; return origEq(col, val); };
  return chain;
}

require.cache[require.resolve('../lib/supabase')] = {
  id: require.resolve('../lib/supabase'), filename: require.resolve('../lib/supabase'), loaded: true,
  exports: { getClient: () => ({ from: (t) => tableChain(t) }) },
};
require.cache[require.resolve('../lib/email')] = {
  id: require.resolve('../lib/email'), filename: require.resolve('../lib/email'), loaded: true,
  exports: { sendEmail: async (to, subject, html) => { emails.push({ to, subject, html }); return { ok: true }; } },
};
const outboundPath = require.resolve('../lib/sms-outbound');
const outboundMock = async function handler(req, res) { res.status(200).json({}); };
outboundMock.sendSms = async (to, body) => { texts.push({ to, body }); return { sid: 'SM' }; };
require.cache[outboundPath] = { id: outboundPath, filename: outboundPath, loaded: true, exports: outboundMock };
require.cache[require.resolve('../lib/cron-auth')] = {
  id: require.resolve('../lib/cron-auth'), filename: require.resolve('../lib/cron-auth'), loaded: true,
  exports: { requireCronAuth: () => true },
};

const { reportError } = require('../lib/monitor');
const healthCheck = require('../lib/job-handlers/health-check');

function makeRes() {
  const res = { statusCode: null, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

beforeEach(() => {
  dbRows = { errors: [], alert_state: [] };
  dbDown = false; emails = []; texts = [];
  healthData = { stuck: [], overdue: [], expiring: [], errCount: 0 };
  process.env.NOTIFY_EMAIL = 'mmodica3@gmail.com';
  process.env.ALERT_SMS_TO = '+14847162152';
  for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER', 'ANTHROPIC_API_KEY']) {
    process.env[k] = process.env[k] || 'test-value';
  }
});

describe('reportError', () => {
  test('records the error and emails the owner', async () => {
    const row = await reportError('job:publish', new Error('IG container rejected'), { userId: 'u1' });
    assert.ok(row?.id, 'error row stored');
    assert.equal(dbRows.errors[0].source, 'job:publish');
    assert.equal(emails.length, 1);
    assert.match(emails[0].subject, /job:publish/);
    assert.equal(texts.length, 0, 'non-critical errors do not text');
  });

  test('critical errors also text the owner', async () => {
    await reportError('sms-inbound', new Error('handler crashed'), { critical: true });
    assert.equal(texts.length, 1);
    assert.equal(texts[0].to, '+14847162152');
  });

  test('same source within an hour is suppressed, different source is not', async () => {
    await reportError('job:publish', new Error('one'));
    await reportError('job:publish', new Error('two'));
    await reportError('meta-webhook', new Error('three'));
    assert.equal(emails.length, 2, 'second job:publish alert suppressed');
    assert.equal(dbRows.errors.length, 3, 'every error is still stored');
    const state = dbRows.alert_state.find(r => r.key === 'err:job:publish');
    assert.equal(state.suppressed_count, 1);
  });

  test('NEVER throws even when the database is down (and still emails)', async () => {
    dbDown = true;
    const row = await reportError('sms-inbound', new Error('boom'), { critical: true });
    assert.equal(row, null);
    assert.equal(emails.length, 1, 'alert still goes out without the DB');
    assert.match(emails[0].html, /NOT stored/);
  });

  test('never throws when email AND sms fail too', async () => {
    dbDown = true;
    require.cache[require.resolve('../lib/email')].exports.sendEmail = async () => { throw new Error('smtp down'); };
    outboundMock.sendSms = async () => { throw new Error('twilio down'); };
    await reportError('job:publish', new Error('boom'), { critical: true });
    // reaching here without throwing IS the assertion
    require.cache[require.resolve('../lib/email')].exports.sendEmail = async (to, subject, html) => { emails.push({ to, subject, html }); return { ok: true }; };
    outboundMock.sendSms = async (to, body) => { texts.push({ to, body }); return { sid: 'SM' }; };
  });
});

describe('health check', () => {
  test('quiet when healthy', async () => {
    const res = makeRes();
    await healthCheck({ method: 'POST', headers: {} }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.healthy, true);
    assert.equal(emails.length, 0);
    assert.equal(texts.length, 0);
  });

  test('stuck publishing post triggers an email AND a text', async () => {
    healthData.stuck = [{ id: 'p9', user_id: 'u1', updated_at: '2026-08-25T00:00:00Z' }];
    const res = makeRes();
    await healthCheck({ method: 'POST', headers: {} }, res);
    assert.equal(res.body.healthy, false);
    assert.match(res.body.issues[0], /stuck in 'publishing'/);
    assert.equal(emails.length, 1);
    assert.equal(texts.length, 1);
  });

  test('missing env var is reported', async () => {
    delete process.env.NOTIFY_EMAIL;
    process.env.NOTIFY_EMAIL_BACKUP = '1';
    const res = makeRes();
    await healthCheck({ method: 'POST', headers: {} }, res);
    assert.equal(res.body.healthy, false);
    assert.match(res.body.issues.join(' '), /NOTIFY_EMAIL/);
    process.env.NOTIFY_EMAIL = 'mmodica3@gmail.com';
  });

  test('error volume over threshold is reported', async () => {
    healthData.errCount = 7;
    const res = makeRes();
    await healthCheck({ method: 'POST', headers: {} }, res);
    assert.match(res.body.issues.join(' '), /7 errors/);
  });
});
