'use strict';

/**
 * GET /api/admin/config-check
 *
 * Reports which production env vars are set. Returns a per-key "set/missing"
 * map — never the actual values. Helps Matt spot misconfiguration without
 * leaking secrets.
 *
 * Auth: same Bearer-password as /api/admin/photos.
 */

const { checkAdminAuth } = require('../../lib/admin-auth');

const REQUIRED_KEYS = [
  // Core
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_ANON_KEY',
  'ANTHROPIC_API_KEY',
  'APP_URL',
  'ENCRYPTION_KEY',
  'INTERNAL_API_SECRET',
  'ADMIN_PASSWORD_HASH',
  // Twilio
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_PHONE_NUMBER',
  // QStash/Redis
  'QSTASH_TOKEN',
  'QSTASH_CURRENT_SIGNING_KEY',
  'QSTASH_NEXT_SIGNING_KEY',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  // Social OAuth
  'META_APP_ID',
  'META_APP_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  // Photo intake / enhancement
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_ENDPOINT_URL',
  'R2_PUBLIC_BASE_URL',
  'REPLICATE_API_TOKEN',
];

const OPTIONAL_KEYS = [
  'TWITTER_CLIENT_ID',
  'TWITTER_CLIENT_SECRET',
  'LINKEDIN_CLIENT_ID',
  'LINKEDIN_CLIENT_SECRET',
  'PINTEREST_CLIENT_ID',
  'PINTEREST_CLIENT_SECRET',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_STARTER',
  'STRIPE_PRICE_GROWTH',
  'STRIPE_PRICE_PRO',
  'EMAIL_PROVIDER',
  'EMAIL_FROM',
  'RESEND_API_KEY',
  'SENDGRID_API_KEY',
  'REPLICATE_ENHANCE_MODEL',
];

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  // requireConfig:false — this endpoint can run unauthed when
  // ADMIN_PASSWORD_HASH isn't set yet (its whole purpose is to flag that).
  if (!checkAdminAuth(req, res, { requireConfig: false })) return;

  const required = {};
  const optional = {};

  for (const key of REQUIRED_KEYS) {
    required[key] = Boolean(process.env[key] && process.env[key].length > 0);
  }
  for (const key of OPTIONAL_KEYS) {
    optional[key] = Boolean(process.env[key] && process.env[key].length > 0);
  }

  const missing = Object.entries(required).filter(([, v]) => !v).map(([k]) => k);

  return res.status(200).json({
    summary: {
      required_total: REQUIRED_KEYS.length,
      required_set: REQUIRED_KEYS.length - missing.length,
      missing_required: missing,
      admin_auth_enabled: Boolean(process.env.ADMIN_PASSWORD_HASH),
    },
    required,
    optional,
    notes: [
      'This endpoint never returns env values — only whether they are set.',
      'Missing required keys mean parts of the app will degrade gracefully (e.g. R2 missing = MMS photos cannot be saved).',
    ],
  });
};
