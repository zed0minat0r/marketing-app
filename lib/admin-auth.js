'use strict';

/**
 * Admin endpoint auth helper.
 *
 * Endpoints under /api/admin/* validate `Authorization: Bearer <password>`.
 * The provided password is SHA-256 hashed and compared in constant time
 * against ADMIN_PASSWORD_HASH (set in Vercel).
 *
 * If ADMIN_PASSWORD_HASH is not set, the env-check endpoint is allowed to run
 * unauthenticated (so it can flag the missing key itself). All other admin
 * endpoints should treat a missing ADMIN_PASSWORD_HASH as misconfigured and
 * refuse — pass `{ requireConfig: true }` to enforce that.
 */

const crypto = require('crypto');

/**
 * Verify the Authorization header against ADMIN_PASSWORD_HASH.
 * Returns true if authorized, false (and sends a 4xx response) otherwise.
 *
 * @param {Object} req     - the request
 * @param {Object} res     - the response
 * @param {Object} [opts]
 * @param {boolean} [opts.requireConfig=true] - if true, returns 503 when
 *   ADMIN_PASSWORD_HASH env var is missing.
 */
function checkAdminAuth(req, res, opts = {}) {
  const requireConfig = opts.requireConfig !== false;
  const expectedHash = process.env.ADMIN_PASSWORD_HASH;

  if (!expectedHash) {
    if (requireConfig) {
      res.status(503).json({ error: 'ADMIN_PASSWORD_HASH not configured' });
      return false;
    }
    return true; // explicit opt-out (only the config-check endpoint should use this)
  }

  const match = (req.headers.authorization || '').match(/^Bearer\s+(.+)$/);
  if (!match) {
    res.status(401).json({ error: 'Authorization: Bearer <password> required' });
    return false;
  }

  const provided = match[1].trim();
  const providedHash = crypto.createHash('sha256').update(provided).digest('hex');

  const a = Buffer.from(providedHash);
  const b = Buffer.from(expectedHash);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    res.status(403).json({ error: 'Forbidden' });
    return false;
  }
  return true;
}

module.exports = { checkAdminAuth };
