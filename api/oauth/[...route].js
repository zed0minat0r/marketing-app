'use strict';

/**
 * Catch-all OAuth router — api/oauth/[...route].js
 *
 * Routes:
 *   GET /api/oauth/meta/start        -> meta-start handler
 *   GET /api/oauth/meta/callback     -> meta-callback handler
 *   GET /api/oauth/twitter/start     -> twitter-start handler
 *   GET /api/oauth/twitter/callback  -> twitter-callback handler
 *   GET /api/oauth/linkedin/start    -> linkedin-start handler
 *   GET /api/oauth/linkedin/callback -> linkedin-callback handler
 *   GET /api/oauth/pinterest/start   -> pinterest-start handler
 *   GET /api/oauth/pinterest/callback-> pinterest-callback handler
 *   GET /api/oauth/google/start      -> google-start handler
 *   GET /api/oauth/google/callback   -> google-callback handler
 *
 * req.query.route is an array of path segments after /api/oauth/,
 * e.g. ['meta', 'start'] or ['twitter', 'callback'].
 */

const handlers = {
  'meta/start':       require('../../lib/oauth-handlers/meta-start'),
  'meta/callback':    require('../../lib/oauth-handlers/meta-callback'),
  'twitter/start':    require('../../lib/oauth-handlers/twitter-start'),
  'twitter/callback': require('../../lib/oauth-handlers/twitter-callback'),
  'linkedin/start':   require('../../lib/oauth-handlers/linkedin-start'),
  'linkedin/callback':require('../../lib/oauth-handlers/linkedin-callback'),
  'pinterest/start':  require('../../lib/oauth-handlers/pinterest-start'),
  'pinterest/callback':require('../../lib/oauth-handlers/pinterest-callback'),
  'google/start':     require('../../lib/oauth-handlers/google-start'),
  'google/callback':  require('../../lib/oauth-handlers/google-callback'),
};

module.exports = async function handler(req, res) {
  const segments = Array.isArray(req.query.route) ? req.query.route : [req.query.route];
  const key = segments.join('/');

  const routeHandler = handlers[key];
  if (!routeHandler) {
    return res.status(404).json({ error: `Unknown OAuth route: ${key}` });
  }

  return routeHandler(req, res);
};
