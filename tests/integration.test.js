'use strict';

/**
 * Integration tests for POST /api/sms/inbound
 *
 * All external dependencies are mocked:
 * - Twilio (signature validation + sendSms)
 * - Claude AI (generateResponse)
 * - Supabase (all DB helpers)
 * - outbound SMS module
 *
 * We inject mocks into require.cache BEFORE loading the handler.
 */

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// =============================================
// MOCK STATE — mutated per test
// =============================================

let mockUser = null;
let smsSent = [];
let dbCalls = { logMessage: [], createUser: [], updateUser: [], createScheduledPost: [], cancelPost: [] };
let mockClaudeResponse = null;
let mockSocialAccounts = [];
let mockUpcomingPosts = [];
let mockRecentMessages = [];
let rateLimitAllowed = true;

// =============================================
// INJECT MOCKS INTO REQUIRE CACHE
// =============================================

// Mock twilio module
require.cache[require.resolve('twilio')] = {
  id: require.resolve('twilio'),
  filename: require.resolve('twilio'),
  loaded: true,
  exports: Object.assign(
    // The twilio() constructor (called for Twilio client)
    function TwilioMock() { return {}; },
    {
      // validateRequest — used in validateTwilioSignature
      validateRequest: () => true,
    }
  ),
};

// Mock outbound SMS
const outboundPath = require.resolve('../api/sms/outbound');
const outboundMock = async function handler(req, res) { res.status(200).json({}); };
outboundMock.sendSms = async (to, body) => {
  smsSent.push({ to, body });
  return { sid: 'SM_mock_' + Date.now(), status: 'sent' };
};
require.cache[outboundPath] = {
  id: outboundPath,
  filename: outboundPath,
  loaded: true,
  exports: outboundMock,
};

// Mock rate-limit module
require.cache[require.resolve('../lib/rate-limit')] = {
  id: require.resolve('../lib/rate-limit'),
  filename: require.resolve('../lib/rate-limit'),
  loaded: true,
  exports: {
    checkRateLimit: async () => ({ allowed: rateLimitAllowed, remaining: rateLimitAllowed ? 9 : 0, count: rateLimitAllowed ? 1 : 2 }),
    rateLimitMiddleware: () => async () => true,
  },
};

// Mock Claude generateResponse — use an object reference so we can swap the impl at test time
const claudeMockModule = {
  generateResponse: async () => {
    if (mockClaudeResponse === null) {
      return {
        reply_text: 'Here is a post for you! Reply YES to post, EDIT to change, LATER to schedule, or SKIP to cancel.',
        intent: 'post',
        action: { type: 'draft_post', platform: 'instagram', content: 'Check out our special!' },
        model: 'claude-sonnet-4-5',
        tokensUsed: 100,
      };
    }
    if (mockClaudeResponse === 'THROW') {
      throw new Error('Claude API unavailable');
    }
    return mockClaudeResponse;
  },
};

const claudePath = require.resolve('../lib/claude');
require.cache[claudePath] = {
  id: claudePath,
  filename: claudePath,
  loaded: true,
  exports: claudeMockModule,
};

// Mock Supabase
const supabasePath = require.resolve('../lib/supabase');
require.cache[supabasePath] = {
  id: supabasePath,
  filename: supabasePath,
  loaded: true,
  exports: {
    getUserByPhone: async (phone) => mockUser,
    createUser: async (phone) => {
      dbCalls.createUser.push(phone);
      return {
        id: 'new-user-id',
        phone,
        onboarding_complete: false,
        onboarding_step: 'name',
        plan: 'starter',
        generations_used: 0,
        generations_limit: 50,
      };
    },
    updateUser: async (id, updates) => {
      dbCalls.updateUser.push({ id, updates });
      return { ...mockUser, ...updates };
    },
    logMessage: async (data) => {
      dbCalls.logMessage.push(data);
      return { id: 'msg-' + Date.now() };
    },
    getRecentMessages: async () => mockRecentMessages,
    getSocialAccounts: async () => mockSocialAccounts,
    createScheduledPost: async (data) => {
      dbCalls.createScheduledPost.push(data);
      return { id: 'post-' + Date.now(), ...data };
    },
    updateScheduledPost: async () => ({}),
    getUpcomingPosts: async () => mockUpcomingPosts,
    cancelPost: async (postId, userId) => {
      dbCalls.cancelPost.push({ postId, userId });
    },
    incrementGenerationsUsed: async () => {},
    deleteUser: async () => {},
  },
};

