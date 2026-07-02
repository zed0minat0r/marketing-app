'use strict';

const { INTENTS } = require('./constants');

/**
 * Fast intent pre-classifier using regex/keyword matching.
 * This runs BEFORE calling Claude to handle simple cases cheaply
 * and to help Claude with context about what type of message this is.
 *
 * Claude ultimately classifies intent in its JSON response — this is
 * a lightweight first pass used for routing decisions (e.g., is this
 * a YES/EDIT/SKIP response to a pending draft?).
 */

const PATTERNS = {
  // Approval/rejection of pending post
  approve: /^(yes|yep|yeah|post it|do it|go ahead|approved?|confirm|send it)\s*[.!]*$/i,
  skip: /^(no|nope|skip|cancel|don't post|do not post|never ?mind|forget it)\s*[.!]*$/i,
  edit: /^(edit|change|update|modify|revise|fix|different|make it)\b/i,

  // Post creation
  post: /\b(write|create|draft|make|generate|post|caption)\b.*\b(post|caption|tweet|content|update|message)\b/i,
  post_short: /^(post|write|caption|draft)\b/i,

  // Scheduling
  schedule: /\b(schedule|plan|queue|set\s+up|book)\b/i,
  schedule_time: /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|next\s+week|at\s+\d|pm|am|tonight|morning|afternoon)\b/i,

  // Analytics
  analytics: /\b(stats?|analytics?|metrics?|how\s+did|performance|insights?|reach|engagement|likes?|views?|impressions?|report|summary)\b/i,

  // Connect social
  connect: /\b(connect|link|attach|add|integrate)\b.*\b(instagram|facebook|twitter|x\b|social|account)\b/i,
  connect_simple: /\b(instagram|facebook|twitter)\b.*\b(connect|link|add)\b/i,

  // Help
  help: /^(help|commands?|what\s+can\s+you|how\s+do|instructions?|guide|\?)\b/i,

  // Schedule listing
  list_schedule: /\b(what.*(scheduled?|coming\s+up|planned|queued)|show.*schedule|upcoming\s+posts?|my\s+posts?|schedule\s+list)\b/i,

  // Cancel scheduled post
  cancel_post: /^cancel\s+(\d+|post|scheduled)\b/i,

  // Data deletion (GDPR/CCPA)
  delete_data: /^delete\s+(my\s+)?data\s*$/i,

  // Referral link requests
  referral: /\b(referral|refer|my\s+link|share\s+link|invite\s+link|referral\s+link|my\s+referral|invite\s+someone|share\s+sidekick)\b/i,

  // ── Post-onboarding customization commands ──
  // Name the assistant: "call yourself Max", "name the assistant Ava", "your name is Max", "rename yourself Max"
  set_name: /^(?:(?:call|name|rename)\s+(?:yourself|you|the\s+assistant|my\s+assistant|the\s+bot|the\s+ai)|(?:your|the\s+assistant'?s?)\s+name\s+is)\b/i,
  // Set free-text voice: "voice: cheeky and fun", "set my voice to ...", "change my voice ...", "write more like ..."
  set_voice: /^(?:voice\b|(?:set|change|update)\s+(?:my\s+)?voice\b|write\s+(?:more\s+)?like\b|sound\s+more\b)/i,
  // Change preset tone: "tone bold", "change my tone to friendly", "make my tone casual"
  set_tone: /^(?:tone\b|(?:set|change|make|update)\s+(?:my\s+)?tone\b)/i,
};

/**
 * Pre-classify intent from raw message text.
 * Returns the best-guess intent or null if unclear.
 * Claude will make the final determination.
 *
 * @param {string} text - Raw SMS message body
 * @returns {string|null} Intent string or null
 */
function classifyIntent(text) {
  const trimmed = (text || '').trim();

  if (PATTERNS.delete_data.test(trimmed)) return INTENTS.DELETE_DATA;
  if (PATTERNS.referral.test(trimmed)) return INTENTS.REFERRAL;
  if (PATTERNS.approve.test(trimmed)) return INTENTS.APPROVE;
  if (PATTERNS.skip.test(trimmed)) return INTENTS.SKIP;
  if (PATTERNS.cancel_post.test(trimmed)) return INTENTS.CANCEL;
  // Customization commands — checked before `edit` because "change my tone/voice"
  // would otherwise match the edit pattern's leading `^change`.
  if (PATTERNS.set_name.test(trimmed)) return INTENTS.SET_NAME;
  if (PATTERNS.set_voice.test(trimmed)) return INTENTS.SET_VOICE;
  if (PATTERNS.set_tone.test(trimmed)) return INTENTS.SET_TONE;
  if (PATTERNS.edit.test(trimmed)) return INTENTS.EDIT;
  // Check analytics BEFORE list_schedule so "how did my post do" routes to
  // analytics (the list_schedule regex has a permissive `my\s+posts?` branch
  // that would otherwise win and burn an analytics question to the schedule
  // listing).
  if (PATTERNS.analytics.test(trimmed)) return INTENTS.ANALYTICS;
  if (PATTERNS.list_schedule.test(trimmed)) return INTENTS.LIST_SCHEDULE;
  if (PATTERNS.help.test(trimmed)) return INTENTS.HELP;
  if (PATTERNS.connect.test(trimmed) || PATTERNS.connect_simple.test(trimmed)) return INTENTS.CONNECT;

  // Post with schedule time = schedule intent
  if ((PATTERNS.post.test(trimmed) || PATTERNS.post_short.test(trimmed)) &&
      PATTERNS.schedule_time.test(trimmed)) {
    return INTENTS.SCHEDULE;
  }

  if (PATTERNS.schedule.test(trimmed)) return INTENTS.SCHEDULE;
  if (PATTERNS.post.test(trimmed) || PATTERNS.post_short.test(trimmed)) return INTENTS.POST;

  return INTENTS.UNKNOWN;
}

/**
 * Check if a message looks like a response to a pending draft
 * (YES/EDIT/SKIP/LATER).
 *
 * @param {string} text
 * @returns {string|null} 'approve'|'edit'|'skip'|'schedule'|null
 */
function getDraftResponse(text) {
  const trimmed = (text || '').trim();

  if (PATTERNS.approve.test(trimmed)) return 'approve';
  if (PATTERNS.skip.test(trimmed)) return 'skip';
  if (/^later\b/i.test(trimmed)) return 'schedule';
  if (PATTERNS.edit.test(trimmed)) return 'edit';

  return null;
}

/**
 * Parse a CANCEL command like "CANCEL 1" or "CANCEL 2".
 * Returns the 1-based index of the post to cancel, or null.
 */
function parseCancelCommand(text) {
  const match = (text || '').trim().match(/^cancel\s+(\d+)\b/i);
  if (match) return parseInt(match[1], 10);
  return null;
}

/**
 * Parse an EDIT command like "EDIT 2 make it shorter".
 * Returns { index, instruction } or null.
 */
function parseEditCommand(text) {
  const match = (text || '').trim().match(/^edit\s+(\d+)\s+(.+)$/i);
  if (match) {
    return {
      index: parseInt(match[1], 10),
      instruction: match[2].trim(),
    };
  }
  return null;
}

/**
 * Extract the value from a customization command by stripping the leading
 * command phrase (and any connective "to"/"is"/":"). Returns the trimmed
 * remainder with surrounding quotes removed, or '' if nothing was supplied.
 */
function stripCommandPrefix(text, prefixPattern) {
  const remainder = (text || '').trim().replace(prefixPattern, '').trim();
  // Drop a leading connective and surrounding quotes.
  return remainder
    .replace(/^(?:to|is|:|=|as)\s+/i, '')
    .replace(/^["'“”‘’]+|["'“”‘’.!]+$/g, '')
    .trim();
}

/** Parse "call yourself Max" / "your name is Ava" → "Max" / "Ava" (or ''). */
function parseNameCommand(text) {
  return stripCommandPrefix(
    text,
    /^(?:(?:call|name|rename)\s+(?:yourself|you|the\s+assistant|my\s+assistant|the\s+bot|the\s+ai)|(?:your|the\s+assistant'?s?)\s+name\s+is)/i,
  );
}

/** Parse "voice: cheeky, emoji-heavy" / "set my voice to ..." → the description (or ''). */
function parseVoiceCommand(text) {
  return stripCommandPrefix(
    text,
    /^(?:voice|(?:set|change|update)\s+(?:my\s+)?voice|write\s+(?:more\s+)?like|sound\s+more)/i,
  );
}

/** Parse "tone bold" / "change my tone to friendly" → the tone phrase (or ''). */
function parseToneCommand(text) {
  return stripCommandPrefix(
    text,
    /^(?:tone|(?:set|change|make|update)\s+(?:my\s+)?tone)/i,
  );
}

module.exports = {
  classifyIntent,
  getDraftResponse,
  parseCancelCommand,
  parseEditCommand,
  parseNameCommand,
  parseVoiceCommand,
  parseToneCommand,
};
