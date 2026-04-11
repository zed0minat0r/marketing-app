'use strict';

/**
 * Catch-all jobs router — api/jobs/[action].js
 *
 * Routes:
 *   POST /api/jobs/publish               -> publish handler
 *   POST /api/jobs/collect-analytics     -> collect-analytics handler
 *   POST /api/jobs/weekly-summary        -> weekly-summary handler
 *   POST /api/jobs/refresh-tokens        -> refresh-tokens handler
 *   POST /api/jobs/reset-generations     -> reset-generations handler
 *   POST /api/jobs/cleanup-conversations -> cleanup-conversations handler
 *
 * req.query.action is the last path segment after /api/jobs/.
 */

const handlers = {
  'publish':               require('../../lib/job-handlers/publish'),
  'collect-analytics':     require('../../lib/job-handlers/collect-analytics'),
  'weekly-summary':        require('../../lib/job-handlers/weekly-summary'),
  'refresh-tokens':        require('../../lib/job-handlers/refresh-tokens'),
  'reset-generations':     require('../../lib/job-handlers/reset-generations'),
  'cleanup-conversations': require('../../lib/job-handlers/cleanup-conversations'),
};

module.exports = async function handler(req, res) {
  const action = req.query.action;

  const routeHandler = handlers[action];
  if (!routeHandler) {
    return res.status(404).json({ error: `Unknown job action: ${action}` });
  }

  return routeHandler(req, res);
};
