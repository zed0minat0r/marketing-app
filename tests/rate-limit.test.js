'use strict';

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// Ensure no Redis env vars so we always hit the in-memory fallback
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

// We need a fresh memoryStore for each test group since it is module-level state.
// Load fresh module each time using cache busting.
function loadRateLimit() {
  const resolved = require.resolve('../lib/rate-limit');
  delete require.cache[resolved];
  return require('../lib/rate-limit');
}

describe('in-memory fallback — allows within limit', () => {
  test('first request is allowed', async () => {
    const { checkRateLimit } = loadRateLimit();
    const result = await checkRateLimit('test:allow-1', 5, 60000);
    assert.equal(result.allowed, true);
    assert.equal(result.count, 1);
    assert.equal(result.remaining, 4);
  });

  test('requests up to limit are all allowed', async () => {
    const { checkRateLimit } = loadRateLimit();
    const key = 'test:allow-up-to-limit';
    for (let i = 1; i <= 3; i++) {
      const r = await checkRateLimit(key, 3, 60000);
      assert.equal(r.allowed, true, `Request ${i} should be allowed`);
    }
  });

  test('remaining decrements correctly', async () => {
    const { checkRateLimit } = loadRateLimit();
    const key = 'test:remaining-decrement';
    const r1 = await checkRateLimit(key, 5, 60000);
    assert.equal(r1.remaining, 4);
    const r2 = await checkRateLimit(key, 5, 60000);
    assert.equal(r2.remaining, 3);
    const r3 = await checkRateLimit(key, 5, 60000);
    assert.equal(r3.remaining, 2);
  });

  test('count increments correctly', async () => {
    const { checkRateLimit } = loadRateLimit();
    const key = 'test:count-increment';
    const r1 = await checkRateLimit(key, 10, 60000);
    assert.equal(r1.count, 1);
    const r2 = await checkRateLimit(key, 10, 60000);
    assert.equal(r2.count, 2);
    const r3 = await checkRateLimit(key, 10, 60000);
    assert.equal(r3.count, 3);
  });
});

describe('in-memory fallback — blocks over limit', () => {
  test('request exceeding limit is blocked', async () => {
    const { checkRateLimit } = loadRateLimit();
    const key = 'test:block-over-limit';
    // Use up the limit
    await checkRateLimit(key, 2, 60000);
    await checkRateLimit(key, 2, 60000);
    // 3rd request should be blocked
    const r = await checkRateLimit(key, 2, 60000);
    assert.equal(r.allowed, false);
    assert.equal(r.remaining, 0);
  });

  test('remaining never goes below 0 when over limit', async () => {
    const { checkRateLimit } = loadRateLimit();
    const key = 'test:remaining-floor';
    await checkRateLimit(key, 1, 60000);
    await checkRateLimit(key, 1, 60000);
    const r = await checkRateLimit(key, 1, 60000);
    assert.equal(r.remaining, 0);
  });

  test('limit of 1 blocks second request', async () => {
    const { checkRateLimit } = loadRateLimit();
    const key = 'test:limit-1';
    const r1 = await checkRateLimit(key, 1, 60000);
    assert.equal(r1.allowed, true);
    const r2 = await checkRateLimit(key, 1, 60000);
    assert.equal(r2.allowed, false);
  });
});

describe('in-memory fallback — window expiry', () => {
  test('requests after window reset are allowed again', async () => {
    const { checkRateLimit } = loadRateLimit();
    const key = 'test:window-expiry';
    // Use up limit with a 10ms window
    const r1 = await checkRateLimit(key, 1, 10);
    assert.equal(r1.allowed, true);
    const r2 = await checkRateLimit(key, 1, 10);
    assert.equal(r2.allowed, false);

    // Wait for window to expire
    await new Promise(resolve => setTimeout(resolve, 20));

    // Should be allowed again after window reset
    const r3 = await checkRateLimit(key, 1, 10);
    assert.equal(r3.allowed, true);
    assert.equal(r3.count, 1);
  });

  test('window reset resets count back to 1', async () => {
    const { checkRateLimit } = loadRateLimit();
    const key = 'test:window-count-reset';
    await checkRateLimit(key, 5, 10);
    await checkRateLimit(key, 5, 10);
    await checkRateLimit(key, 5, 10);

    await new Promise(resolve => setTimeout(resolve, 20));

    const r = await checkRateLimit(key, 5, 10);
    assert.equal(r.count, 1);
    assert.equal(r.remaining, 4);
  });
});

describe('in-memory fallback — isolation between keys', () => {
  test('different keys do not interfere', async () => {
    const { checkRateLimit } = loadRateLimit();
    const key1 = 'test:key1';
    const key2 = 'test:key2';

    // Exhaust key1
    await checkRateLimit(key1, 1, 60000);
    const r1 = await checkRateLimit(key1, 1, 60000);
    assert.equal(r1.allowed, false);

    // key2 should still be allowed
    const r2 = await checkRateLimit(key2, 1, 60000);
    assert.equal(r2.allowed, true);
  });
});

describe('rateLimitMiddleware', () => {
  test('sets rate limit headers', async () => {
    const { rateLimitMiddleware } = loadRateLimit();
    const mw = rateLimitMiddleware('mw-test-key', 10, 60000);

    const headers = {};
    const req = {};
    const res = {
      setHeader: (k, v) => { headers[k] = v; },
      status: () => res,
      json: () => {},
    };

    await mw(req, res, () => {});

    assert.equal(headers['X-RateLimit-Limit'], 10);
    assert.ok('X-RateLimit-Remaining' in headers);
  });

  test('calls next() when within limit', async () => {
    const { rateLimitMiddleware } = loadRateLimit();
    const mw = rateLimitMiddleware('mw-next-key', 10, 60000);

    let nextCalled = false;
    const res = {
      setHeader: () => {},
      status: () => res,
      json: () => {},
    };

    const result = await mw({}, res, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
    assert.equal(result, true);
  });

  test('returns 429 and does not call next when over limit', async () => {
    const { rateLimitMiddleware } = loadRateLimit();
    const key = 'mw-block-key';
    const mw = rateLimitMiddleware(key, 1, 60000);

    let status429 = false;
    let nextCalled = false;
    const res = {
      setHeader: () => {},
      status: (code) => {
        if (code === 429) status429 = true;
        return res;
      },
      json: () => {},
    };

    // First call uses up the limit
    await mw({}, res, () => {});
    // Second call should block
    const result = await mw({}, res, () => { nextCalled = true; });

    assert.equal(status429, true);
    assert.equal(nextCalled, false);
    assert.equal(result, false);
  });

  test('keyFn receives req object', async () => {
    const { rateLimitMiddleware } = loadRateLimit();
    let capturedReq = null;
    const mw = rateLimitMiddleware((req) => {
      capturedReq = req;
      return 'dynamic-key';
    }, 10, 60000);

    const fakeReq = { body: { From: '+15551234567' } };
    const res = { setHeader: () => {}, status: () => res, json: () => {} };

    await mw(fakeReq, res, () => {});
    assert.equal(capturedReq, fakeReq);
  });
});
