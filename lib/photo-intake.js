'use strict';

/**
 * Photo intake pipeline (Twilio MMS → R2 → DB → async tagging).
 *
 * Called from the inbound SMS webhook when `NumMedia > 0` is in the Twilio
 * payload. Each media URL is fetched from Twilio's CDN (with basic auth using
 * our account SID + auth token), pushed to R2, and a `customer_photos` row is
 * inserted. Tagging runs after insert so the webhook can return fast.
 */

const { uploadBuffer } = require('./storage');
const {
  createCustomerPhoto,
  updatePhotoTags,
  updatePhotoEnhancement,
} = require('./supabase');
const {
  tagPhotoFromBuffer,
  primaryTag,
} = require('./photo-tagger');
const {
  enhancePhoto,
  hasApiToken: hasEnhancerToken,
  publicUrlIsReachable,
} = require('./photo-enhancer');
const { checkDailyCap } = require('./cost-guardrails');

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
  'image/gif',
]);

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Extract media descriptors from a Twilio inbound webhook payload.
 * Returns [{ url, mimeType }, ...] (possibly empty).
 */
function extractMedia(body) {
  const numMedia = parseInt(body?.NumMedia || '0', 10);
  if (!Number.isFinite(numMedia) || numMedia <= 0) return [];
  const out = [];
  for (let i = 0; i < numMedia; i++) {
    const url = body[`MediaUrl${i}`];
    const mimeType = body[`MediaContentType${i}`];
    if (url) out.push({ url, mimeType: (mimeType || '').toLowerCase() });
  }
  return out;
}

/**
 * Fetch a single media item from Twilio (requires basic auth) and return
 * { buffer, mimeType }.
 *
 * Throws OVERSIZED if Content-Length declares > MAX_FILE_BYTES (catches
 * abuse before allocating the buffer) or if the actual downloaded buffer
 * exceeds it (Content-Length lies sometimes). Throws EMPTY on 0-byte
 * response. Throws on any non-2xx HTTP status.
 */
async function fetchTwilioMedia(mediaUrl, fallbackMime) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const headers = {};
  if (sid && token) {
    const auth = Buffer.from(`${sid}:${token}`).toString('base64');
    headers.Authorization = `Basic ${auth}`;
  }
  const res = await fetch(mediaUrl, { headers, redirect: 'follow' });
  if (!res.ok) {
    throw new Error(`Twilio media fetch failed: ${res.status}`);
  }

  // Reject oversized BEFORE downloading the body — saves memory + bandwidth
  // when an attacker tries to flood us with 100MB attachments.
  const cl = parseInt(res.headers.get('content-length') || '0', 10);
  if (Number.isFinite(cl) && cl > MAX_FILE_BYTES) {
    const err = new Error(`Twilio media too large: declared ${cl} bytes (max ${MAX_FILE_BYTES})`);
    err.code = 'OVERSIZED';
    throw err;
  }

  const ab = await res.arrayBuffer();
  const buffer = Buffer.from(ab);

  // Defense in depth — Content-Length can lie or be absent.
  if (buffer.length > MAX_FILE_BYTES) {
    const err = new Error(`Twilio media too large: ${buffer.length} bytes (max ${MAX_FILE_BYTES})`);
    err.code = 'OVERSIZED';
    throw err;
  }
  if (buffer.length === 0) {
    const err = new Error('Twilio media is empty (0 bytes)');
    err.code = 'EMPTY';
    throw err;
  }

  const mimeType = (res.headers.get('content-type') || fallbackMime || 'application/octet-stream').toLowerCase();
  return { buffer, mimeType };
}

/**
 * Run tagging in the background — we don't await this in the webhook path so
 * the user gets their reply fast. Errors are swallowed (logged); the photo
 * still exists, it just has `tags_status='failed'` and can be retagged later.
 */
async function tagPhotoAsync(photoId, buffer, mimeType, userId) {
  // Daily cap on vision API calls per user — runaway prevention.
  if (userId) {
    const gate = await checkDailyCap('vision_tag', userId);
    if (!gate.allowed) {
      console.warn(`Vision tag daily cap hit for user ${userId}; skipping tag for ${photoId}`);
      await updatePhotoTags(photoId, [], 'failed').catch(() => {});
      return [];
    }
  }
  try {
    const { tags } = await tagPhotoFromBuffer(buffer, mimeType);
    await updatePhotoTags(photoId, tags, 'tagged');
    return tags;
  } catch (err) {
    console.error(`Photo tagging failed for ${photoId}:`, err.message);
    await updatePhotoTags(photoId, [], 'failed').catch(() => {});
    return [];
  }
}

/**
 * Run enhancement (upscale + sharpen) in the background. Updates the
 * customer_photos row with enhanced_url + enhancement_status when done. On
 * failure, marks status='failed' so the original is still usable.
 *
 * Caller controls whether this runs (per-user `auto_enhance_enabled` flag).
 */
