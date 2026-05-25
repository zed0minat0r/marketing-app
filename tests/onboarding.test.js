'use strict';

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// We need to mock the supabase module because onboarding.js imports it.
// Use module mocking via require cache manipulation.
const Module = require('module');

// Track updateUser calls
let updateUserCalls = [];
let updateUserReturnValue = null;
// Allows tone-step / connect-step tests to control whether the user has a
// connected social account when buildCompleteMessage runs.
let mockSocialAccounts = [];
let mockPhotoCount = 0;

// Inject mock into require cache BEFORE loading onboarding
const mockSupabase = {
  updateUser: async (userId, updates) => {
    updateUserCalls.push({ userId, updates });
    return { ...updateUserReturnValue, ...updates };
  },
  getSocialAccounts: async () => mockSocialAccounts,
  countCustomerPhotos: async () => mockPhotoCount,
};

require.cache[require.resolve('../lib/supabase')] = {
  id: require.resolve('../lib/supabase'),
  filename: require.resolve('../lib/supabase'),
  loaded: true,
  exports: mockSupabase,
};

// Mock oauth-link to avoid needing a real DB write to oauth_links table.
const mockOauthLink = {
  createOAuthStartLink: async ({ userId, platform }) =>
    `https://sidekik.com/api/oauth/${platform}/start?token=mock_${userId}_${platform}`,
  normalizePlatform: (input) => {
    const lower = (input || '').toLowerCase().trim();
    const map = { facebook: 'meta', meta: 'meta', instagram: 'meta', google: 'google', linkedin: 'linkedin', twitter: 'twitter', x: 'twitter', pinterest: 'pinterest' };
    return map[lower] || null;
  },
  platformLabel: (key) => ({ meta: 'Facebook + Instagram', google: 'Google Business', linkedin: 'LinkedIn', twitter: 'X', pinterest: 'Pinterest' }[key] || key),
};

require.cache[require.resolve('../lib/oauth-link')] = {
  id: require.resolve('../lib/oauth-link'),
  filename: require.resolve('../lib/oauth-link'),
  loaded: true,
  exports: mockOauthLink,
};

const { processOnboarding } = require('../lib/onboarding');
const { ONBOARDING_MESSAGES } = require('../lib/constants');

// Helper: build a user object at a given step
function makeUser(step, overrides = {}) {
  return {
    id: 'user-123',
    phone: '+15551234567',
    onboarding_step: step,
    onboarding_complete: false,
    business_name: null,
    business_type: null,
    tone: null,
    plan: 'starter',
    ...overrides,
  };
}

describe('processOnboarding — name step', () => {
  beforeEach(() => {
    updateUserCalls = [];
    updateUserReturnValue = makeUser('type', { business_name: 'Test Biz' });
  });

  test('valid name transitions to type step', async () => {
    const user = makeUser('name');
    const result = await processOnboarding(user, 'Joe\'s Pizza');
    assert.equal(result.done, false);
    assert.equal(result.updatedUser.onboarding_step, 'type');
    assert.equal(result.updatedUser.business_name, "Joe's Pizza");
    // Reply should contain the business name
    assert.ok(result.replyText.includes("Joe's Pizza"));
  });

  test('single character name returns error', async () => {
    const user = makeUser('name');
    const result = await processOnboarding(user, 'A');
    assert.equal(result.done, false);
    assert.equal(result.updatedUser, user); // No DB update
    assert.ok(result.replyText.includes('at least 2 characters'));
    assert.equal(updateUserCalls.length, 0);
  });

  test('empty name returns error', async () => {
    const user = makeUser('name');
    const result = await processOnboarding(user, '  ');
    assert.equal(result.done, false);
    assert.ok(result.replyText.includes('at least 2 characters'));
  });

  test('name is capped at 100 characters', async () => {
    const longName = 'A'.repeat(200);
    updateUserReturnValue = makeUser('type', { business_name: 'A'.repeat(100) });
    const user = makeUser('name');
    const result = await processOnboarding(user, longName);
    // updateUser should have been called with 100-char name
    assert.equal(updateUserCalls[0].updates.business_name.length, 100);
  });

  test('updateUser called with correct fields', async () => {
    const user = makeUser('name');
    await processOnboarding(user, 'My Shop');
    assert.equal(updateUserCalls.length, 1);
    assert.equal(updateUserCalls[0].userId, 'user-123');
    assert.equal(updateUserCalls[0].updates.onboarding_step, 'type');
    assert.equal(updateUserCalls[0].updates.business_name, 'My Shop');
  });

  test('whitespace is trimmed from name', async () => {
    updateUserReturnValue = makeUser('type', { business_name: 'Clean Name' });
    const user = makeUser('name');
    await processOnboarding(user, '  Clean Name  ');
    assert.equal(updateUserCalls[0].updates.business_name, 'Clean Name');
  });
});

