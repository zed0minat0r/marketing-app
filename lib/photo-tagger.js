'use strict';

/**
 * Photo tagging via Claude vision (Haiku 4.5).
 *
 * Cheapest fast vision option in the existing Anthropic stack. Returns a small
 * JSON array of lowercase, hyphen-or-underscore-free tags useful for matching
 * photos to future post topics ("kitchen", "wood-fired", "exterior").
 */

const Anthropic = require('@anthropic-ai/sdk');

const VISION_MODEL = 'claude-haiku-4-5-20251001';
const MAX_TAGS = 10;

let _client = null;
function getClient() {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY must be set');
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

const TAGGING_PROMPT = `Tag this photo for a small-business marketing library.

Return a JSON array of 4-8 short, lowercase tags. Tags should be useful when later searching for a photo to match a social post topic. Cover, in this order of priority:

1. Subject category (e.g. "pizza", "haircut", "kitchen", "storefront", "team-photo", "before-after")
2. Visible product / work specifics (e.g. "margherita", "fade-cut", "white-cabinets", "stainless-steel")
3. Environment (e.g. "indoor", "outdoor", "studio", "shop-floor")
4. Mood/quality cues useful for ads (e.g. "well-lit", "appetizing", "finished-work", "in-progress")

Rules:
- Tags must be lowercase, ASCII, words separated by hyphens. No spaces, no emoji.
- Do not invent specifics you cannot verify from the image (e.g. don't guess the brand or person's name).
- Skip generic filler like "photo", "image", "good".
- Output ONLY the JSON array, no prose, no fences.

Example output: ["pizza","margherita","wood-fired","appetizing","indoor","table-shot"]`;

/**
 * Tag an image given its public URL (R2 public URL).
 * Returns { tags: string[], model } or throws.
 */
async function tagPhotoFromUrl(publicUrl, mimeType) {
  if (!publicUrl) throw new Error('publicUrl required');

  const client = getClient();
  const resp = await client.messages.create({
    model: VISION_MODEL,
    max_tokens: 200,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'url', url: publicUrl } },
          { type: 'text', text: TAGGING_PROMPT },
        ],
      },
    ],
  });

  const raw = (resp.content?.[0]?.text || '').trim();
  return { tags: parseTags(raw), model: VISION_MODEL };
}

/**
 * Tag an image from raw bytes (base64-encoded). Use when R2 public URL is not
 * yet reachable or the bucket is private.
 */
async function tagPhotoFromBuffer(buffer, mimeType) {
  if (!buffer) throw new Error('buffer required');

  const base64 = Buffer.isBuffer(buffer) ? buffer.toString('base64') : Buffer.from(buffer).toString('base64');
  const media = (mimeType || 'image/jpeg').toLowerCase();

  const client = getClient();
  const resp = await client.messages.create({
    model: VISION_MODEL,
    max_tokens: 200,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: media, data: base64 },
          },
          { type: 'text', text: TAGGING_PROMPT },
        ],
      },
    ],
  });

  const raw = (resp.content?.[0]?.text || '').trim();
  return { tags: parseTags(raw), model: VISION_MODEL };
}

function parseTags(rawText) {
  const cleaned = rawText
    .replace(/^```json\n?/i, '')
    .replace(/^```\n?/i, '')
    .replace(/\n?```$/i, '')
    .trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter(t => typeof t === 'string')
    .map(t => t.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))
    .filter(t => t.length > 0 && t.length <= 40)
    .slice(0, MAX_TAGS);
}

/**
 * Pick the most useful tag for a confirmation message — prefer subject category.
 */
function primaryTag(tags) {
  if (!tags || tags.length === 0) return 'photo';
  return tags[0];
}

module.exports = {
  tagPhotoFromUrl,
  tagPhotoFromBuffer,
  primaryTag,
  VISION_MODEL,
};
