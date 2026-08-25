'use strict';

/**
 * Catch-all admin router — api/admin/[action].js
 *
 * Consolidates the four admin endpoints into one serverless function
 * (Vercel Hobby caps a deployment at 12 functions):
 *   GET  /api/admin/snapshot     -> snapshot handler
 *   GET  /api/admin/photos       -> photos handler
 *   POST /api/admin/photo-delete -> photo-delete handler
 *   GET  /api/admin/config-check -> config-check handler
 *
 * URLs are unchanged from when each was its own function. Every handler
 * does its own method + admin-auth checks.
 */

const handlers = {
  'snapshot':     require('../../lib/admin-handlers/snapshot'),
  'photos':       require('../../lib/admin-handlers/photos'),
  'photo-delete': require('../../lib/admin-handlers/photo-delete'),
  'config-check': require('../../lib/admin-handlers/config-check'),
};

module.exports = async function handler(req, res) {
  const action = req.query.action;
  const routeHandler = Object.hasOwn(handlers, action) ? handlers[action] : null;
  if (!routeHandler) {
    return res.status(404).json({ error: `Unknown admin action: ${action}` });
  }
  return routeHandler(req, res);
};
