'use strict';

/**
 * FB/IG comment replies - the engagement-speed capability.
 *
 * Flow: Meta webhook hints a new comment -> we RE-FETCH it from the Graph API
 * with our own page token (the webhook payload is treated as untrusted; a
 * forged event can only make us look up a real comment on a page we manage)
 * -> Claude drafts a reply in the business's voice -> the owner gets an SMS
 * and approves with YES -> we post the reply.
 *
 * Scopes: pages_manage_engagement (FB replies), instagram_manage_comments
 * (IG replies) - work in Dev Mode for app admins/testers before App Review.
 */

const Anthropic = require('@anthropic-ai/sdk');
const { getClient: getSupabase, getSocialAccount, logMessage } = require('./supabase');
const { CLAUDE_MODELS } = require('./constants');
const { sendSms } = require('../api/sms/outbound');
const { checkDailyCap } = require('./cost-guardrails');

let _anthropic = null;
function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

const GRAPH = 'https://graph.facebook.com/v19.0';

/** Fetch the real comment from Graph. Returns null when unavailable. */
async function fetchComment(platform, commentId, pageToken) {
  const fields = platform === 'instagram' ? 'id,text,username,from,timestamp' : 'id,message,from,permalink_url,created_time';
  const res = await fetch(`${GRAPH}/${encodeURIComponent(commentId)}?fields=${fields}&access_token=${encodeURIComponent(pageToken)}`);
  if (!res.ok) return null;
  const data = await res.json();
  if (platform === 'instagram') {
    return { id: data.id, text: data.text || '', name: data.username || data.from?.username || 'someone', fromId: data.from?.id || null, createdAt: data.timestamp || null };
  }
  return { id: data.id, text: data.message || '', name: data.from?.name || 'someone', fromId: data.from?.id || null, createdAt: data.created_time || null };
}

/** Draft a reply in the business's voice. Short, human, no hashtags. */
async function draftReply(user, platform, comment) {
  const voice = (user.voice_notes || '').trim() || `tone: ${user.tone || 'professional'}`;
  const prompt = `You reply to social media comments for ${user.business_name || 'a small business'} (${user.business_type || 'business'}; voice: ${voice}).

A ${platform} comment from "${comment.name}": "${comment.text.slice(0, 300)}"

Write ONE reply comment: under 200 characters, warm and human, matches the voice, no hashtags, no emojis unless the voice calls for them, never promise discounts or make up facts. If the comment is a question you can't answer from context, thank them and ask them to call or DM.

Respond with JSON only: {"reply": "..."}`;
  const res = await getAnthropic().messages.create({
    model: CLAUDE_MODELS.fast,
    max_tokens: 256,
    messages: [{ role: 'user', content: prompt }],
  });
  const raw = res.content[0]?.text || '';
  try {
    const cleaned = raw.replace(/^```json\n?/i, '').replace(/\n?```$/i, '').trim();
    const parsed = JSON.parse(cleaned);
    if (parsed.reply) return String(parsed.reply).slice(0, 300);
  } catch { /* fall through */ }
  return null;
}

/**
 * Handle one webhook comment hint. Idempotent per comment_id.
 * Returns a short status string (for logs/tests).
 */
