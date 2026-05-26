'use strict';

/**
 * POST /api/jobs/enhance-photo
 *
 * QStash job — runs the Replicate Real-ESRGAN enhancement for a single
 * customer_photos row. Triggered by lib/photo-intake.js after MMS ingest.
 *
 * Why a separate job instead of fire-and-forget in the webhook?
 *
 * `api/sms/inbound.js` has maxDuration: 30 seconds. Replicate Real-ESRGAN
 * typically takes 60-90 seconds. Running enhancement fire-and-forget inside
 * the webhook means the Vercel function dies before Replicate returns and
 * the enhanced URL never gets saved — every photo would end up with
 * enhancement_status stuck on 'pending'. /api/jobs/[action].js has
 * maxDuration: 300s, plenty for enhancement.
 *
 * Tagging stays inline in the webhook — it's fast (3-5s) and the first-
 * photo case needs the tag for the SMS reply.
 */

const { enhancePhoto, hasApiToken, publicUrlIsReachable } = require('../photo-enhancer');
const { getClient, updatePhotoEnhancement } = require('../supabase');
const { checkDailyCap } = require('../cost-guardrails');

async function verifyQStashSignature(req) {
  const currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  if (!currentKey) return true; // dev/test path
  const signature = req.headers['upstash-signature'];
  if (!signature) return false;
  try {
    const { Receiver } = require('@upstash/qstash');
    const receiver = new Receiver({
      currentSigningKey: currentKey,
      nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY,
    });
    await receiver.verify({ signature, body: JSON.stringify(req.body) });
    return true;
  } catch {
    return false;
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!await verifyQStashSignature(req)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { photo_id } = req.body || {};
  if (!photo_id) return res.status(400).json({ error: 'photo_id required' });

  // Load the photo row to get its public URL + user_id.
  const { data: photo, error } = await getClient()
    .from('customer_photos')
    .select('id, user_id, public_url, mime_type, enhancement_status')
    .eq('id', photo_id)
    .single();

  if (error || !photo) {
    return res.status(404).json({ error: 'Photo not found' });
  }

  // Idempotency: if already enhanced or explicitly skipped, return early.
  if (photo.enhancement_status === 'enhanced') {
    return res.status(200).json({ success: true, alreadyEnhanced: true });
  }
  if (photo.enhancement_status === 'skipped') {
    return res.status(200).json({ success: true, skipped: true });
  }

  if (!hasApiToken()) {
    await updatePhotoEnhancement(photo.id, { enhancement_status: 'skipped' }).catch(() => {});
    return res.status(200).json({ success: true, skipped: 'no-api-token' });
  }

  if (!publicUrlIsReachable(photo.public_url)) {
    await updatePhotoEnhancement(photo.id, { enhancement_status: 'skipped' }).catch(() => {});
    return res.status(200).json({ success: true, skipped: 'url-not-public' });
  }

  // Cost cap — same daily ceiling as before, but checked here so the queue
  // worker won't blow through Replicate spend on a single abusive user.
  const gate = await checkDailyCap('enhancement', photo.user_id);
  if (!gate.allowed) {
    await updatePhotoEnhancement(photo.id, { enhancement_status: 'skipped' }).catch(() => {});
    return res.status(200).json({ success: true, skipped: 'daily-cap' });
  }

  try {
    const out = await enhancePhoto({
      userId: photo.user_id,
      originalUrl: photo.public_url,
      mimeType: photo.mime_type,
    });
    await updatePhotoEnhancement(photo.id, {
      enhanced_url: out.enhancedUrl,
      enhanced_r2_key: out.enhancedKey,
      enhancement_status: 'enhanced',
      enhancement_provider: out.provider,
      enhancement_model: out.model,
    });
    return res.status(200).json({ success: true, enhancedUrl: out.enhancedUrl });
  } catch (err) {
    console.error(`Enhancement job failed for photo ${photo.id}:`, err.message);
    await updatePhotoEnhancement(photo.id, { enhancement_status: 'failed' }).catch(() => {});
    return res.status(500).json({ error: err.message });
  }
};
