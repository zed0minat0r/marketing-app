'use strict';

/**
 * Google review replies - "approve a review reply from your truck in one text."
 *
 * Daily sweep (dispatch cron) + on-demand "check reviews" command: list the
 * business's Google reviews, find unanswered ones, draft a reply in the
 * business's voice, text the owner for approval. YES posts the reply through
 * the Business Profile API; "reply: ..." posts custom wording; SKIP ignores.
 *
 * Negative reviews (3 stars and under) get a different drafting posture:
 * brief, apologetic, take it offline - never defensive, never excuses,
 * never admissions of specific fault we can't verify.
 */

const Anthropic = require('@anthropic-ai/sdk');
const { getClient: getSupabase, getSocialAccount, logMessage } = require('./supabase');
const { CLAUDE_MODELS } = require('./constants');
const { sendSms } = require('./sms-outbound');

let _anthropic = null;
function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

const STARS = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

/** Get a working Google access token for the user, refreshing if expired. */
async function getGoogleAccessToken(user) {
  const account = await getSocialAccount(user.id, 'google');
  if (!account?.access_token) return null;
  const expired = account.token_expires_at && new Date(account.token_expires_at) < new Date(Date.now() + 60_000);
  if (!expired) return account.access_token;
  if (!account.refresh_token) return account.access_token; // try anyway
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: account.refresh_token,
        grant_type: 'refresh_token',
      }),
    });
    const data = await res.json();
    return data.access_token || account.access_token;
  } catch {
    return account.access_token;
  }
}

