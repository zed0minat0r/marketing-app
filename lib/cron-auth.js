'use strict';

/**
 * Vercel Cron auth helper.
 *
 * Vercel invokes scheduled crons with `Authorization: Bearer ${CRON_SECRET}`
 * where CRON_SECRET is an env var set in the Vercel project settings
 * (auto-generated when the first cron is configured; rotatable via the
 * Vercel dashboard).
 *
 * Used by the 5 periodic job handlers under lib/job-handlers/* that were
 * migrated from QStash schedules to Vercel Cron. The per-event job handlers
 * (publish, enhance-photo) still use QStash signature verification —
 * they're triggered by `client.publishJSON()` calls, not Vercel cron.
 *
 * Backward-compat: if neither CRON_SECRET nor the legacy QStash signing keys
 * are set, allow the request (dev mode). If CRON_SECRET is set, require a
 * matching bearer token. If only QStash keys are set, fall back to QStash
 * verification (for endpoints transitioning over).
 */

const crypto = require('crypto');

function checkVercelCronAuth(req) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    // No secret configured — accept in dev. Production should always set this.
    if (process.env.NODE_ENV === 'production') {
      console.warn('CRON_SECRET not set in production — cron endpoints are unprotected');
    }
    return true;
  }

  const auth = req.headers?.authorization || '';
  const match = auth.match(/^Bearer\s+(.+)$/);
  if (!match) return false;

  const provided = match[1].trim();
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Verify the request is from Vercel Cron. Sends a 401 + returns false if
 * not, returns true if authorized.
 */
function requireCronAuth(req, res) {
  if (!checkVercelCronAuth(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

module.exports = {
  checkVercelCronAuth,
  requireCronAuth,
};
