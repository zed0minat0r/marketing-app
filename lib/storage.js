'use strict';

/**
 * Cloudflare R2 storage helper.
 *
 * Uses aws4fetch (the S3-compatible API) to sign requests. R2 is S3-compatible
 * but we avoid pulling in the full @aws-sdk/client-s3 (~2MB) to keep cold starts
 * fast in Vercel serverless functions.
 *
 * Required env vars:
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_BUCKET_NAME
 *   R2_ENDPOINT_URL          e.g. https://<account-id>.r2.cloudflarestorage.com
 *   R2_PUBLIC_BASE_URL       e.g. https://photos.sidekik.com  (public bucket / custom domain)
 */

const { AwsClient } = require('aws4fetch');

let _client = null;

function getClient() {
  if (!_client) {
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    if (!accessKeyId || !secretAccessKey) {
      throw new Error('R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY must be set');
    }
    _client = new AwsClient({
      accessKeyId,
      secretAccessKey,
      service: 's3',
      region: 'auto',
    });
  }
  return _client;
}

function getBucket() {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) throw new Error('R2_BUCKET_NAME must be set');
  return bucket;
}

function getEndpoint() {
  const endpoint = process.env.R2_ENDPOINT_URL;
  if (!endpoint) throw new Error('R2_ENDPOINT_URL must be set');
  return endpoint.replace(/\/$/, '');
}

function getPublicBase() {
  // If a public/custom domain is configured, use it. Otherwise fall back to
  // the internal endpoint (objects must be public-read or fronted by a proxy).
  return (process.env.R2_PUBLIC_BASE_URL || '').replace(/\/$/, '');
}

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
 * Upload bytes to R2. Returns { key, publicUrl }.
 */
async function uploadBuffer({ userId, body, mimeType }) {
  const key = buildKey(userId, mimeType);
  const url = `${getEndpoint()}/${getBucket()}/${key}`;

  const res = await getClient().fetch(url, {
    method: 'PUT',
    body,
    headers: {
      'Content-Type': mimeType || 'application/octet-stream',
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`R2 upload failed: ${res.status} ${text}`);
  }

  const base = getPublicBase();
  const publicUrl = base
    ? `${base}/${key}`
    : `${getEndpoint()}/${getBucket()}/${key}`;

  return { key, publicUrl };
}

/**
 * Delete an object from R2.
 */
async function deleteObject(key) {
  const url = `${getEndpoint()}/${getBucket()}/${key}`;
  const res = await getClient().fetch(url, { method: 'DELETE' });
  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => '');
    throw new Error(`R2 delete failed: ${res.status} ${text}`);
  }
}

module.exports = {
  uploadBuffer,
  deleteObject,
  buildKey,
  mimeExt,
};