/** First business account + first location (matches the analytics job's assumption). */
async function getPrimaryLocation(accessToken) {
  const aRes = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const aData = await aRes.json();
  const account = aData.accounts?.[0];
  if (!account) return null;
  const lRes = await fetch(
    `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=name,title`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const lData = await lRes.json();
  const location = lData.locations?.[0];
  if (!location) return null;
  // v4 reviews path wants accounts/{a}/locations/{l}
  return `${account.name}/${location.name}`;
}

/** List reviews without an owner reply, newest first. */
async function listUnansweredReviews(accessToken, locationPath, limit = 5) {
  const res = await fetch(
    `https://mybusiness.googleapis.com/v4/${locationPath}/reviews?pageSize=50&orderBy=updateTime desc`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return { error: `HTTP ${res.status}`, reviews: [] };
  const data = await res.json();
  const unanswered = (data.reviews || [])
    .filter(r => !r.reviewReply)
    .slice(0, limit)
    .map(r => ({
      reviewId: r.name || r.reviewId,
      reviewer: r.reviewer?.displayName || 'A customer',
      stars: STARS[r.starRating] || null,
      text: (r.comment || '').slice(0, 1000),
    }));
  return { reviews: unanswered };
}

/** Draft a reply in the business's voice; different posture for negative reviews. */
async function draftReviewReply(user, review) {
  const voice = (user.voice_notes || '').trim() || `tone: ${user.tone || 'professional'}`;
  const negative = review.stars !== null && review.stars <= 3;
  const posture = negative
    ? 'This is a NEGATIVE review. Be brief and gracious: thank them, apologize that their experience missed the mark (no excuses, no defensiveness, and do NOT admit specific faults you cannot verify), and invite them to contact the business directly to make it right.'
    : 'This is a positive review. Thank them warmly, reference something specific they mentioned if there is anything, and invite them back. No discounts or promises.';
  const prompt = `You reply to Google reviews for ${user.business_name || 'a small business'} (${user.business_type || 'business'}; voice: ${voice}).

Review from ${review.reviewer}${review.stars ? ` (${review.stars} stars)` : ''}: "${review.text || '(no text, rating only)'}"

${posture}

Write ONE reply: under 350 characters, human, no hashtags, sign off as the business.

Respond with JSON only: {"reply": "..."}`;
  const res = await getAnthropic().messages.create({
    model: CLAUDE_MODELS.fast,
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  });
  const raw = res.content[0]?.text || '';
  try {
    const cleaned = raw.replace(/^```json\n?/i, '').replace(/\n?```$/i, '').trim();
    const parsed = JSON.parse(cleaned);
    if (parsed.reply) return String(parsed.reply).slice(0, 500);
  } catch { /* fall through */ }
  return null;
}

/**
 * Sweep one user's reviews: draft + notify for unanswered ones not yet seen.
 * Returns { notified, error? }.
 */
async function sweepReviewsForUser(user, { limit = 2 } = {}) {
  const accessToken = await getGoogleAccessToken(user);
  if (!accessToken) return { notified: 0, error: 'no google account' };
  const locationPath = await getPrimaryLocation(accessToken);
  if (!locationPath) return { notified: 0, error: 'no business location' };
  const { reviews, error } = await listUnansweredReviews(accessToken, locationPath);
  if (error) return { notified: 0, error };

  const db = getSupabase();
  let notified = 0;
  for (const review of reviews) {
    if (notified >= limit) break; // don't flood the owner
    const { data: existing } = await db
      .from('review_replies').select('id').eq('review_id', review.reviewId).maybeSingle();
    if (existing) continue;

    const draft = await draftReviewReply(user, review);
    if (!draft) continue;

    const { error: insertError } = await db.from('review_replies').insert({
      user_id: user.id,
      review_id: review.reviewId,
      location_name: locationPath,
      reviewer_name: review.reviewer,
      star_rating: review.stars,
      review_text: review.text,
      draft_reply: draft,
    });
    if (insertError) continue; // duplicate race - fine

    const starsLabel = review.stars ? `${review.stars}-star ` : '';
    const notice = `New ${starsLabel}Google review from ${review.reviewer}: "${(review.text || '(rating only)').slice(0, 120)}"\n\nMy draft reply: "${draft}"\n\nReply YES to post it, or SKIP to ignore.`;
    const sms = await sendSms(user.phone, notice);
    if (sms?.skipped) {
      // Opted out between the SQL filter and now - stop drafting entirely.
      break;
    }
    notified++;
    await logMessage({
      userId: user.id, direction: 'outbound', body: notice, intent: 'review_reply',
    }).catch(console.error);
  }
  return { notified };
}

/**
 * The pending draft that a YES actually refers to.
 *
 * `notAfter` MUST be the timestamp of the outbound message that offered the draft. Without it this
 * returned the NEWEST draft, which is a race: between Sidekick texting a draft and the owner replying
 * YES, another comment can arrive and create a newer one. The YES then posted a reply to the owner's
 * Page that they had never seen - published on their behalf, in their name, unapproved.
 *
 * Pinning to "the newest draft that existed when we sent the message" is exact, because the draft row
 * is always written before the SMS that offers it. It also needs no schema change; the alternative
 * was storing a reference on the conversation row, which is a migration against live data.
 */
async function getPendingReviewReply(userId, notAfter) {
  let q = getSupabase()
    .from('review_replies')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'draft');
  if (notAfter) q = q.lte('created_at', notAfter);
  const { data } = await q
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data || null;
}

/** Post an approved reply through the Business Profile API. */
async function postReviewReply(row, user) {
  const accessToken = await getGoogleAccessToken(user);
  if (!accessToken) return { ok: false, error: 'no google account' };
  const res = await fetch(`https://mybusiness.googleapis.com/v4/${row.review_id}/reply`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ comment: row.draft_reply }),
  });
  const db = getSupabase();
  if (res.ok) {
    await db.from('review_replies')
      .update({ status: 'posted', updated_at: new Date().toISOString() })
      .eq('id', row.id);
    return { ok: true };
  }
  const data = await res.json().catch(() => ({}));
  // Keep status 'draft' so "try YES again" works; don't strand the reply.
  console.error('[review-reply] post failed:', data.error?.message || res.status);
  return { ok: false, error: data.error?.message || `HTTP ${res.status}` };
}

async function markReviewReply(rowId, status) {
  await getSupabase().from('review_replies')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', rowId);
}

module.exports = {
  STARS,
  getGoogleAccessToken,
  listUnansweredReviews,
  draftReviewReply,
  sweepReviewsForUser,
  getPendingReviewReply,
  postReviewReply,
  markReviewReply,
};
