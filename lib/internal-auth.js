'use strict';

/**
 * Authentication middleware for internal-only API endpoints.
 * Requires the INTERNAL_API_SECRET env var to match the
 * x-internal-secret header on every request.
 *
 * Usage:
 *   const { requireInternalAuth } = require('../../lib/internal-auth');
 *   module.exports = async function handler(req, res) {
 *     if (!requireInternalAuth(req, res)) return;
 *     // ... rest of handler
 *   };
 */

/**
 * Validate the INTERNAL_API_SECRET header.
 * Returns true if authenticated, false + sends 401/403 if not.
 *
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @returns {boolean}
 */
function requireInternalAuth(req, res) {
  const secret = process.env.INTERNAL_API_SECRET;

  if (!secret) {
    // Not configured — warn but allow in dev to avoid breaking deploys
    console.warn('INTERNAL_API_SECRET not set — internal endpoint is unprotected');
    return true;
  }

  const provided = req.headers['x-internal-secret'];

  if (!provided) {
    res.status(401).json({ error: 'x-internal-secret header is required' });
    return false;
  }

  // Constant-time comparison to prevent timing attacks
  const crypto = require('crypto');
  const secretBuf = Buffer.from(secret);
  const providedBuf = Buffer.from(provided);

  if (
    secretBuf.length !== providedBuf.length ||
    !crypto.timingSafeEqual(secretBuf, providedBuf)
  ) {
    res.status(403).json({ error: 'Forbidden' });
    return false;
  }

  return true;
}

module.exports = { requireInternalAuth };
