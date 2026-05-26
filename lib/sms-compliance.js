'use strict';

/**
 * SMS carrier compliance (CTIA + 10DLC + Twilio toll-free rules).
 *
 * Toll-free numbers (which Sidekick uses) do NOT auto-handle STOP/HELP at the
 * carrier level — we have to honor them ourselves. Texting STOP must opt the
 * user out of all future messages, and HELP must reply with brand + support
 * + cost info. Failing this is a carrier-disable-able offense.
 *
 * Spec references:
 *   - CTIA Short Code Monitoring Handbook §5.1 (applies analogously to TF)
 *   - Twilio: https://help.twilio.com/articles/360045006693
 */

const STOP_KEYWORDS = new Set([
  'STOP',
  'STOPALL',
  'UNSUBSCRIBE',
  'UNSUB',
  'CANCEL',
  'END',
  'QUIT',
  'OPTOUT',
  'OPT-OUT',
]);

const START_KEYWORDS = new Set([
  'START',
  'UNSTOP',
  'YES',          // CTIA listed but ambiguous in our app — see resolve() below
  'OPTIN',
  'OPT-IN',
]);

const HELP_KEYWORDS = new Set([
  'HELP',
  'INFO',
  'SUPPORT',
]);

/**
 * Resolve a message body to a carrier-compliance action, if any.
 *
 * Returns 'stop' | 'start' | 'help' | null.
 *
 * Rules:
 *   - Match only the BARE keyword (no extra args). "CANCEL 1" must NOT be
 *     treated as STOP — that's our scheduled-post cancel command.
 *   - Match only the FIRST word — "STOP it" is still STOP per CTIA but we
 *     intentionally take the strict view (bare word only) to avoid false
 *     positives. Twilio's TF screen does match prefix-only as well.
 *   - "YES" is ambiguous (we use it for draft approval). Return null so
 *     the regular flow handles it; users who want to re-subscribe can text
 *     "START" or "UNSTOP".
 */
function resolveComplianceAction(body) {
  if (!body) return null;
  const trimmed = body.trim();
  const upper = trimmed.toUpperCase();

  // Bare-keyword only (allow trailing punctuation).
  const bare = upper.replace(/[.!?,;:]+$/, '');

  if (bare === 'YES') return null; // ambiguous in our app

  if (STOP_KEYWORDS.has(bare))  return 'stop';
  if (START_KEYWORDS.has(bare)) return 'start';
  if (HELP_KEYWORDS.has(bare))  return 'help';

  return null;
}

/**
 * Static reply text for each compliance keyword. These are legally meaningful
 * — keep them short, on-brand, and ALWAYS include the required disclosures.
 */
const COMPLIANCE_REPLIES = {
  stop: "You're unsubscribed from Sidekick and won't receive more messages. Reply START to opt back in. Reply HELP for support.",

  start: "Welcome back to Sidekick! You'll start receiving messages again. Reply HELP for support, STOP to opt out. Msg & data rates may apply.",

  help: "Sidekick — AI marketing assistant for small businesses. Support: hello@sidekik.com. Reply STOP to opt out. Msg & data rates may apply.",
};

module.exports = {
  resolveComplianceAction,
  COMPLIANCE_REPLIES,
  STOP_KEYWORDS,
  START_KEYWORDS,
  HELP_KEYWORDS,
};