describe('processOnboarding — type step', () => {
  beforeEach(() => {
    updateUserCalls = [];
    updateUserReturnValue = makeUser('tone', { business_type: 'restaurant' });
  });

  const typeInputs = [
    ['restaurant', 'restaurant'],
    ['retail', 'retail'],
    ['service', 'service'],
    ['ecommerce', 'ecommerce'],
    ['other', 'other'],
  ];

  for (const [input, expected] of typeInputs) {
    test(`exact match: "${input}"`, async () => {
      updateUserReturnValue = makeUser('tone', { business_type: expected });
      const user = makeUser('type');
      const result = await processOnboarding(user, input);
      assert.equal(result.done, false);
      assert.equal(updateUserCalls[0].updates.business_type, expected);
      assert.equal(updateUserCalls[0].updates.onboarding_step, 'tone');
    });
  }

  test('synonym: cafe -> restaurant', async () => {
    updateUserReturnValue = makeUser('tone', { business_type: 'restaurant' });
    const user = makeUser('type');
    await processOnboarding(user, 'I run a cafe');
    assert.equal(updateUserCalls[0].updates.business_type, 'restaurant');
  });

  test('synonym: food -> restaurant', async () => {
    await processOnboarding(makeUser('type'), 'food truck');
    assert.equal(updateUserCalls[0].updates.business_type, 'restaurant');
  });

  test('synonym: shop -> retail', async () => {
    updateUserReturnValue = makeUser('tone', { business_type: 'retail' });
    await processOnboarding(makeUser('type'), 'clothing shop');
    assert.equal(updateUserCalls[0].updates.business_type, 'retail');
  });

  test('synonym: boutique -> retail', async () => {
    updateUserReturnValue = makeUser('tone', { business_type: 'retail' });
    await processOnboarding(makeUser('type'), 'a boutique');
    assert.equal(updateUserCalls[0].updates.business_type, 'retail');
  });

  test('synonym: salon -> service', async () => {
    updateUserReturnValue = makeUser('tone', { business_type: 'service' });
    await processOnboarding(makeUser('type'), 'hair salon');
    assert.equal(updateUserCalls[0].updates.business_type, 'service');
  });

  test('synonym: agency -> service', async () => {
    updateUserReturnValue = makeUser('tone', { business_type: 'service' });
    await processOnboarding(makeUser('type'), 'marketing agency');
    assert.equal(updateUserCalls[0].updates.business_type, 'service');
  });

  test('synonym: shopify -> retail (shopify contains "shop" which matches retail first)', async () => {
    // "shopify" includes "shop" which hits the retail synonym check before the shopify ecommerce check
    updateUserReturnValue = makeUser('tone', { business_type: 'retail' });
    await processOnboarding(makeUser('type'), 'shopify');
    assert.equal(updateUserCalls[0].updates.business_type, 'retail');
  });

  test('synonym: amazon -> ecommerce', async () => {
    updateUserReturnValue = makeUser('tone', { business_type: 'ecommerce' });
    await processOnboarding(makeUser('type'), 'amazon seller');
    assert.equal(updateUserCalls[0].updates.business_type, 'ecommerce');
  });

  test('synonym: online -> ecommerce', async () => {
    updateUserReturnValue = makeUser('tone', { business_type: 'ecommerce' });
    await processOnboarding(makeUser('type'), 'I sell online');
    assert.equal(updateUserCalls[0].updates.business_type, 'ecommerce');
  });

  test('unknown type defaults to other', async () => {
    updateUserReturnValue = makeUser('tone', { business_type: 'other' });
    await processOnboarding(makeUser('type'), 'I do something unique');
    assert.equal(updateUserCalls[0].updates.business_type, 'other');
  });

  test('reply is the ask_tone message', async () => {
    const user = makeUser('type');
    const result = await processOnboarding(user, 'restaurant');
    assert.equal(result.replyText, ONBOARDING_MESSAGES.ask_tone);
  });
});

