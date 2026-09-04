'use strict';

/**
 * OAuth router — api/oauth/router.js
 *
 * Reached through a rewrite in vercel.json:
 *   /api/oauth/:provider/:action  ->  /api/oauth/router?provider=:provider&action=:action
 *
 * WHY IT IS NOT A CATCH-ALL ANY MORE. This was `api/oauth/[...route].js`, and on this deployment it
 * did not work: /api/oauth/meta/callback returned VERCEL'S OWN "NOT_FOUND" page, meaning the request
 * never reached this file. Every customer connect flow ends at that callback, so nobody could link a
 * Facebook Page at all - it was not a permissions problem, the endpoint did not exist.
 *
 * Narrowed down by probing rather than guessing:
 *   /api/oauth/foo        (one segment)  -> reached this handler, but req.query.route was EMPTY
 *   /api/oauth/meta/start (two segments) -> Vercel NOT_FOUND, never arrived
 *   /api/admin/status                    -> its own [action].js handler answered fine
 * So single-segment dynamic routes work here and the `[...]` catch-all does not - it matched one
 * level and never populated the param. The project uses `"version": 2` with `"outputDirectory": "."`,
 * which is not the modern filesystem-routing setup catch-alls assume.
 *
 * The fix uses two things already proven to work in THIS project rather than a third guess: a plain
 * (non-bracket) function file, and a vercel.json rewrite - /admin, /connected and
 * /data-deletion-status are all served that way and all return 200 in production.
 *
 * The OAuth URLs are always exactly provider/action, so nothing needs a catch-all.
 */

const handlers = {
  'meta/start':         require('../../lib/oauth-handlers/meta-start'),
  'meta/callback':      require('../../lib/oauth-handlers/meta-callback'),
  'meta/data-deletion': require('../../lib/oauth-handlers/meta-data-deletion'),
  'twitter/start':      require('../../lib/oauth-handlers/twitter-start'),
  'twitter/callback':   require('../../lib/oauth-handlers/twitter-callback'),
  'linkedin/start':     require('../../lib/oauth-handlers/linkedin-start'),
  'linkedin/callback':  require('../../lib/oauth-handlers/linkedin-callback'),
  'pinterest/start':    require('../../lib/oauth-handlers/pinterest-start'),
  'pinterest/callback': require('../../lib/oauth-handlers/pinterest-callback'),
  'google/start':       require('../../lib/oauth-handlers/google-start'),
  'google/callback':    require('../../lib/oauth-handlers/google-callback'),
};

/** provider/action from the rewrite, falling back to the old `route` param so an in-flight
 *  redirect during deploy still lands somewhere sane rather than 404ing a customer mid-connect. */
function resolveKey(query) {
  const { provider, action, route } = query;
  if (provider && action) return `${provider}/${action}`;
  if (Array.isArray(route)) return route.join('/');
  if (typeof route === 'string' && route) return route;
  return '';
}

module.exports = async function handler(req, res) {
  const key = resolveKey(req.query || {});
  const routeHandler = handlers[key];

  if (!routeHandler) {
    return res.status(404).json({ error: `Unknown OAuth route: ${key}` });
  }

  return routeHandler(req, res);
};

module.exports.resolveKey = resolveKey;
