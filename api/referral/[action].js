'use strict';

/**
 * Catch-all referral router — api/referral/[action].js
 *
 * Routes:
 *   POST /api/referral/generate -> generate handler
 *   GET  /api/referral/track    -> track handler
 *   POST /api/referral/convert  -> convert handler
 *
 * req.query.action is the last path segment after /api/referral/.
 */

const handlers = {
  'generate': require('../../lib/referral-handlers/generate'),
  'track':    require('../../lib/referral-handlers/track'),
  'convert':  require('../../lib/referral-handlers/convert'),
};

module.exports = async function handler(req, res) {
  const action = req.query.action;

  const routeHandler = handlers[action];
  if (!routeHandler) {
    return res.status(404).json({ error: `Unknown referral action: ${action}` });
  }

  return routeHandler(req, res);
};
