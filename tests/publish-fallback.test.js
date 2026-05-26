'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

// We test publishPost in isolation by mocking the supabase + outbound modules.
// The point of this suite is to lock in the library-photo-fallback behavior
// — Instagram + Pinterest + GBP can't post without media, and prior to this
// commit publishPost ignored the customer_photos library entirely.

let supabaseStub;
let outboundStub;

function installSupabaseStub() {
  supabaseStub = {
    posts: new Map(),
    accounts: new Map(),
    libraryPhotoUrl: null,
    updates: [],
    getScheduledPost: async (id) => supabaseStub.posts.get(id) || null,
    updateScheduledPost: async (id, updates) => {
      supabaseStub.updates.push({ id, updates });
      const cur = supabaseStub.posts.get(id) || {};
      supabaseStub.posts.set(id, { ...cur, ...updates });
      return supabaseStub.posts.get(id);
    },
    getSocialAccount: async (userId, platform) => supabaseStub.accounts.get(`${userId}:${platform}`) || null,
    upsertSocialAccount: async () => {},
    getMostRecentPhotoForPost: async () => supabaseStub.libraryPhotoUrl,
    getClient: () => ({
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({ data: { phone: '+15555550100' } }),
          }),
        }),
      }),
    }),
  };

  require.cache[require.resolve('../lib/supabase')] = {
    id: require.resolve('../lib/supabase'),
    filename: require.resolve('../lib/supabase'),
    loaded: true,
    exports: supabaseStub,
  };
}

function installOutboundStub() {
  outboundStub = {
    sent: [],
    sendSms: async (to, body, opts) => { outboundStub.sent.push({ to, body, opts }); return { sid: 'SM_test' }; },
  };
  require.cache[require.resolve('../api/sms/outbound')] = {
    id: require.resolve('../api/sms/outbound'),
    filename: require.resolve('../api/sms/outbound'),
    loaded: true,
    exports: outboundStub,
  };
}

installSupabaseStub();
installOutboundStub();

// Mock fetch so postToFacebook returns successfully — we only care about the
// fallback assignment.
const realFetch = globalThis.fetch;
globalThis.fetch = async (url) => {
  if (typeof url === 'string' && url.includes('graph.facebook.com')) {
    if (url.includes('/feed')) {
      return {
        ok: true,
        json: async () => ({ id: 'page123_post456' }),
      };
    }
    if (url.includes('/media_publish')) {
      return { ok: true, json: async () => ({ id: 'IGmedia123' }) };
    }
    if (url.includes('/media')) {
      return { ok: true, json: async () => ({ id: 'container123' }) };
    }
  }
  return { ok: false, status: 500, json: async () => ({ error: { message: 'unmocked' } }) };
};

const { publishPost } = require('../api/social/post');

test('publishPost — uses library photo when post.media_url is null (Instagram)', async () => {
  supabaseStub.posts.set('post-1', {
    id: 'post-1',
    user_id: 'user-1',
    platforms: ['facebook'],
    content: 'Friday pizza special',
    status: 'queued',
    media_url: null,
    updated_at: new Date().toISOString(),
  });
  supabaseStub.accounts.set('user-1:facebook', {
    user_id: 'user-1',
    platform: 'facebook',
    platform_user_id: 'page123',
    access_token: 'tok',
  });
  supabaseStub.libraryPhotoUrl = 'https://photos.sidekik.com/user_1/2026-05-26_abc.jpg';

  const result = await publishPost('post-1');
  assert.strictEqual(result.success, true);
  assert.ok(result.urls.facebook, 'facebook url should be returned');
});

test('publishPost — skips library fallback when media_url is already set', async () => {
  let getMostRecentCalled = false;
  supabaseStub.getMostRecentPhotoForPost = async () => {
    getMostRecentCalled = true;
    return 'https://photos.sidekik.com/should-not-be-used.jpg';
  };

  supabaseStub.posts.set('post-2', {
    id: 'post-2',
    user_id: 'user-2',
    platforms: ['facebook'],
    content: 'Already-attached photo post',
    status: 'queued',
    media_url: 'https://example.com/explicit-photo.jpg',
    updated_at: new Date().toISOString(),
  });
  supabaseStub.accounts.set('user-2:facebook', {
    user_id: 'user-2',
    platform: 'facebook',
    platform_user_id: 'page999',
    access_token: 'tok',
  });

  await publishPost('post-2');
  assert.strictEqual(getMostRecentCalled, false, 'library lookup must NOT run when media_url is already set');
});

test('publishPost — concurrency guard returns alreadyPublishing for recent publishing posts', async () => {
  supabaseStub.posts.set('post-3', {
    id: 'post-3',
    user_id: 'user-3',
    platforms: ['facebook'],
    content: 'race target',
    status: 'publishing',
    media_url: null,
    updated_at: new Date(Date.now() - 60 * 1000).toISOString(), // 1min ago — fresh
  });

  const result = await publishPost('post-3');
  assert.strictEqual(result.alreadyPublishing, true);
});

test.after(() => {
  globalThis.fetch = realFetch;
});
