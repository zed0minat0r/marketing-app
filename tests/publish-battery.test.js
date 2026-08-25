'use strict';

/**
 * Publish-pipeline execution battery - runs the REAL publishPost through the
 * outcome matrix (full success incl. the IG permalink fix, needs-image,
 * partial failure, total failure) with only Supabase/Graph/SMS simulated.
 */

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

let postsDb = new Map();
let accounts = new Map();
let updates = [];
let libraryPhotoUrl = null;
let smsSent = [];
let igPublishFails = false;
let fbFails = false;

function installStubs() {
  const supabaseStub = {
    getScheduledPost: async (id) => postsDb.get(id) || null,
    updateScheduledPost: async (id, u) => {
      updates.push({ id, u });
      const cur = postsDb.get(id) || {};
      postsDb.set(id, { ...cur, ...u });
      return postsDb.get(id);
    },
    getSocialAccount: async (userId, platform) => accounts.get(`${userId}:${platform}`) || null,
    upsertSocialAccount: async () => {},
    getMostRecentPhotoForPost: async () => libraryPhotoUrl,
    getClient: () => ({
      from: () => ({
        select: () => ({ eq: () => ({ single: async () => ({ data: { phone: '+15550001111' } }) }) }),
        update: (vals) => {
          const state = { id: null, statuses: null, eqStatus: null, ltUpdated: null };
          const finish = async () => {
            const row = postsDb.get(state.id);
            if (!row) return { data: [], error: null };
            let match = false;
            if (state.statuses) match = state.statuses.includes(row.status);
            if (state.eqStatus) match = row.status === state.eqStatus && (!state.ltUpdated || new Date(row.updated_at) < new Date(state.ltUpdated));
            if (!match) return { data: [], error: null };
            postsDb.set(state.id, { ...row, ...vals });
            return { data: [{ id: state.id }], error: null };
          };
          const chain = {
            eq: (col, val) => { if (col === 'id') state.id = val; if (col === 'status') state.eqStatus = val; return chain; },
            in: (_c, s) => { state.statuses = s; return chain; },
            lt: (_c, v) => { state.ltUpdated = v; return chain; },
            select: finish,
          };
          return chain;
        },
      }),
    }),
  };
  require.cache[require.resolve('../lib/supabase')] = {
    id: require.resolve('../lib/supabase'), filename: require.resolve('../lib/supabase'), loaded: true, exports: supabaseStub,
  };
  const outboundPath = require.resolve('../api/sms/outbound');
  const outboundMock = async function handler(req, res) { res.status(200).json({}); };
  outboundMock.sendSms = async (to, body) => { smsSent.push({ to, body }); return { sid: 'SM' }; };
  require.cache[outboundPath] = { id: outboundPath, filename: outboundPath, loaded: true, exports: outboundMock };
}
installStubs();

const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  const u = String(url);
  if (u.includes('graph.facebook.com')) {
    if (u.includes('/feed')) {
      if (fbFails) return { ok: false, json: async () => ({ error: { message: 'FB down' } }) };
      return { ok: true, json: async () => ({ id: 'page1_post9' }) };
    }
    if (u.includes('/media_publish')) {
      if (igPublishFails) return { ok: true, json: async () => ({ error: { message: 'IG rejected the container' } }) };
      return { ok: true, json: async () => ({ id: '17900012345' }) };
    }
    if (u.includes('fields=permalink')) {
      return { ok: true, json: async () => ({ permalink: 'https://www.instagram.com/p/DAbCd123/' }) };
    }
    if (u.includes('/media')) {
      return { ok: true, json: async () => ({ id: 'container1' }) };
    }
  }
  return { ok: false, status: 500, json: async () => ({ error: { message: 'unmocked ' + u.slice(0, 60) } }) };
};

const { publishPost } = require('../api/social/post');

function seedPost(overrides = {}) {
  postsDb.set('p1', {
    id: 'p1', user_id: 'u1', content: 'Friday special!', status: 'queued',
    media_url: 'https://photos.example.com/x.jpg', retry_count: 0,
    updated_at: new Date().toISOString(), platforms: ['facebook', 'instagram'], ...overrides,
  });
}
function seedAccounts(platforms) {
  accounts = new Map();
  for (const p of platforms) {
    accounts.set(`u1:${p}`, { user_id: 'u1', platform: p, platform_user_id: p + '_id', access_token: 'tok' });
  }
}

beforeEach(() => { postsDb = new Map(); accounts = new Map(); updates = []; smsSent = []; libraryPhotoUrl = null; igPublishFails = false; fbFails = false; });

describe('publish pipeline, actually executed', () => {
  test('full success: FB link + REAL Instagram permalink + media id persisted', async () => {
    seedPost();
    seedAccounts(['facebook', 'instagram']);
    const r = await publishPost('p1');
    assert.equal(r.success, true);
    assert.match(r.urls.facebook, /page1\/posts\/post9/);
    assert.equal(r.urls.instagram, 'https://www.instagram.com/p/DAbCd123/', 'must be the fetched permalink, not a constructed /p/<id>');
    assert.equal(r.urls.instagram_media_id, '17900012345');
    assert.equal(postsDb.get('p1').status, 'posted');
    assert.deepEqual(postsDb.get('p1').published_urls, r.urls);
  });

  test('IG-only with no media and empty library: honest needs-image error, post failed', async () => {
    seedPost({ platforms: ['instagram'], media_url: null });
    seedAccounts(['instagram']);
    libraryPhotoUrl = null;
    await assert.rejects(() => publishPost('p1'), /All platforms failed/);
    const row = postsDb.get('p1');
    assert.equal(row.status, 'failed');
    assert.equal(row.retry_count, 1);
    assert.match(row.error_message, /image/i);
  });

  test('partial failure: FB posts, IG fails - status posted, both facts recorded', async () => {
    seedPost();
    seedAccounts(['facebook', 'instagram']);
    igPublishFails = true;
    const r = await publishPost('p1');
    assert.equal(r.success, true);
    assert.ok(r.urls.facebook);
    assert.equal(r.urls.instagram, undefined);
    assert.match(r.errors.instagram, /rejected the container/);
    const row = postsDb.get('p1');
    assert.equal(row.status, 'posted');
    assert.match(row.error_message, /instagram/);
  });

  test('total failure: status failed, retry_count increments across attempts', async () => {
    seedPost({ platforms: ['facebook'] });
    seedAccounts(['facebook']);
    fbFails = true;
    await assert.rejects(() => publishPost('p1'));
    assert.equal(postsDb.get('p1').retry_count, 1);
    // second attempt (QStash retry): claim accepts 'failed' rows
    await assert.rejects(() => publishPost('p1'));
    assert.equal(postsDb.get('p1').retry_count, 2);
  });

  test('claim idempotency: a fresh publishing row is not re-published', async () => {
    seedPost({ status: 'publishing', updated_at: new Date().toISOString() });
    seedAccounts(['facebook']);
    const r = await publishPost('p1');
    assert.equal(r.alreadyPublishing, true);
  });

  test('platform with no connected account records the error instead of crashing', async () => {
    seedPost({ platforms: ['facebook', 'google'] });
    seedAccounts(['facebook']); // google missing
    const r = await publishPost('p1');
    assert.equal(r.success, true);
    assert.match(r.errors.google, /no google account connected/i);
  });
});

test.after(() => { globalThis.fetch = realFetch; });