async function enhancePhotoAsync(photoId, { userId, originalUrl, mimeType }) {
  if (!hasEnhancerToken()) {
    await updatePhotoEnhancement(photoId, {
      enhanced_url: null,
      enhanced_r2_key: null,
      enhancement_status: 'skipped',
    }).catch(() => {});
    return null;
  }
  // If R2_PUBLIC_BASE_URL isn't configured, Replicate can't fetch the input
  // (the internal R2 endpoint requires SigV4). Skip cleanly BEFORE the cap
  // check so we don't burn a daily slot on a guaranteed failure.
  if (!publicUrlIsReachable(originalUrl)) {
    console.warn(`Skipping enhancement for ${photoId}: originalUrl not publicly reachable (${originalUrl})`);
    await updatePhotoEnhancement(photoId, { enhancement_status: 'skipped' }).catch(() => {});
    return null;
  }
  // Daily cap on Replicate enhancements per user. If hit, mark skipped and
  // keep going — the original photo is still saved + tagged.
  const gate = await checkDailyCap('enhancement', userId);
  if (!gate.allowed) {
    console.warn(`Enhancement daily cap hit for user ${userId}; skipping enhancement for ${photoId}`);
    await updatePhotoEnhancement(photoId, { enhancement_status: 'skipped' }).catch(() => {});
    return null;
  }
  try {
    const out = await enhancePhoto({ userId, originalUrl, mimeType });
    await updatePhotoEnhancement(photoId, {
      enhanced_url: out.enhancedUrl,
      enhanced_r2_key: out.enhancedKey,
      enhancement_status: 'enhanced',
      enhancement_provider: out.provider,
      enhancement_model: out.model,
    });
    return out;
  } catch (err) {
    console.error(`Photo enhancement failed for ${photoId}:`, err.message);
    await updatePhotoEnhancement(photoId, {
      enhancement_status: 'failed',
    }).catch(() => {});
    return null;
  }
}

/**
 * Main entry point. Processes all media in the Twilio webhook payload for a
 * single user. Returns:
 *   {
 *     savedCount: number,
 *     skippedCount: number,
 *     primaryTagGuess: string|null   // best-effort, may be null until tagging completes
 *   }
 *
 * Errors during one media item are isolated — the others still proceed.
 */
async function processInboundMedia({ user, twilioSid, caption, body, waitForTagging = false }) {
  const media = extractMedia(body);
  if (media.length === 0) {
    return { savedCount: 0, skippedCount: 0, primaryTagGuess: null, capHit: false };
  }

  let savedCount = 0;
  let skippedCount = 0;
  let firstTags = null;
  let capHit = false;

  for (const m of media) {
    try {
      if (!ALLOWED_MIME.has(m.mimeType) && !ALLOWED_MIME.has(m.mimeType.split(';')[0])) {
        console.warn(`Skipping non-image MMS attachment: ${m.mimeType}`);
        skippedCount++;
        continue;
      }

      // Daily cap on MMS intake per user. Stop processing further attachments
      // once we hit the cap so we don't blow through R2 + tag + enhance costs.
      const gate = await checkDailyCap('mms_intake', user.id);
      if (!gate.allowed) {
        console.warn(`MMS daily cap hit for user ${user.id} (cap=${gate.cap})`);
        capHit = true;
        skippedCount += (media.length - savedCount - skippedCount);
        break;
      }

      // fetchTwilioMedia rejects OVERSIZED / EMPTY for us and never returns
      // a buffer that violates either bound. Any throw lands in the per-item
      // catch below; the rest of the batch proceeds.
      const { buffer, mimeType } = await fetchTwilioMedia(m.url, m.mimeType);

      const { key, publicUrl } = await uploadBuffer({
        userId: user.id,
        body: buffer,
        mimeType,
      });

      const row = await createCustomerPhoto({
        userId: user.id,
        r2Key: key,
        publicUrl,
        mimeType,
        fileSize: buffer.length,
        caption,
        twilioSid,
        source: 'sms',
      });

      // Tagging — usually fire-and-forget, but for the *first* photo we wait so
      // we can include a meaningful tag in the confirmation reply.
      if (waitForTagging && firstTags === null) {
        firstTags = await tagPhotoAsync(row.id, buffer, mimeType, user.id);
      } else {
        tagPhotoAsync(row.id, buffer, mimeType, user.id).catch(err =>
          console.error('Background tagging error:', err)
        );
      }

      // Enhancement — fire-and-forget. Per-user opt-out via auto_enhance_enabled.
      // We pass the just-uploaded public URL so Replicate can fetch it directly.
      if (user.auto_enhance_enabled !== false) {
        enhancePhotoAsync(row.id, {
          userId: user.id,
          originalUrl: publicUrl,
          mimeType,
        }).catch(err =>
          console.error('Background enhancement error:', err)
        );
      } else {
        updatePhotoEnhancement(row.id, { enhancement_status: 'skipped' }).catch(() => {});
      }

      savedCount++;
    } catch (err) {
      console.error('Media intake error:', err.message);
      skippedCount++;
    }
  }

  return {
    savedCount,
    skippedCount,
    primaryTagGuess: firstTags && firstTags.length ? primaryTag(firstTags) : null,
    capHit,
  };
}

module.exports = {
  extractMedia,
  processInboundMedia,
  tagPhotoAsync,
  enhancePhotoAsync,
  fetchTwilioMedia,
  ALLOWED_MIME,
  MAX_FILE_BYTES,
};