// Now load the handler (all deps already mocked)
const handler = require('../api/sms/inbound');

// =============================================
// TEST HELPERS
// =============================================

function makeReq(body = {}, headers = {}) {
  return {
    method: 'POST',
    url: '/api/sms/inbound',
    headers: {
      host: 'test.vercel.app',
      'x-forwarded-proto': 'https',
      ...headers,
    },
    body: {
      From: '+15551234567',
      Body: 'Hello',
      MessageSid: 'SM_test_001',
      To: '+18005551234',
      ...body,
    },
  };
}

function makeRes() {
  const res = {
    _status: null,
    _body: null,
    _headers: {},
    status(code) {
      this._status = code;
      return this;
    },
    send(body) {
      this._body = body;
      return this;
    },
    json(body) {
      this._body = body;
      return this;
    },
    setHeader(k, v) {
      this._headers[k] = v;
    },
  };
  return res;
}

function makeOnboardingUser(step, overrides = {}) {
  return {
    id: 'user-abc',
    phone: '+15551234567',
    onboarding_complete: false,
    onboarding_step: step,
    business_name: step !== 'name' ? 'Test Biz' : null,
    business_type: null,
    tone: null,
    plan: 'starter',
    generations_used: 0,
    generations_limit: 50,
    ...overrides,
  };
}

function makeOnboardedUser(overrides = {}) {
  return {
    id: 'user-abc',
    phone: '+15551234567',
    onboarding_complete: true,
    onboarding_step: 'done',
    business_name: 'Test Biz',
    business_type: 'restaurant',
    tone: 'casual',
    plan: 'starter',
    generations_used: 5,
    generations_limit: 50,
    ...overrides,
  };
}

// =============================================
// TESTS
// =============================================

describe('HTTP method validation', () => {
  test('GET returns 405', async () => {
    const req = { method: 'GET', headers: {}, body: {} };
    const res = makeRes();
    await handler(req, res);
    assert.equal(res._status, 405);
  });

  test('PUT returns 405', async () => {
    const req = { method: 'PUT', headers: {}, body: {} };
    const res = makeRes();
    await handler(req, res);
    assert.equal(res._status, 405);
  });
});

describe('Missing required fields', () => {
  beforeEach(() => {
    smsSent = [];
    dbCalls = { logMessage: [], createUser: [], updateUser: [], createScheduledPost: [], cancelPost: [] };
    rateLimitAllowed = true;
    mockUser = makeOnboardedUser();
  });

  test('missing From returns 400', async () => {
    const req = makeReq({ From: undefined });
    const res = makeRes();
    await handler(req, res);
    assert.equal(res._status, 400);
  });

  test('missing Body returns 400', async () => {
    const req = makeReq({ Body: '' });
    const res = makeRes();
    await handler(req, res);
    assert.equal(res._status, 400);
  });

  test('whitespace-only Body returns 400', async () => {
    const req = makeReq({ Body: '   ' });
    const res = makeRes();
    await handler(req, res);
    assert.equal(res._status, 400);
  });
});

