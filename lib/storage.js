'use strict';

/**
 * Photo storage helper with two backends behind one interface:
 *
 *   - Supabase Storage (DEFAULT): rides the SUPABASE_URL +
 *     SUPABASE_SERVICE_ROLE_KEY the app already requires. Objects live in the
 *     public `customer-photos` bucket; public URLs are served by Supabase's
 *     CDN endpoint. Zero extra accounts or env vars.
 *
 *   - Cloudflare R2 (optional upgrade): used automatically when ALL R2_* env
 *     vars are configured. aws4fetch keeps cold starts fast (no @aws-sdk).
 *     R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET_NAME /
 *     R2_ENDPOINT_URL / R2_PUBLIC_BASE_URL.
 *
 * Interface (stable for callers): uploadBuffer({userId, body, mimeType}) ->
 * { key, publicUrl }; deleteObject(key).
 */

const { AwsClient } = require('aws4fetch');

const SUPABASE_BUCKET = process.env.STORAGE_BUCKET || 'customer-photos';

function r2Configured() {
  return Boolean(
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME &&
    process.env.R2_ENDPOINT_URL
  );
}

// ---------------------------------------------------------------------------
// R2 backend
// ---------------------------------------------------------------------------

let _r2Client = null;

function getR2Client() {
  if (!_r2Client) {
    _r2Client = new AwsClient({
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      service: 's3',
      region: 'auto',
    });
  }
  return _r2Client;
}

function getR2Endpoint() {
  return process.env.R2_ENDPOINT_URL.replace(/\/$/, '');
}

async function r2Upload(key, body, mimeType) {
  const url = `${getR2Endpoint()}/${process.env.R2_BUCKET_NAME}/${key}`;
  const res = await getR2Client().fetch(url, {
    method: 'PUT',
    body,
    headers: { 'Content-Type': mimeType || 'application/octet-stream' },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`R2 upload failed: ${res.status} ${text}`);
  }
  const base = (process.env.R2_PUBLIC_BASE_URL || '').replace(/\/$/, '');
  const publicUrl = base
    ? `${base}/${key}`
    : `${getR2Endpoint()}/${process.env.R2_BUCKET_NAME}/${key}`;
  return { key, publicUrl };
}

async function r2Delete(key) {
  const url = `${getR2Endpoint()}/${process.env.R2_BUCKET_NAME}/${key}`;
  const res = await getR2Client().fetch(url, { method: 'DELETE' });
  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => '');
    throw new Error(`R2 delete failed: ${res.status} ${text}`);
  }
}

// ---------------------------------------------------------------------------
// Supabase Storage backend
// ---------------------------------------------------------------------------

function getSupabaseStorage() {
  // Lazy require avoids a cycle (supabase.js is widely imported)
  const { getClient } = require('./supabase');
  return getClient().storage;
}

async function supabaseUpload(key, body, mimeType) {
  const { error } = await getSupabaseStorage()
    .from(SUPABASE_BUCKET)
    .upload(key, body, {
      contentType: mimeType || 'application/octet-stream',
      upsert: false,
    });
  if (error) throw new Error(`Supabase storage upload failed: ${error.message}`);
  const base = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  return { key, publicUrl: `${base}/storage/v1/object/public/${SUPABASE_BUCKET}/${key}` };
}

async function supabaseDelete(key) {
  const { error } = await getSupabaseStorage().from(SUPABASE_BUCKET).remove([key]);
  if (error && !/not found/i.test(error.message)) {
    throw new Error(`Supabase storage delete failed: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Shared interface
// ---------------------------------------------------------------------------

/**
 * Build a per-user object key. Layout: user_<uuid>/<YYYY-MM-DD>_<rand>.<ext>
 */
function buildKey(userId, mimeType) {
  const ext = mimeExt(mimeType);
  const date = new Date().toISOString().slice(0, 10);
  const rand = Math.random().toString(36).slice(2, 10);
  return `user_${userId}/${date}_${rand}.${ext}`;
}

function mimeExt(mime) {
  const m = (mime || '').toLowerCase();
  if (m === 'image/jpeg' || m === 'image/jpg') return 'jpg';
  if (m === 'image/png') return 'png';
  if (m === 'image/heic' || m === 'image/heif') return 'heic';
  if (m === 'image/webp') return 'webp';
  if (m === 'image/gif') return 'gif';
  return 'bin';
}

/**
 * Upload bytes. Returns { key, publicUrl }.
 */
async function uploadBuffer({ userId, body, mimeType }) {
  const key = buildKey(userId, mimeType);
  return r2Configured() ? r2Upload(key, body, mimeType) : supabaseUpload(key, body, mimeType);
}

/**
 * Delete an object.
 */
async function deleteObject(key) {
  return r2Configured() ? r2Delete(key) : supabaseDelete(key);
}

module.exports = {
  uploadBuffer,
  deleteObject,
  buildKey,
  mimeExt,
  r2Configured,
};
