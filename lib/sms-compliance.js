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
 *   - STOP-family words that are unambiguous opt-outs (STOP, STOPALL,
 *     UNSUBSCRIBE, UNSUB, OPTOUT, OPT-OUT, QUIT) match as the FIRST WORD too
 *     ("STOP please", "stop texting me") — CTIA and Twilio's toll-free
 *     screening both treat these as opt-outs, and dropping them is a
 *     carrier-complaint vector.
 *   - CANCEL and END stay bare-only: "CANCEL 1" is our scheduled-post cancel
 *     command, and "end ..." starts too many ordinary sentences.
 *   - START/HELP families stay bare-only ("help me write a post" is a real
 *     product request, not a compliance query).
 *   - "YES" is ambiguous (we use it for draft approval). Return null so
 *     the regular flow handles it; users who want to re-subscribe can text
 *     "START" or "UNSTOP".
 */
const STOP_PREFIX_KEYWORDS = new Set([
  'STOP', 'STOPALL', 'UNSUBSCRIBE', 'UNSUB', 'OPTOUT', 'OPT-OUT', 'QUIT',
]);

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

  // First-word match for unambiguous opt-outs: "STOP please", "quit it".
  const firstWord = upper.split(/\s+/, 1)[0].replace(/[.!?,;:]+$/, '');
  if (STOP_PREFIX_KEYWORDS.has(firstWord)) return 'stop';

  return null;
}

/**
 * Static reply text for each compliance keyword. These are legally meaningful
 * — keep them short, on-brand, and ALWAYS include the required disclosures.
 */
const COMPLIANCE_REPLIES = {
  stop: "You're unsubscribed from Sidekick and won't receive more messages. Reply START to opt back in. Reply HELP for support.",

  start: "Welcome back to Sidekick! You'll start receiving messages again. Reply HELP for support, STOP to opt out. Msg & data rates may apply.",

  help: "Sidekick - AI marketing assistant for small businesses. Support: mmodica3@gmail.com. Reply STOP to opt out. Msg & data rates may apply.",
};

module.exports = {
  resolveComplianceAction,
  COMPLIANCE_REPLIES,
  STOP_KEYWORDS,
  START_KEYWORDS,
  HELP_KEYWORDS,
};
