'use strict';

/**
 * Intent-routing corpus - realistic owner texts fired at the REAL classifier.
 * Catches messages that would land in the wrong feature mid-conversation.
 * "claude" means: no command matched; the AI assistant handles it (correct
 * for open-ended asks, wrong for advertised command phrasings).
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { classifyIntent } = require('../lib/intent');
const { INTENTS } = require('../lib/constants');

const CASES = [
  // Advertised commands, as a real owner would type them
  ['audit mysite.com', INTENTS.WEBSITE_AUDIT],
  ['Audit my website', INTENTS.WEBSITE_AUDIT],
  ['audit', INTENTS.WEBSITE_AUDIT],
  ['check my site', INTENTS.WEBSITE_AUDIT],
  ['check reviews', INTENTS.CHECK_REVIEWS],
  ['any new reviews?', INTENTS.CHECK_REVIEWS],
  ['reviews', INTENTS.CHECK_REVIEWS],
  ['LIST', INTENTS.LIST_SCHEDULE],
  ['what do i have coming up', INTENTS.LIST_SCHEDULE],
  ['show my schedule', INTENTS.LIST_SCHEDULE],
  ['cancel 2', INTENTS.CANCEL],
  ['cancel post', INTENTS.CANCEL],
  ['CANCEL 1', INTENTS.CANCEL],
  ['settings', INTENTS.SHOW_SETTINGS],
  ['delete my data', INTENTS.DELETE_DATA],
  ['referral link', INTENTS.REFERRAL],

  // Customization commands
  ['call yourself Max', INTENTS.SET_NAME],
  ['tone bold', INTENTS.SET_TONE],
  ['emoji none', INTENTS.SET_EMOJI],

  // Draft responses
  ['YES', INTENTS.APPROVE],
  ['yes!', INTENTS.APPROVE],
  ['SKIP', INTENTS.SKIP],

  // Open-ended asks that MUST reach the AI, not a command
  ['write a post about our weekend special', 'claude'],
  ['can you make a facebook post about the new menu', 'claude'],
  ['post about our great reviews from customers', 'claude'],
  ['schedule something for friday', 'claude'],
  ['what should I post this week?', 'claude'],
  ['review my competitors', 'claude'],
  ['my website is mysite.com by the way', 'claude'],
  ['we got a new pizza oven!', 'claude'],
  ['make a post: 50% off audits this week', 'claude'],
];

// Intents the router treats as "let the AI handle it"
const AI_HANDLED = new Set([INTENTS.UNKNOWN, INTENTS.POST, INTENTS.SCHEDULE, INTENTS.EDIT, INTENTS.HELP, INTENTS.ANALYTICS, INTENTS.CONNECT]);

describe('intent corpus - realistic owner texts route correctly', () => {
  for (const [msg, expected] of CASES) {
    test(JSON.stringify(msg), () => {
      const got = classifyIntent(msg);
      if (expected === 'claude') {
        assert.ok(
          AI_HANDLED.has(got) || got === INTENTS.POST,
          `"${msg}" should reach the AI/open path, got: ${got}`
        );
      } else {
        assert.equal(got, expected, `"${msg}" misrouted to: ${got}`);
      }
    });
  }
});
