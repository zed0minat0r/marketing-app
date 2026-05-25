'use strict';

/**
 * OAuth-link-via-SMS helper.
 *
 * Each connect flow is browser-only (Facebook/Google/etc require OAuth in a
 * real browser), so we send the user a one-time URL via SMS that includes a
 * random token. The corresponding /api/oauth/<platform>/start handler
 * validates the token and redirects them to the provider's consent screen.
 *
 * This module:
 *   1. Generates a random token, inserts an `oauth_links` row tied to the user
 *      and platform
 *   2. Builds the appropriate SMS-friendly link to text back
 *
 * Used by both the onboarding state machine (step "connect") and the
 * `CONNECT` intent handler in the inbound SMS webhook.
 */

const crypto = require('crypto');
const { getClient } = require('./supabase');

const LINK_TTL_MS = 15 * 60 * 1000; // 15 minutes — long enough to switch apps and tap

// Maps user-friendly platform names → the platform key the OAuth handlers use.
// Both Facebook and Instagram use the "meta" handler (single Facebook OAuth
// grants pages_* + instagram_* scopes).
const PLATFORM_ALIASES = {
  facebook:  'meta',
  meta:      'meta',
  instagram: 'meta',
  ig:        'meta',
  fb:        'meta',
  google:    'google',
  gbp:       'google',
  'google business': 'google',
  'google business profile': 'google',
  linkedin:  'linkedin',
  li:        'linkedin',
  twitter:   'twitter',
  x:         'twitter',
  pinterest: 'pinterest',
  pin:       'pinterest',
  tiktok:    'tiktok',     // Note: handler may not exist yet; treat as not-yet-supported
};

const SUPPORTED_PLATFORMS = new Set(['meta', 'google', 'linkedin', 'twitter', 'pinterest']);

function normalizePlatform(input) {
  if (!input) return null;
  const key = input.toLowerCase().trim();
  return PLATFORM_ALIASES[key] || null;
}

/**
 * Friendly label for SMS copy.
 */
function platformLabel(platformKey, originalInput) {
  if (originalInput) {
    const lower = originalInput.toLowerCase().trim();
    if (lower === 'instagram' || lower === 'ig') return 'Instagram';
    if (lower === 'facebook' || lower === 'fb') return 'Facebook';
    if (lower === 'google' || lower.startsWith('google')) return 'Google Business';
    if (lower === 'linkedin' || lower === 'li') return 'LinkedIn';
    if (lower === 'twitter' || lower === 'x') return 'X';
    if (lower === 'pinterest' || lower === 'pin') return 'Pinterest';
    if (lower === 'tiktok') return 'TikTok';
  }
  switch (platformKey) {
    case 'meta':      return 'Facebook / Instagram';
    case 'google':    return 'Google Business';
    case 'linkedin':  return 'LinkedIn';
    case 'twitter':   return 'X';
    case 'pinterest': return 'Pinterest';
    default:          return platformKey;
  }
}

/**
 * Generate an OAuth start link for the user and persist the token.
 *
 * @param {Object} args
 * @param {string} args.userId
 * @param {string} args.platform   - platform key (post-normalization)
 * @returns {Promise<string>} the full SMS-ready URL
 */
async function createOAuthStartLink({ userId, platform }) {
  if (!SUPPORTED_PLATFORMS.has(platform)) {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  const token = crypto.randomBytes(20).toString('hex');
  const expiresAt = new Date(Date.now() + LINK_TTL_MS).toISOString();

  const { error } = await getClient()
    .from('oauth_links')
    .insert({
      user_id: userId,
      platform,
      token,
      expires_at: expiresAt,
    });

  if (error) throw error;

  const appUrl = (process.env.APP_URL || 'https://sidekik.com').replace(/\/$/, '');
  return `${appUrl}/api/oauth/${platform}/start?token=${token}`;
}

module.exports = {
  createOAuthStartLink,
  normalizePlatform,
  platformLabel,
  PLATFORM_ALIASES,
  SUPPORTED_PLATFORMS,
};