describe('Rate limiting', () => {
  beforeEach(() => {
    smsSent = [];
    dbCalls = { logMessage: [], createUser: [], updateUser: [], createScheduledPost: [], cancelPost: [] };
    mockUser = makeOnboardedUser();
  });

  test('rate limited request returns 200 (Twilio-friendly) and sends rate limit SMS', async () => {
    rateLimitAllowed = false;
    const req = makeReq({ Body: 'write a post' });
    const res = makeRes();
    await handler(req, res);
    assert.equal(res._status, 200);
    // Should have sent the rate limit error SMS
    const rateLimitMsg = smsSent.find(s => s.body.toLowerCase().includes('slow down'));
    assert.ok(rateLimitMsg, 'Rate limit SMS should be sent');
  });

  test('allowed request proceeds normally', async () => {
    rateLimitAllowed = true;
    const req = makeReq({ Body: 'help' });
    const res = makeRes();
    mockClaudeResponse = { reply_text: 'Here is what I can do!', intent: 'help', action: null };
    await handler(req, res);
    assert.equal(res._status, 200);
  });
});

describe('New user onboarding', () => {
  beforeEach(() => {
    smsSent = [];
    dbCalls = { logMessage: [], createUser: [], updateUser: [], createScheduledPost: [], cancelPost: [] };
    rateLimitAllowed = true;
    mockUser = null; // No user found — triggers createUser
    mockClaudeResponse = null;
  });

  test('new user is created when not found', async () => {
    const req = makeReq({ Body: 'hello' });
    const res = makeRes();
    await handler(req, res);
    assert.equal(dbCalls.createUser.length, 1);
    assert.equal(dbCalls.createUser[0], '+15551234567');
  });

  test('new user receives onboarding welcome prompt', async () => {
    const req = makeReq({ Body: 'hello' });
    const res = makeRes();
    await handler(req, res);
    // The outbound SMS should contain the welcome message
    assert.ok(smsSent.length > 0, 'SMS should be sent');
    // Welcome message should ask for business name
    const sentText = smsSent[0].body;
    assert.ok(
      sentText.toLowerCase().includes('business') || sentText.toLowerCase().includes('welcome'),
      'Welcome/business prompt expected'
    );
  });

  test('returns 200 OK', async () => {
    const req = makeReq({ Body: 'hello' });
    const res = makeRes();
    await handler(req, res);
    assert.equal(res._status, 200);
  });
});

describe('Onboarding state machine via inbound handler', () => {
  beforeEach(() => {
    smsSent = [];
    dbCalls = { logMessage: [], createUser: [], updateUser: [], createScheduledPost: [], cancelPost: [] };
    rateLimitAllowed = true;
    mockClaudeResponse = null;
  });

  test('name step: valid name triggers ask_type response', async () => {
    mockUser = makeOnboardingUser('name');
    const req = makeReq({ Body: 'Pizza Palace' });
    const res = makeRes();
    await handler(req, res);
    const text = smsSent[0]?.body || '';
    assert.ok(
      text.toLowerCase().includes('restaurant') || text.toLowerCase().includes('business') || text.toLowerCase().includes('kind'),
      'Should ask for business type'
    );
  });

  test('name step: short name triggers validation error', async () => {
    mockUser = makeOnboardingUser('name');
    const req = makeReq({ Body: 'A' });
    const res = makeRes();
    await handler(req, res);
    const text = smsSent[0]?.body || '';
    assert.ok(text.includes('2 characters') || text.includes('at least'), 'Should show validation error');
  });

  test('type step: valid type transitions forward', async () => {
    mockUser = makeOnboardingUser('type');
    const req = makeReq({ Body: 'restaurant' });
    const res = makeRes();
    await handler(req, res);
    const text = smsSent[0]?.body || '';
    // After type, should ask for tone
    assert.ok(
      text.toLowerCase().includes('tone') || text.toLowerCase().includes('casual') || text.toLowerCase().includes('professional'),
      'Should ask for tone'
    );
  });

  test('tone step: valid tone triggers completion message', async () => {
    mockUser = makeOnboardingUser('tone', { business_name: 'Test Biz' });
    // Mock updateUser to return completed state
    const req = makeReq({ Body: 'casual' });
    const res = makeRes();
    await handler(req, res);
    const text = smsSent[0]?.body || '';
    // Completion message should mention what Sidekick can do
    assert.ok(
      text.toLowerCase().includes('post') || text.toLowerCase().includes('ready') || text.toLowerCase().includes('set'),
      'Should show completion message'
    );
  });
});

