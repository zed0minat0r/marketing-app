'use strict';

/**
 * Rate limiter using Upstash Redis (REST API).
 * Falls back to in-memory store when Redis is not configured (dev/test).
 *
 * Usage:
 *   const { checkRateLimit } = require('./rate-limit');
 *   const allowed = await checkRateLimit('sms:+14845551234', 1, 1000); // 1 per second
 */

// In-memory fallback store (resets on function cold start — not distributed)
const memoryStore = new Map();

async function redisIncr(key, windowMs) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null; // Redis not configured, use memory fallback
  }

  try {
    // Use Upstash Redis REST API pipeline
    const pipeline = [
      ['INCR', key],
      ['PEXPIRE', key, windowMs],
    ];

    const response = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(pipeline),
    });

    if (!response.ok) {
      throw new Error(`Redis error: ${response.status}`);
    }

    const results = await response.json();
    // results[0].result is the INCR result (current count)
    return results[0].result;
  } catch (err) {
    console.error('Rate limit Redis error:', err.message);
    return null; // Fall through to memory store
  }
}

function memoryIncr(key, windowMs) {
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || now > entry.resetAt) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return 1;
  }

  entry.count += 1;
  return entry.count;
}

/**
 * Check if a key is within the rate limit.
 * @param {string} key - Unique key (e.g., "sms:+14845551234")
 * @param {number} maxRequests - Max requests allowed in window
 * @param {number} windowMs - Window size in milliseconds
 * @returns {Promise<{allowed: boolean, remaining: number, resetAt: number}>}
 */
async function checkRateLimit(key, maxRequests, windowMs) {
  let count = await redisIncr(key, windowMs);

  if (count === null) {
    count = memoryIncr(key, windowMs);
  }

  const allowed = count <= maxRequests;
  const remaining = Math.max(0, maxRequests - count);

  return { allowed, remaining, count };
}

/**
 * Rate limit middleware factory for Vercel API routes.
 * Returns a function that checks rate limits and sends 429 if exceeded.
 */
function rateLimitMiddleware(keyFn, maxRequests, windowMs) {
  return async function (req, res, next) {
    const key = typeof keyFn === 'function' ? keyFn(req) : keyFn;
    const { allowed, remaining } = await checkRateLimit(key, maxRequests, windowMs);

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);

    if (!allowed) {
      res.status(429).json({ error: 'Too many requests. Please slow down.' });
      return false;
    }

    if (typeof next === 'function') next();
    return true;
  };
}

module.exports = { checkRateLimit, rateLimitMiddleware };
