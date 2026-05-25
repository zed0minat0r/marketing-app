'use strict';

/**
 * GET /api/admin/photos
 *
 * Service-role-backed photo list for the admin dashboard. Bypasses RLS
 * (anon key + service-role-only policies = anon sees nothing), so the dashboard
 * can actually display data in production.
 *
 * Auth: `Authorization: Bearer <admin-password>`. The password is hashed
 * (SHA-256) and compared in constant time against ADMIN_PASSWORD_HASH.
 *
 * Query params:
 *   limit                Optional, defaults to 24, max 100
 *   include_archived     Optional, "1" to include archived photos
 */

const { getClient } = require('../../lib/supabase');
const { checkAdminAuth } = require('../../lib/admin-auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!checkAdminAuth(req, res)) return;

  const limit = Math.min(parseInt(req.query?.limit || '24', 10) || 24, 100);
  const includeArchived = req.query?.include_archived === '1';

  try {
    // Service-role client — bypasses RLS, returns photos across ALL users.
    let q = getClient()
      .from('customer_photos')
      .select('id,user_id,public_url,enhanced_url,enhancement_status,mime_type,caption,tags,tags_status,created_at,is_archived')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (!includeArchived) q = q.eq('is_archived', false);

    const { data, error } = await q;
    if (error) throw error;

    return res.status(200).json({ photos: data || [] });
  } catch (err) {
    console.error('admin/photos error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
};