describe('Existing user — post request', () => {
  beforeEach(() => {
    smsSent = [];
    dbCalls = { logMessage: [], createUser: [], updateUser: [], createScheduledPost: [], cancelPost: [] };
    rateLimitAllowed = true;
    mockUser = makeOnboardedUser();
    mockSocialAccounts = [];
    mockRecentMessages = [];
    mockClaudeResponse = {
      reply_text: 'Here is your post! Check out our special 🍕 #pizza #local\n\nReply YES to post, EDIT to change, LATER to schedule, or SKIP to cancel.',
      intent: 'post',
      action: { type: 'draft_post', platform: 'instagram', content: 'Check out our special 🍕 #pizza #local' },
      model: 'claude-sonnet-4-5',
      tokensUsed: 150,
    };
  });

  test('post request calls Claude and returns 200', async () => {
    const req = makeReq({ Body: 'write a post about our lunch special' });
    const res = makeRes();
    await handler(req, res);
    assert.equal(res._status, 200);
  });

  test('post request sends Claude reply via SMS', async () => {
    const req = makeReq({ Body: 'write a post about our lunch special' });
    const res = makeRes();
    await handler(req, res);
    assert.ok(smsSent.length > 0);
    assert.ok(smsSent[0].body.includes('Here is your post'));
  });

  test('draft post action creates scheduled post record', async () => {
    const req = makeReq({ Body: 'write a post' });
    const res = makeRes();
    await handler(req, res);
    assert.equal(dbCalls.createScheduledPost.length, 1);
    assert.equal(dbCalls.createScheduledPost[0].status, 'draft');
  });

  test('inbound and outbound messages are logged', async () => {
    const req = makeReq({ Body: 'write a post' });
    const res = makeRes();
    await handler(req, res);
    const inbound = dbCalls.logMessage.find(m => m.direction === 'inbound');
    const outbound = dbCalls.logMessage.find(m => m.direction === 'outbound');
    assert.ok(inbound, 'Inbound message should be logged');
    assert.ok(outbound, 'Outbound message should be logged');
  });
});

describe('Existing user — YES/EDIT/SKIP responses', () => {
  const draftPost = {
    id: 'msg-draft',
    direction: 'outbound',
    intent: 'post',
    body: 'Check out our special! Reply YES to post, EDIT to change, LATER to schedule, or SKIP to cancel.',
  };

  beforeEach(() => {
    smsSent = [];
    dbCalls = { logMessage: [], createUser: [], updateUser: [], createScheduledPost: [], cancelPost: [] };
    rateLimitAllowed = true;
    mockUser = makeOnboardedUser();
    mockRecentMessages = [draftPost];
    mockClaudeResponse = null;
  });

  test('YES with no connected accounts prompts user to connect', async () => {
    mockSocialAccounts = [];
    const req = makeReq({ Body: 'yes' });
    const res = makeRes();
    await handler(req, res);
    const text = smsSent[0]?.body || '';
    assert.ok(
      text.toLowerCase().includes('connect') || text.toLowerCase().includes('social'),
      'Should prompt to connect accounts'
    );
  });

  test('YES with connected account queues post', async () => {
    mockSocialAccounts = [{ platform: 'instagram' }];
    const req = makeReq({ Body: 'yes' });
    const res = makeRes();
    await handler(req, res);
    assert.equal(dbCalls.createScheduledPost.length, 1);
    assert.equal(dbCalls.createScheduledPost[0].status, 'queued');
  });

  test('YES with connected account sends confirmation SMS', async () => {
    mockSocialAccounts = [{ platform: 'instagram' }];
    const req = makeReq({ Body: 'YES' });
    const res = makeRes();
    await handler(req, res);
    const text = smsSent[0]?.body || '';
    assert.ok(
      text.toLowerCase().includes('queued') || text.toLowerCase().includes('publishing'),
      'Should confirm post is queued'
    );
  });

  test('SKIP cancels pending post', async () => {
    mockSocialAccounts = [];
    const req = makeReq({ Body: 'skip' });
    const res = makeRes();
    await handler(req, res);
    const text = smsSent[0]?.body || '';
    assert.ok(
      text.toLowerCase().includes('cancel') || text.toLowerCase().includes('skip'),
      'Should confirm cancellation'
    );
  });

  test('LATER prompts for schedule time', async () => {
    const req = makeReq({ Body: 'later' });
    const res = makeRes();
    await handler(req, res);
    const text = smsSent[0]?.body || '';
    assert.ok(
      text.toLowerCase().includes('when') || text.toLowerCase().includes('time') || text.toLowerCase().includes('schedule'),
      'Should ask for schedule time'
    );
  });
});

