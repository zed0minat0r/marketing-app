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
  'dispatch':              require('../../lib/job-handlers/dispatch'),
  'sweep-reviews':         require('../../lib/job-handlers/sweep-reviews'),
  'collect-analytics':     require('../../lib/job-handlers/collect-analytics'),
  'weekly-summary':        require('../../lib/job-handlers/weekly-summary'),
  'refresh-tokens':        require('../../lib/job-handlers/refresh-tokens'),
  'reset-generations':     require('../../lib/job-handlers/reset-generations'),
  'cleanup-conversations': require('../../lib/job-handlers/cleanup-conversations'),
  'enhance-photo':         require('../../lib/job-handlers/enhance-photo'),
  'health-check':          require('../../lib/job-handlers/health-check'),
};

/**
 * QStash signs the RAW request bytes. Vercel's default body parsing consumes
 * them, so signature checks on a re-serialized body can fail on any byte
 * difference. bodyParser is disabled for this route; we read the raw stream
 * once here and hand every handler both req.rawBody and a parsed req.body.
 */
async function readRawBody(req) {
  if (req.body instanceof Buffer) return req.body;
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

module.exports = async function handler(req, res) {
  const action = req.query.action;

  const routeHandler = Object.hasOwn(handlers, action) ? handlers[action] : null;
  if (!routeHandler) {
    return res.status(404).json({ error: `Unknown job action: ${action}` });
  }

  try {
    const raw = await readRawBody(req);
    req.rawBody = raw;
    if (!req.body || req.body instanceof Buffer) {
      req.body = raw.length ? JSON.parse(raw.toString('utf8')) : {};
    }
  } catch {
    req.rawBody = req.rawBody || Buffer.alloc(0);
    req.body = req.body && !(req.body instanceof Buffer) ? req.body : {};
  }

  try {
    return await routeHandler(req, res);
  } catch (err) {
    const { reportError } = require('../../lib/monitor');
    await reportError(`job:${action}`, err, { critical: action === 'publish' }).catch(() => {});
    // 500 lets QStash retry the delivery.
    if (!res.headersSent) return res.status(500).json({ error: 'Job failed' });
  }
};

module.exports.config = { api: { bodyParser: false } };
