'use strict';

/**
 * POST /api/admin/photo-delete?id=<uuid>
 *
 * Hard-delete a customer photo: removes the R2 objects (original + enhanced)
 * and the customer_photos row. Auth: Bearer admin password (see lib/admin-auth).
 *
 * Used by the admin dashboard "Delete" button on each photo card.
 */

const { getClient } = require('../../lib/supabase');
const { deleteObject } = require('../../lib/storage');
const { checkAdminAuth } = require('../../lib/admin-auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!checkAdminAuth(req, res)) return;

  const photoId = req.query?.id;
  if (!photoId) {
    return res.status(400).json({ error: 'id query param required' });
  }

  try {
    const supa = getClient();

    // Look up the photo first to get its R2 keys.
    const { data: photo, error: lookupErr } = await supa
      .from('customer_photos')
      .select('id,r2_key,enhanced_r2_key')
      .eq('id', photoId)
      .single();

    if (lookupErr || !photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    // Delete R2 objects best-effort. If R2 isn't configured, log + continue
    // so we still purge the DB row.
    const r2Errors = [];
    if (photo.r2_key) {
      try {
        await deleteObject(photo.r2_key);
      } catch (err) {
        console.error(`R2 delete failed for ${photo.r2_key}:`, err.message);
        r2Errors.push({ key: photo.r2_key, error: err.message });
      }
    }
    if (photo.enhanced_r2_key) {
      try {
        await deleteObject(photo.enhanced_r2_key);
      } catch (err) {
        console.error(`R2 delete failed for ${photo.enhanced_r2_key}:`, err.message);
        r2Errors.push({ key: photo.enhanced_r2_key, error: err.message });
      }
    }

    // Delete the row.
    const { error: delErr } = await supa
      .from('customer_photos')
      .delete()
      .eq('id', photoId);

    if (delErr) {
      return res.status(500).json({ error: 'DB delete failed', detail: delErr.message });
    }

    return res.status(200).json({
      ok: true,
      r2_errors: r2Errors.length ? r2Errors : undefined,
    });
  } catch (err) {
    console.error('admin/photo-delete error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
};
