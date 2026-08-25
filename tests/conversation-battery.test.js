'use strict';

/**
 * Conversation battery — runs the REAL inbound handler (and the real
 * onboarding/intent/constants logic) against a wide set of simulated
 * exchanges. Only the process edges are mocked: Twilio, outbound SMS,
 * Claude, Supabase, rate limiting, QStash, and the network-touching
 * capability libs. The point is to catch runtime breaks that static review
 * misses: wrong branch taken, generic-error replies, empty sends.
 */

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

let mockUser = null;
let smsSent = [];
let deleted = [];
let drafts = [];
let pendingCommentReply = null;
let postedReplies = [];

// ---- twilio ----
require.cache[require.resolve('twilio')] = {
  id: require.resolve('twilio'), filename: require.resolve('twilio'), loaded: true,
  exports: Object.assign(function TwilioMock() { return {}; }, { validateRequest: () => true }),
};

// ---- outbound ----
const outboundPath = require.resolve('../lib/sms-outbound');
const outboundMock = async function handler(req, res) { res.status(200).json({}); };
outboundMock.sendSms = async (to, body, opts) => { smsSent.push({ to, body, opts }); return { sid: 'SM_x', status: 'sent' }; };
require.cache[outboundPath] = { id: outboundPath, filename: outboundPath, loaded: true, exports: outboundMock };

// ---- rate limit ----
require.cache[require.resolve('../lib/rate-limit')] = {
  id: require.resolve('../lib/rate-limit'), filename: require.resolve('../lib/rate-limit'), loaded: true,
  exports: { checkRateLimit: async () => ({ allowed: true, remaining: 9, count: 1 }), rateLimitMiddleware: () => async () => true },
};

// ---- claude ----
require.cache[require.resolve('../lib/claude')] = {
  id: require.resolve('../lib/claude'), filename: require.resolve('../lib/claude'), loaded: true,
  exports: {
    generateResponse: async () => ({
      reply_text: 'Draft ready! Reply YES to post, EDIT to change, LATER to schedule, or SKIP to cancel.',
      intent: 'post',
      action: { type: 'draft_post', platform: 'instagram', content: 'A generated post', topic: 'special', format: 'offer' },
      model: 'mock', tokensUsed: 10,
    }),
  },
};

// ---- website audit (network) ----
require.cache[require.resolve('../lib/website-audit')] = {
  id: require.resolve('../lib/website-audit'), filename: require.resolve('../lib/website-audit'), loaded: true,
  exports: {
    extractUrl: (t) => (/mysite\.com/.test(t) ? 'https://mysite.com/' : null),
    normalizeUrl: (u) => (u ? 'https://mysite.com/' : null),
    runWebsiteAudit: async () => ({ sms: 'Checked mysite.com - top fixes:\n1. sample fix', findings: {} }),
  },
};

// ---- review replies (network) ----
require.cache[require.resolve('../lib/review-replies')] = {
  id: require.resolve('../lib/review-replies'), filename: require.resolve('../lib/review-replies'), loaded: true,
  exports: {
    sweepReviewsForUser: async () => ({ notified: 0, error: 'no google account' }),
    getPendingReviewReply: async () => null,
    postReviewReply: async () => ({ ok: true }),
    markReviewReply: async () => {},
  },
};

// ---- comment replies (network) ----
require.cache[require.resolve('../lib/comment-replies')] = {
  id: require.resolve('../lib/comment-replies'), filename: require.resolve('../lib/comment-replies'), loaded: true,
  exports: {
    getPendingCommentReply: async () => pendingCommentReply,
    postCommentReply: async (row) => { postedReplies.push(row.draft_reply); return { ok: true }; },
    markCommentReply: async (id, status) => { if (pendingCommentReply?.id === id) pendingCommentReply.status = status; },
    extractCommentHints: () => [],
    processCommentEvent: async () => 'noop',
  },
};

// ---- qstash ----
require.cache[require.resolve('../lib/qstash-publisher')] = {
  id: require.resolve('../lib/qstash-publisher'), filename: require.resolve('../lib/qstash-publisher'), loaded: true,
  exports: {
    scheduleSocialPublish: async () => ({ messageId: 'qs_1' }),
    cancelScheduledPublish: async () => {},
    scheduleEnhancement: async () => ({ messageId: 'qs_2' }),
    publishJob: async () => ({ messageId: 'qs_3' }),
  },
};

// ---- photo intake (network) ----
require.cache[require.resolve('../lib/photo-intake')] = {
  id: require.resolve('../lib/photo-intake'), filename: require.resolve('../lib/photo-intake'), loaded: true,
  exports: { processInboundMedia: async () => ({ saved: 0 }), extractMedia: () => [] },
};

