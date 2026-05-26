'use strict';

/**
 * Per-user daily cost guardrails.
 *
 * Each cost-incurring operation (MMS intake, Replicate enhancement, Claude
 * vision tagging) is bucketed by user-id and the calendar UTC day. When a
 * user exceeds the daily cap for a given operation, the call is denied and
 * a clear reason is returned so the caller can degrade gracefully (skip
 * enhancement, queue a "you're capped" SMS, etc).
 *
 * Limits are defaults that can be overridden via env vars — sensible
 * starting values that catch runaway abuse without affecting normal usage:
 *
 *   MAX_MMS_PER_USER_PER_DAY        (default 50)
 *   MAX_TAGS_PER_USER_PER_DAY       (default 50)
 *   MAX_ENHANCEMENTS_PER_USER_PER_DAY  (default 50)
 *
 * Lift the limits later if real users hit them. For now the goal is to make
 * a single malicious or buggy client unable to ring up arbitrary cost.
 */

const { checkRateLimit } = require('./rate-limit');

const DAY_MS = 24 * 60 * 60 * 1000;

const DEFAULT_CAPS = {
  mms_intake: 50,
  vision_tag: 50,
  enhancement: 50,
};

function getCap(operation) {
  const envMap = {
    mms_intake:  'MAX_MMS_PER_USER_PER_DAY',
    vision_tag:  'MAX_TAGS_PER_USER_PER_DAY',
    enhancement: 'MAX_ENHANCEMENTS_PER_USER_PER_DAY',
  };
  const raw = process.env[envMap[operation]];
  if (raw) {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return DEFAULT_CAPS[operation];
}

function dailyKey(operation, userId) {
  // Bucket by UTC day so the key naturally rolls over at midnight UTC.
  const day = new Date().toISOString().slice(0, 10);
  return `cost:${operation}:${userId}:${day}`;
}

/**
 * Check if a user can perform a cost-incurring operation today.
 * Increments the counter as a side-effect — call this exactly once per
 * attempted operation (before the actual API call).
 *
 * @param {string} operation - 'mms_intake' | 'vision_tag' | 'enhancement'
 * @param {string} userId
 * @returns {Promise<{allowed:boolean, remaining:number, cap:number, operation:string}>}
 */
async function checkDailyCap(operation, userId) {
  if (!DEFAULT_CAPS[operation]) {
    throw new Error(`Unknown cost operation: ${operation}`);
  }
  const cap = getCap(operation);
  const key = dailyKey(operation, userId);
  const { allowed, remaining } = await checkRateLimit(key, cap, DAY_MS);
  return { allowed, remaining, cap, operation };
}

module.exports = {
  checkDailyCap,
  getCap,
  DEFAULT_CAPS,
};