describe('processOnboarding — tone step', () => {
  beforeEach(() => {
    updateUserCalls = [];
    updateUserReturnValue = makeUser('connect', {
      business_name: 'Test Biz',
      tone: 'casual',
    });
  });

  const toneInputs = [
    ['casual', 'casual'],
    ['professional', 'professional'],
    ['bold', 'bold'],
    ['friendly', 'friendly'],
  ];

  for (const [input, expected] of toneInputs) {
    test(`exact match: "${input}"`, async () => {
      updateUserReturnValue = makeUser('connect', {
        business_name: 'Test Biz',
        tone: expected,
      });
      const user = makeUser('tone', { business_name: 'Test Biz' });
      const result = await processOnboarding(user, input);
      assert.equal(result.done, false);
      assert.equal(updateUserCalls[0].updates.tone, expected);
      // After tone, next step is 'connect' (not 'done')
      assert.equal(updateUserCalls[0].updates.onboarding_step, 'connect');
    });
  }

  test('synonym: fun -> casual', async () => {
    const user = makeUser('tone');
    await processOnboarding(user, 'fun and relaxed');
    assert.equal(updateUserCalls[0].updates.tone, 'casual');
  });

  test('synonym: chill -> casual', async () => {
    await processOnboarding(makeUser('tone'), 'chill vibes');
    assert.equal(updateUserCalls[0].updates.tone, 'casual');
  });

  test('synonym: formal -> professional', async () => {
    updateUserReturnValue = makeUser('connect', { tone: 'professional', business_name: 'T' });
    await processOnboarding(makeUser('tone'), 'formal');
    assert.equal(updateUserCalls[0].updates.tone, 'professional');
  });

  test('synonym: corporate -> professional', async () => {
    updateUserReturnValue = makeUser('connect', { tone: 'professional', business_name: 'T' });
    await processOnboarding(makeUser('tone'), 'corporate');
    assert.equal(updateUserCalls[0].updates.tone, 'professional');
  });

  test('synonym: energetic -> bold', async () => {
    updateUserReturnValue = makeUser('connect', { tone: 'bold', business_name: 'T' });
    await processOnboarding(makeUser('tone'), 'energetic');
    assert.equal(updateUserCalls[0].updates.tone, 'bold');
  });

  test('synonym: warm -> friendly', async () => {
    updateUserReturnValue = makeUser('connect', { tone: 'friendly', business_name: 'T' });
    await processOnboarding(makeUser('tone'), 'warm');
    assert.equal(updateUserCalls[0].updates.tone, 'friendly');
  });

  test('unknown tone defaults to professional', async () => {
    updateUserReturnValue = makeUser('connect', { tone: 'professional', business_name: 'T' });
    await processOnboarding(makeUser('tone'), 'something weird');
    assert.equal(updateUserCalls[0].updates.tone, 'professional');
  });

  test('done flag is false (continues to connect step)', async () => {
    const user = makeUser('tone', { business_name: 'Test Biz' });
    const result = await processOnboarding(user, 'casual');
    assert.equal(result.done, false);
  });

  test('reply contains an OAuth connect link', async () => {
    const user = makeUser('tone', { business_name: 'Test Biz' });
    const result = await processOnboarding(user, 'casual');
    assert.ok(/api\/oauth\/meta\/start/.test(result.replyText));
  });
});