// ---- supabase ----
const supabasePath = require.resolve('../lib/supabase');
require.cache[supabasePath] = {
  id: supabasePath, filename: supabasePath, loaded: true,
  exports: {
    getUserByPhone: async () => mockUser,
    createUser: async (phone) => {
      mockUser = {
        id: 'u1', phone, onboarding_complete: false, onboarding_step: 'name',
        plan: 'starter', generations_used: 0, generations_limit: 50, tone: null,
      };
      return mockUser;
    },
    updateUser: async (id, updates) => { Object.assign(mockUser, updates); return mockUser; },
    logMessage: async () => {},
    getRecentMessages: async () => (pendingCommentReply
      ? [{ direction: 'outbound', intent: 'comment_reply', body: 'draft notice' }]
      : (drafts.length ? [{ direction: 'outbound', intent: 'post', body: 'Draft ready! Reply YES' }] : [])),
    getSocialAccounts: async () => [{ platform: 'instagram', platform_user_id: 'ig1' }],
    getSocialAccount: async () => null,
    createScheduledPost: async (p) => { const row = { id: 'p' + (drafts.length + 1), status: p.status || 'draft', ...p }; drafts.push(row); return row; },
    getMostRecentDraftPost: async () => drafts.filter(d => ['draft', 'failed'].includes(d.status)).slice(-1)[0] || null,
    updateScheduledPost: async (id, updates) => { const d = drafts.find(x => x.id === id); if (d) Object.assign(d, updates); return d; },
    getUpcomingPosts: async () => drafts.filter(d => d.status === 'queued'),
    cancelPost: async (id) => { const d = drafts.find(x => x.id === id); if (d) d.status = 'canceled'; },
    incrementGenerationsUsed: async () => { mockUser.generations_used++; },
    ensureReferralCode: async () => 'REF123',
    ensureQueuePosition: async () => 5,
    getReferralStats: async () => ({ count: 0, rewardClaimed: false }),
    getWeeklyMetrics: async () => ({ posts: [], snapshots: [], totals: { reach: 0, impressions: 0, engagement: 0 } }),
    deleteUser: async (id) => { deleted.push(id); mockUser = null; },
    getClient: () => ({
      from: () => ({
        select: () => ({ eq: () => ({ limit: async () => ({ data: [] }) }) }),
        update: () => ({ eq: async () => ({}) }),
      }),
    }),
  },
};

const handler = require('../api/sms/inbound');