describe('Generation limits', () => {
  beforeEach(() => {
    smsSent = [];
    dbCalls = { logMessage: [], createUser: [], updateUser: [], createScheduledPost: [], cancelPost: [] };
    rateLimitAllowed = true;
    mockSocialAccounts = [];
    mockRecentMessages = [];
    mockClaudeResponse = null;
  });

  test('user at generation limit receives limit error message', async () => {
    mockUser = makeOnboardedUser({ generations_used: 50, generations_limit: 50, plan: 'starter' });
    const req = makeReq({ Body: 'write a post' });
    const res = makeRes();
    await handler(req, res);
    const text = smsSent[0]?.body || '';
    assert.ok(
      text.toLowerCase().includes('generation') || text.toLowerCase().includes('limit') || text.toLowerCase().includes('upgrade'),
      'Should show generation limit message'
    );
    // Claude should NOT be called
    assert.equal(dbCalls.createScheduledPost.length, 0);
  });

  test('pro plan user has unlimited generations', async () => {
    mockUser = makeOnboardedUser({ plan: 'pro', generations_used: 9999, generations_limit: null });
    mockClaudeResponse = { reply_text: 'Here is your post!', intent: 'post', action: null };
    const req = makeReq({ Body: 'write a post' });
    const res = makeRes();
    await handler(req, res);
    // Should NOT get a generation limit error
    const limitMsg = smsSent.find(s =>
      s.body.toLowerCase().includes('limit') && s.body.toLowerCase().includes('generation')
    );
    assert.equal(limitMsg, undefined, 'Pro users should not get a limit message');
  });

  test('user with generations remaining can still use Claude', async () => {
    mockUser = makeOnboardedUser({ generations_used: 10, generations_limit: 50 });
    mockClaudeResponse = { reply_text: 'Here is a post!', intent: 'post', action: null };
    const req = makeReq({ Body: 'write a post' });
    const res = makeRes();
    await handler(req, res);
    assert.equal(res._status, 200);
    const text = smsSent[0]?.body || '';
    assert.ok(text.includes('Here is a post!'));
  });
});

describe('LIST_SCHEDULE command', () => {
  beforeEach(() => {
    smsSent = [];
    dbCalls = { logMessage: [], createUser: [], updateUser: [], createScheduledPost: [], cancelPost: [] };
    rateLimitAllowed = true;
    mockUser = makeOnboardedUser();
    mockClaudeResponse = null;
  });

  test('no upcoming posts returns empty schedule message', async () => {
    mockUpcomingPosts = [];
    const req = makeReq({ Body: 'show my schedule' });
    const res = makeRes();
    await handler(req, res);
    const text = smsSent[0]?.body || '';
    assert.ok(
      text.toLowerCase().includes('no posts') || text.toLowerCase().includes('scheduled'),
      'Should show empty schedule message'
    );
  });

  test('upcoming posts are formatted and returned', async () => {
    mockUpcomingPosts = [
      {
        id: 'post-1',
        platforms: ['instagram'],
        content: 'Our weekly special is here! Come in and try our...',
        scheduled_for: new Date(Date.now() + 86400000).toISOString(),
        status: 'queued',
      },
    ];
    const req = makeReq({ Body: 'what is coming up' });
    const res = makeRes();
    await handler(req, res);
    const text = smsSent[0]?.body || '';
    assert.ok(
      text.toLowerCase().includes('post') || text.toLowerCase().includes('upcoming'),
      'Should list upcoming posts'
    );
  });
});