describe('processOnboarding — connect step', () => {
  beforeEach(() => {
    updateUserCalls = [];
    updateUserReturnValue = makeUser('photos', { business_name: 'Test Biz', tone: 'casual' });
  });

  test('SKIP advances to photos step with photos prompt', async () => {
    const user = makeUser('connect', { business_name: 'Test Biz' });
    const result = await processOnboarding(user, 'SKIP');
    assert.equal(result.done, false);
    assert.equal(updateUserCalls[0].updates.onboarding_step, 'photos');
    assert.ok(/photos|library/i.test(result.replyText));
  });

  test('lowercase skip advances to photos step', async () => {
    const user = makeUser('connect', { business_name: 'Test Biz' });
    const result = await processOnboarding(user, 'skip');
    assert.equal(updateUserCalls[0].updates.onboarding_step, 'photos');
  });

  test('valid platform returns new OAuth link without advancing step', async () => {
    const user = makeUser('connect', { business_name: 'Test Biz' });
    const result = await processOnboarding(user, 'LinkedIn');
    // No step change yet — they advance on OAuth callback
    assert.equal(updateUserCalls.length, 0);
    assert.ok(/api\/oauth\/linkedin\/start/.test(result.replyText));
  });

  test('invalid platform returns "did not recognize" hint', async () => {
    const user = makeUser('connect', { business_name: 'Test Biz' });
    const result = await processOnboarding(user, 'MyBlog');
    assert.equal(updateUserCalls.length, 0);
    assert.ok(/did not recognize|try:/i.test(result.replyText));
  });
});

describe('processOnboarding — photos step', () => {
  beforeEach(() => {
    updateUserCalls = [];
    mockSocialAccounts = [{ platform: 'facebook' }]; // has connection
    updateUserReturnValue = makeUser('done', {
      business_name: 'Test Biz',
      onboarding_complete: true,
    });
  });

  test('DONE finalizes onboarding', async () => {
    const user = makeUser('photos', { business_name: 'Test Biz' });
    const result = await processOnboarding(user, 'DONE');
    assert.equal(result.done, true);
    assert.equal(updateUserCalls[0].updates.onboarding_step, 'done');
    assert.equal(updateUserCalls[0].updates.onboarding_complete, true);
    assert.ok(result.replyText.includes('Test Biz'));
  });

  test('SKIP also finalizes onboarding', async () => {
    const user = makeUser('photos', { business_name: 'Test Biz' });
    const result = await processOnboarding(user, 'SKIP');
    assert.equal(result.done, true);
  });

  test('completion mentions no-connection path when no social accounts', async () => {
    mockSocialAccounts = [];
    const user = makeUser('photos', { business_name: 'Test Biz' });
    const result = await processOnboarding(user, 'DONE');
    assert.equal(result.done, true);
    // No-connection variant calls out that they haven't connected yet
    assert.ok(/haven't connected|connect/i.test(result.replyText));
  });

  test('text other than DONE/SKIP nudges them to send photos', async () => {
    const user = makeUser('photos', { business_name: 'Test Biz' });
    const result = await processOnboarding(user, 'wait what');
    assert.equal(result.done, false);
    assert.equal(updateUserCalls.length, 0);
    assert.ok(/photo|done|skip/i.test(result.replyText));
  });
});

describe('processOnboarding — done step', () => {
  beforeEach(() => {
    updateUserCalls = [];
  });

  test('already done returns done=true without DB update', async () => {
    const user = makeUser('done', { onboarding_complete: true });
    const result = await processOnboarding(user, 'anything');
    assert.equal(result.done, true);
    assert.equal(updateUserCalls.length, 0);
    assert.ok(result.replyText.includes('already set up'));
  });
});

describe('processOnboarding — invalid/unknown step', () => {
  beforeEach(() => {
    updateUserCalls = [];
    updateUserReturnValue = makeUser('name');
  });

  test('unknown step resets to name and sends welcome', async () => {
    const user = makeUser('invalid_step');
    const result = await processOnboarding(user, 'anything');
    assert.equal(result.done, false);
    assert.equal(updateUserCalls[0].updates.onboarding_step, 'name');
    assert.ok(result.replyText.includes('Welcome'));
  });
});

describe('processOnboarding — default step (null)', () => {
  beforeEach(() => {
    updateUserCalls = [];
    updateUserReturnValue = makeUser('type', { business_name: 'My Biz' });
  });

  test('null onboarding_step defaults to name step', async () => {
    const user = { ...makeUser('name'), onboarding_step: null };
    // step defaults to 'name' via || 'name'
    const result = await processOnboarding(user, 'My Biz');
    assert.equal(result.done, false);
  });
});