function makeReq(body) {
  return { method: 'POST', headers: { 'x-twilio-signature': 'sig', host: 'x', 'x-forwarded-proto': 'https' }, url: '/api/sms/inbound', body: { From: '+15550001111', MessageSid: 'SM1', NumMedia: '0', ...body } };
}
function makeRes() {
  const res = { statusCode: null, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.send = (b) => { res.body = b; return res; };
  return res;
}
async function text(msg) {
  smsSent = [];
  const res = makeRes();
  await handler(makeReq({ Body: msg }), res);
  return { reply: smsSent[0]?.body || '', status: res.statusCode, sends: smsSent.length };
}
function freshOnboardedUser(extra = {}) {
  mockUser = {
    id: 'u1', phone: '+15550001111', onboarding_complete: true, onboarding_step: 'done',
    business_name: 'Mikes Pizza', business_type: 'restaurant', tone: 'casual',
    plan: 'starter', generations_used: 0, generations_limit: 50, ...extra,
  };
}

beforeEach(() => { mockUser = null; smsSent = []; deleted = []; drafts = []; pendingCommentReply = null; postedReplies = []; });

const GENERIC_ERROR = 'Something went wrong on our end';

describe('full onboarding walk (real onboarding logic)', () => {
  test('hi -> name -> type -> city -> tone -> skip connect -> done', async () => {
    let r = await text('hi');
    assert.match(r.reply, /business.*called|business name/i);
    r = await text("Mike's Pizza");
    assert.match(r.reply, /kind of business/i);
    r = await text('restaurant');
    assert.match(r.reply.toLowerCase(), /city/);
    r = await text('Phoenixville, PA');
    assert.match(r.reply.toLowerCase(), /sound|casual|professional/);
    assert.equal(mockUser.city, 'Phoenixville, PA');
    r = await text('casual');
    assert.ok(r.reply.length > 0, 'connect step must reply');
    r = await text('SKIP');
    assert.ok(r.reply.length > 0, 'photos step must reply');
    r = await text('DONE');
    assert.ok(!r.reply.includes(GENERIC_ERROR));
    assert.equal(mockUser.onboarding_complete, true);
  });

  test('city step SKIP stores nothing', async () => {
    await text('hi'); await text('Biz'); await text('retail');
    await text('SKIP');
    assert.equal(mockUser.city, undefined);
    assert.equal(mockUser.onboarding_step, 'tone');
  });
});

describe('command battery (onboarded user)', () => {
  test('every advertised command produces a real, non-error reply', async () => {
    const commands = [
      ['audit mysite.com', /top fixes/],
      ['audit my website', /top fixes|text me the address/i],
      ['audit', /top fixes|text me the address/i],
      ['check my reviews', /connect google/i],
      ['reviews', /connect google/i],
      ['LIST', /no posts scheduled|upcoming/i],
      ['what do I have coming up?', /no posts scheduled|upcoming/i],
      ['cancel post', /cancel a scheduled post, reply cancel/i],
      ['how did my posts do this week?', /no published posts|analytics|last 7 days/i],
      ['UPGRADE', /not live yet/i],
      ['settings', /name:|tone:|voice:/i],
      ['delete my data', /confirm/i],
    ];
    for (const [msg, expect] of commands) {
      freshOnboardedUser({ website: msg.startsWith('audit my') || msg === 'audit' ? 'https://mysite.com/' : undefined });
      const r = await text(msg);
      assert.ok(!r.reply.includes(GENERIC_ERROR), `${msg} hit the generic error: ${r.reply.slice(0, 80)}`);
      assert.match(r.reply, expect, `${msg} -> unexpected reply: ${r.reply.slice(0, 120)}`);
    }
  });

  test('delete my data confirm actually deletes', async () => {
    freshOnboardedUser();
    const r = await text('DELETE MY DATA CONFIRM');
    assert.match(r.reply, /permanently deleted/i);
    assert.deepEqual(deleted, ['u1']);
  });

  test('compliance: stop please / HELP / START', async () => {
    freshOnboardedUser();
    let r = await text('stop please');
    assert.match(r.reply, /unsubscribed/i);
    freshOnboardedUser();
    r = await text('HELP');
    assert.match(r.reply, /support/i);
    assert.ok(!r.reply.includes('—'), 'HELP must be GSM-clean');
    freshOnboardedUser();
    r = await text('START');
    assert.match(r.reply, /welcome back/i);
  });
});

describe('draft + approval flows', () => {
  test('draft then YES publishes the draft platforms only', async () => {
    freshOnboardedUser();
    let r = await text('write a post about our special');
    assert.match(r.reply, /YES to post/i);
    assert.equal(drafts.length, 1);
    r = await text('YES');
    assert.match(r.reply, /queued for publishing/i);
    assert.equal(drafts[0].status, 'queued');
    assert.deepEqual(drafts[0].platforms, ['instagram']);
  });

  test('SKIP cancels the draft row for real', async () => {
    freshOnboardedUser();
    await text('write a post about our special');
    const r = await text('SKIP');
    assert.match(r.reply, /canceled/i);
    assert.equal(drafts[0].status, 'canceled');
  });

  test('over-quota user can still approve a pending draft', async () => {
    freshOnboardedUser({ generations_used: 50 });
    drafts.push({ id: 'p1', status: 'draft', platforms: ['instagram'], content: 'x' });
    const r = await text('YES');
    assert.match(r.reply, /queued for publishing/i, `got: ${r.reply.slice(0, 100)}`);
  });

  test('over-quota user asking for a new post gets the honest cap message', async () => {
    freshOnboardedUser({ generations_used: 50 });
    const r = await text('write a post about tacos');
    assert.match(r.reply, /included generations|resets on the 1st/i);
    assert.ok(!/UPGRADE/i.test(r.reply), 'cap message must not point at the dead UPGRADE loop');
  });

  test('comment-reply approval: YES posts, reply: posts custom wording', async () => {
    freshOnboardedUser();
    pendingCommentReply = { id: 'c1', platform: 'facebook', draft_reply: 'Thanks so much!', status: 'draft' };
    let r = await text('YES');
    assert.match(r.reply, /reply posted/i);
    assert.deepEqual(postedReplies, ['Thanks so much!']);
    postedReplies = [];
    pendingCommentReply = { id: 'c2', platform: 'facebook', draft_reply: 'Old draft', status: 'draft' };
    r = await text('reply: We appreciate you, see you Friday!');
    assert.match(r.reply, /posted/i);
    assert.deepEqual(postedReplies, ['We appreciate you, see you Friday!']);
  });
});

describe('hostile and odd inputs', () => {
  test('emoji-only, whitespace-heavy, and very long messages never crash', async () => {
    for (const msg of ['🔥🔥🔥', '    ', 'a'.repeat(1600), '<script>alert(1)</script>', 'null']) {
      freshOnboardedUser();
      const r = await text(msg);
      assert.notEqual(r.status, 500, `"${msg.slice(0, 20)}" returned 500`);
    }
  });
});