describe('CANCEL command', () => {
  beforeEach(() => {
    smsSent = [];
    dbCalls = { logMessage: [], createUser: [], updateUser: [], createScheduledPost: [], cancelPost: [] };
    rateLimitAllowed = true;
    mockUser = makeOnboardedUser();
    mockClaudeResponse = null;
  });

  test('CANCEL 1 with a valid post cancels it', async () => {
    mockUpcomingPosts = [
      {
        id: 'post-1',
        platforms: ['instagram'],
        content: 'A post',
        scheduled_for: new Date(Date.now() + 86400000).toISOString(),
        status: 'queued',
      },
    ];
    const req = makeReq({ Body: 'cancel 1' });
    const res = makeRes();
    await handler(req, res);
    assert.equal(dbCalls.cancelPost.length, 1);
    assert.equal(dbCalls.cancelPost[0].postId, 'post-1');
  });

  test('CANCEL 99 with no matching post returns not-found message', async () => {
    mockUpcomingPosts = [];
    const req = makeReq({ Body: 'cancel 99' });
    const res = makeRes();
    await handler(req, res);
    const text = smsSent[0]?.body || '';
    assert.ok(
      text.toLowerCase().includes('no post') || text.toLowerCase().includes('not found') || text.includes('99'),
      'Should say post not found'
    );
    assert.equal(dbCalls.cancelPost.length, 0);
  });
});

describe('Data deletion', () => {
  beforeEach(() => {
    smsSent = [];
    dbCalls = { logMessage: [], createUser: [], updateUser: [], createScheduledPost: [], cancelPost: [] };
    rateLimitAllowed = true;
    mockUser = makeOnboardedUser();
    mockClaudeResponse = null;
  });

  test('delete my data sends confirmation and returns 200', async () => {
    const req = makeReq({ Body: 'delete my data' });
    const res = makeRes();
    await handler(req, res);
    assert.equal(res._status, 200);
    const text = smsSent[0]?.body || '';
    assert.ok(
      text.toLowerCase().includes('deleted') || text.toLowerCase().includes('delete') || text.toLowerCase().includes('removed'),
      'Should confirm data deletion'
    );
  });

  test('delete data (without "my") also works', async () => {
    const req = makeReq({ Body: 'delete data' });
    const res = makeRes();
    await handler(req, res);
    assert.equal(res._status, 200);
  });
});

describe('Error handling', () => {
  beforeEach(() => {
    smsSent = [];
    dbCalls = { logMessage: [], createUser: [], updateUser: [], createScheduledPost: [], cancelPost: [] };
    rateLimitAllowed = true;
  });

  test('internal error returns 200 (prevents Twilio retries) and sends error SMS', async () => {
    mockUser = makeOnboardedUser();
    mockRecentMessages = [];
    mockSocialAccounts = [];
    rateLimitAllowed = true;
    // Signal the Claude mock to throw
    mockClaudeResponse = 'THROW';

    const req = makeReq({ Body: 'write a post about lunch' });
    const res = makeRes();
    await handler(req, res);

    // Restore
    mockClaudeResponse = null;

    assert.equal(res._status, 200);
    // The error handler sends ERROR_MESSAGES.general: "Something went wrong on our end. Please try again in a moment."
    assert.ok(smsSent.length > 0, `Expected at least 1 SMS sent, got: ${smsSent.length}`);
    const errorSms = smsSent.find(s =>
      s.body.includes('went wrong') || s.body.includes('try again') || s.body.toLowerCase().includes('error')
    );
    assert.ok(errorSms, `Should send error SMS to user. SMS sent: ${JSON.stringify(smsSent)}`);
  });
});
