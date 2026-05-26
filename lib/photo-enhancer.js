'use strict';

/**
 * Photo enhancement via Replicate (Real-ESRGAN by default).
 *
 * Takes the original photo URL, runs it through an upscaler/sharpener, then
 * downloads the result and saves it back to R2 alongside the original. The
 * enhanced version is what we'll later use for ad creative — the original
 * stays untouched so the customer can always pull back to the raw shot.
 *
 * This implementation is intentionally safe-only — no generative regen of
 * subject matter. We sharpen and upscale how the image was *captured*, never
 * change *what* was captured (see photos rule in CLAUDE.md / Sidekick notes).
 *
 * Required env:
 *   REPLICATE_API_TOKEN     Replicate API key (r8_...)
 *
 * Optional env:
 *   REPLICATE_ENHANCE_MODEL Override the model version hash. Defaults to a
 *                           pinned Real-ESRGAN with face_enhance.
 */

const { uploadBuffer } = require('./storage');

const REPLICATE_API = 'https://api.replicate.com/v1/predictions';

// Real-ESRGAN with face_enhance — solid default for phone photos.
// Pinned version hash so behavior is reproducible.
const DEFAULT_MODEL_VERSION =
  process.env.REPLICATE_ENHANCE_MODEL ||
  '42fed1c4974146d4d2414e2be2c5277c7fcf05fcc3a73abf41610695738c1d7b'; // nightmareai/real-esrgan

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 90 * 1000; // 90s — enhancement should finish well inside this

function hasApiToken() {
  return Boolean(process.env.REPLICATE_API_TOKEN);
}

/**
 * Replicate needs to be able to fetch the input image — the URL must be
 * reachable from the public internet without auth. If R2_PUBLIC_BASE_URL
 * isn't set, the upload's public_url falls back to the internal R2 endpoint
 * which requires SigV4 auth, so Replicate would fail with 401/403. Detect
 * that up front so callers can skip enhancement cleanly instead of burning
 * a Replicate prediction + a daily cap slot.
 */
function publicUrlIsReachable(url) {
  if (!url) return false;
  const base = (process.env.R2_PUBLIC_BASE_URL || '').replace(/\/$/, '');
  if (base && url.startsWith(base + '/')) return true;
  // Allow any HTTPS host that isn't the bare R2 endpoint (e.g. r2.dev public
  // bucket URL, or a Cloudflare custom domain we didn't put in env).
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && !u.host.endsWith('r2.cloudflarestorage.com');
  } catch {
    return false;
  }
}

async function startPrediction(imageUrl) {
  const res = await fetch(REPLICATE_API, {
    method: 'POST',
    headers: {
      Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      version: DEFAULT_MODEL_VERSION,
      input: {
        image: imageUrl,
        scale: 2,
        face_enhance: true,
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Replicate start failed: ${res.status} ${text}`);
  }
  return res.json();
}

async function pollPrediction(getUrl) {
  const start = Date.now();
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    const res = await fetch(getUrl, {
      headers: { Authorization: `Token ${process.env.REPLICATE_API_TOKEN}` },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Replicate poll failed: ${res.status} ${text}`);
    }
    const pred = await res.json();
    if (pred.status === 'succeeded') return pred;
    if (pred.status === 'failed' || pred.status === 'canceled') {
      throw new Error(`Replicate prediction ${pred.status}: ${pred.error || 'unknown'}`);
    }
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error('Replicate prediction timed out');
}

/**
 * Run enhancement on a photo at `originalUrl` (must be a public URL — Replicate
 * needs to be able to fetch it). Returns { enhancedKey, enhancedUrl, model } or
 * throws on failure.
 */
async function enhancePhoto({ userId, originalUrl, mimeType }) {
  if (!hasApiToken()) {
    const err = new Error('REPLICATE_API_TOKEN not set — skipping enhancement');
    err.code = 'NO_API_TOKEN';
    throw err;
  }
  if (!originalUrl) throw new Error('originalUrl required');
  if (!publicUrlIsReachable(originalUrl)) {
    const err = new Error('originalUrl is not publicly reachable — set R2_PUBLIC_BASE_URL or use a public bucket');
    err.code = 'URL_NOT_PUBLIC';
    throw err;
  }

  // Start prediction
  const created = await startPrediction(originalUrl);
  const pollUrl = created.urls?.get;
  if (!pollUrl) throw new Error('No poll URL in Replicate response');

  // Wait for it
  const finished = await pollPrediction(pollUrl);
  const outputUrl = Array.isArray(finished.output) ? finished.output[0] : finished.output;
  if (!outputUrl) throw new Error('No output URL in Replicate result');

  // Download enhanced bytes
  const dl = await fetch(outputUrl);
  if (!dl.ok) throw new Error(`Download enhanced failed: ${dl.status}`);
  const ab = await dl.arrayBuffer();
  const buffer = Buffer.from(ab);
  const outMime = (dl.headers.get('content-type') || mimeType || 'image/png').toLowerCase();

  // Upload to R2 under the same user prefix, in an /enhanced/ subdir
  const { key, publicUrl } = await uploadBuffer({
    userId: `${userId}/enhanced`,
    body: buffer,
    mimeType: outMime,
  });

  return {
    enhancedKey: key,
    enhancedUrl: publicUrl,
    model: 'real-esrgan',
    provider: 'replicate',
  };
}

module.exports = {
  enhancePhoto,
  hasApiToken,
  publicUrlIsReachable,
};