async function processCommentEvent({ platform, commentId, pageId }) {
  const db = getSupabase();

  // Which user owns this page/account?
  const { data: account } = await db
    .from('social_accounts')
    .select('id, user_id, platform, platform_user_id')
    .eq('platform', platform)
    .eq('platform_user_id', String(pageId))
    .eq('is_active', true)
    .single();
  if (!account) return 'no-account';

  // Dedupe before any network work
  const { data: existing } = await db
    .from('comment_replies').select('id').eq('comment_id', commentId).maybeSingle();
  if (existing) return 'duplicate';

  const { data: user } = await db.from('users').select('*').eq('id', account.user_id).single();
  if (!user || user.opted_out_at) return 'no-user';

  const tokenAccount = await getSocialAccount(user.id, platform);
  if (!tokenAccount?.access_token) return 'no-token';

  // Daily notification cap - the owner should never wake up to a wall of
  // texts, and a webhook flood should never become unbounded Claude spend.
  const cap = await checkDailyCap(user.id, 'comment_notify', 10);
  if (!cap.allowed) return 'daily-cap';

  const comment = await fetchComment(platform, commentId, tokenAccount.access_token);
  if (!comment || !comment.text.trim()) return 'not-found';
  // Never reply to the page's own comments (incl. our posted replies)
  if (comment.fromId && String(comment.fromId) === String(pageId)) return 'own-comment';
  // Recency: replaying old public comment ids must not trigger drafts.
  if (comment.createdAt && (Date.now() - new Date(comment.createdAt).getTime()) > 48 * 60 * 60 * 1000) {
    return 'too-old';
  }

  const draft = await draftReply(user, platform, comment);
  if (!draft) return 'draft-failed';

  const { error: insertError } = await db.from('comment_replies').insert({
    user_id: user.id,
    platform,
    comment_id: comment.id,
    commenter_name: comment.name,
    comment_text: comment.text.slice(0, 1000),
    draft_reply: draft,
  });
  if (insertError) {
    // Unique violation = concurrent duplicate; anything else is real
    if (!String(insertError.message).includes('duplicate')) throw insertError;
    return 'duplicate';
  }

  const notice = `New ${platform} comment from ${comment.name}: "${comment.text.slice(0, 120)}"\n\nMy draft reply: "${draft}"\n\nReply YES to post it, or SKIP to ignore.`;
  await sendSms(user.phone, notice);
  await logMessage({
    userId: user.id, direction: 'outbound', body: notice, intent: 'comment_reply',
  }).catch(console.error);
  return 'notified';
}

/** Latest pending draft for a user (the one YES/SKIP refers to). */
async function getPendingCommentReply(userId) {
  const { data } = await getSupabase()
    .from('comment_replies')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data || null;
}

/** Post an approved reply to the platform. Returns { ok, error? }. */
async function postCommentReply(row, user) {
  const account = await getSocialAccount(user.id, row.platform);
  if (!account?.access_token) return { ok: false, error: 'no token' };
  const endpoint = row.platform === 'instagram'
    ? `${GRAPH}/${encodeURIComponent(row.comment_id)}/replies`
    : `${GRAPH}/${encodeURIComponent(row.comment_id)}/comments`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ message: row.draft_reply, access_token: account.access_token }),
  });
  const data = await res.json().catch(() => ({}));
  const db = getSupabase();
  if (res.ok && data.id) {
    await db.from('comment_replies')
      .update({ status: 'posted', posted_reply_id: data.id, updated_at: new Date().toISOString() })
      .eq('id', row.id);
    return { ok: true };
  }
  // Keep status 'draft' so the owner's "try YES again" actually works;
  // 'failed' is reserved for permanent conditions we don't retry.
  console.error('[comment-reply] post failed:', data.error?.message || res.status);
  return { ok: false, error: data.error?.message || `HTTP ${res.status}` };
}

async function markCommentReply(rowId, status) {
  await getSupabase().from('comment_replies')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', rowId);
}

/** Extract comment hints from a Meta webhook payload (untrusted input). */
function extractCommentHints(body) {
  const hints = [];
  if (!body || !Array.isArray(body.entry)) return hints;
  for (const entry of body.entry) {
    // Facebook Page feed changes
    for (const change of entry.changes || []) {
      if (change.field === 'feed' && change.value?.item === 'comment' && change.value?.comment_id && change.value?.verb === 'add') {
        hints.push({ platform: 'facebook', commentId: String(change.value.comment_id), pageId: String(entry.id) });
      }
      // Instagram comments arrive as field 'comments' on the IG user object
      if (change.field === 'comments' && change.value?.id) {
        hints.push({ platform: 'instagram', commentId: String(change.value.id), pageId: String(entry.id) });
      }
    }
  }
  return hints.slice(0, 10); // bound work per webhook call
}

module.exports = {
  processCommentEvent,
  getPendingCommentReply,
  postCommentReply,
  markCommentReply,
  extractCommentHints,
  draftReply,
  fetchComment,
};
