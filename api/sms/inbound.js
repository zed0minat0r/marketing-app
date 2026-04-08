'use strict';

/**
 * POST /api/sms/inbound
 *
 * Twilio webhook for incoming SMS messages.
 * Verifies Twilio signature, processes the message through the AI pipeline,
 * and sends a reply.
 *
 * Twilio webhook payload fields used:
 *   - From: sender's E.164 phone number
 *   - Body: message text
 *   - MessageSid: Twilio message ID
 *   - To: our Twilio number
 */

const twilio = require('twilio');
const { sendSms } = require('./outbound');
const { checkRateLimit } = require('../../lib/rate-limit');
const { processOnboarding } = require('../../lib/onboarding');
const { generateResponse } = require('../../lib/claude');
const { classifyIntent, getDraftResponse, parseCancelCommand, parseEditCommand } = require('../../lib/intent');
const {
  getUserByPhone,
  createUser,
  updateUser,
  logMessage,
  getRecentMessages,
  getSocialAccounts,
  createScheduledPost,
  updateScheduledPost,
  getUpcomingPosts,
  cancelPost,
  incrementGenerationsUsed,
  ensureReferralCode,
  ensureQueuePosition,
  getReferralStats,
} = require('../../lib/supabase');
const {
  ONBOARDING_MESSAGES,
  ERROR_MESSAGES,
  PLAN_LIMITS,
  INTENTS,
} = require('../../lib/constants');

const REFERRALS_TO_REWARD = 3;

/**
 * Validate Twilio webhook signature.
 * Returns true if valid, false if invalid.
 */
function validateTwilioSignature(req) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    console.warn('TWILIO_AUTH_TOKEN not set — skipping signature validation');
    return true; // In dev without token, skip validation
  }

  const twilioSignature = req.headers['x-twilio-signature'];
  if (!twilioSignature) return false;

  // Build the full URL Twilio signed
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host;
  const url = `${proto}://${host}${req.url}`;

  // Twilio validates against POST body params
  const params = req.body || {};

  return twilio.validateRequest(authToken, twilioSignature, url, params);
}

/**
 * Check if user has exceeded their generation limit.
 */
function hasGenerationQuota(user) {
  if (user.plan === 'pro') return true;
  const limit = user.generations_limit || PLAN_LIMITS[user.plan] || 50;
  return (user.generations_used || 0) < limit;
}

/**
 * Format upcoming posts list as SMS text.
 */
function formatPostsList(posts) {
  if (!posts || posts.length === 0) {
    return "No posts scheduled. Try: \"Schedule a post about our special for Friday at 5pm\"";
  }

  const lines = posts.slice(0, 5).map((post, i) => {
    const platforms = post.platforms.join(', ');
    const when = post.scheduled_for
      ? new Date(post.scheduled_for).toLocaleDateString('en-US', {
          weekday: 'short', month: 'short', day: 'numeric',
          hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York'
        })
      : 'ASAP';
    const preview = post.content.slice(0, 30) + (post.content.length > 30 ? '...' : '');
    return `${i + 1}. ${when} - ${preview} (${platforms})`;
  });

  return `Upcoming posts:\n${lines.join('\n')}\n\nReply CANCEL 1 to remove.`;
}

/**
 * Handle a pending post draft response (YES/EDIT/SKIP/LATER).
 * Returns { handled: true, replyText } or { handled: false }.
 */
async function handleDraftResponse(user, messageBody, recentMessages) {
  const trimmed = (messageBody || '').trim();
  const draftResponse = getDraftResponse(trimmed);
  if (!draftResponse) return { handled: false };

  // Find the most recent draft in conversation
  const lastBotMessage = recentMessages
    .slice()
    .reverse()
    .find(m => m.direction === 'outbound' && m.intent === 'post');

  if (!lastBotMessage) return { handled: false };

  switch (draftResponse) {
    case 'approve': {
      // Check if any social platforms are connected
      const accounts = await getSocialAccounts(user.id);
      if (accounts.length === 0) {
        return {
          handled: true,
          replyText: "You do not have any social accounts connected yet.\n\nText \"Connect Instagram\" or \"Connect Facebook\" to get started.",
          intent: INTENTS.APPROVE,
        };
      }

      // Store as queued post for immediate publishing
      const platforms = accounts.map(a => a.platform);
      const post = await createScheduledPost({
        userId: user.id,
        platforms,
        content: lastBotMessage.body,
        status: 'queued',
        scheduledFor: null,
      });

      return {
        handled: true,
        replyText: `Got it! Your post is queued for publishing to ${platforms.join(' & ')}.\n\nI will let you know when it is live.`,
        intent: INTENTS.APPROVE,
        postId: post.id,
      };
    }

    case 'skip': {
      return {
        handled: true,
        replyText: "Post canceled. What else can I help you with?",
        intent: INTENTS.SKIP,
      };
    }

    case 'schedule': {
      return {
        handled: true,
        replyText: "When should I post this? Tell me the day and time (e.g. \"Friday at 5pm\" or \"tomorrow morning\").",
        intent: INTENTS.SCHEDULE,
      };
    }

    case 'edit': {
      // Check if this is a structured EDIT N <instruction> command
      const editCmd = parseEditCommand(trimmed);
      if (editCmd) {
        // Structured edit: user said "EDIT 1 make it shorter" etc.
        // Let Claude handle it with the parsed instruction injected as context
        return { handled: false, editInstruction: editCmd.instruction };
      }
      // Plain "EDIT" or "change it" — let Claude handle with full context
      return { handled: false };
    }
  }

  return { handled: false };
}

/**
 * Handle a referral link request via SMS.
 * Generates (or returns) the user's referral code + link,
 * then composes a reply with their count and queue position.
 */
async function handleReferralRequest(user) {
  // Ensure user has a referral code and queue position
  const [referralCode, queuePosition] = await Promise.all([
    ensureReferralCode(user.id),
    ensureQueuePosition(user.id),
  ]);

  // Get up-to-date stats
  const stats = await getReferralStats(user.id);
  const count = stats.referralCount || 0;
  const pos = stats.queuePosition || queuePosition;
  const appUrl = (process.env.APP_URL || 'https://trysidekick.com').replace(/\/$/, '');
  const link = `${appUrl}/?ref=${referralCode}`;

  const more = REFERRALS_TO_REWARD - count;
  let statusLine;
  if (stats.rewardClaimed) {
    statusLine = `You have referred ${count} people and earned your reward (2 months free + front of line)!`;
  } else if (more <= 0) {
    statusLine = `You have referred ${count}/${REFERRALS_TO_REWARD} -- reward incoming!`;
  } else {
    const plural = more === 1 ? 'referral' : 'referrals';
    statusLine = `You have referred ${count}/${REFERRALS_TO_REWARD}. ${more} more ${plural} = skip the line + 2 months free.`;
  }

  return `Your Sidekick referral link:\n${link}\n\nQueue position: #${pos}\n${statusLine}`;
}

/**
 * Main inbound SMS handler.
 */
module.exports = async function handler(req, res) {
  // Only accept POST
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  // Validate Twilio signature
  if (!validateTwilioSignature(req)) {
    console.error('Invalid Twilio signature');
    return res.status(403).send('Forbidden');
  }

  const from = req.body?.From;
  const messageBody = (req.body?.Body || '').trim();
  const messageSid = req.body?.MessageSid;

  if (!from || !messageBody) {
    return res.status(400).send('Missing required fields');
  }

  // Rate limiting: 1 message per second per phone number
  const rateLimitKey = `sms:${from}`;
  const { allowed } = await checkRateLimit(rateLimitKey, 1, 1000);
  if (!allowed) {
    // Send friendly rate limit message and return 200 (so Twilio doesn't retry)
    await sendSms(from, ERROR_MESSAGES.rate_limit).catch(console.error);
    return res.status(200).send('OK');
  }

  let user = null;
  let replyText = '';
  let intent = INTENTS.UNKNOWN;
  let claudeModel = null;
  let tokensUsed = null;

  try {
    // Look up or create user
    user = await getUserByPhone(from);
    if (!user) {
      user = await createUser(from);
    }

    // Log the inbound message
    await logMessage({
      userId: user.id,
      direction: 'inbound',
      body: messageBody,
      intent: null, // will be updated after classification
      twilioSid: messageSid,
    });

    // Handle data deletion request first
    if (/^delete\s+(my\s+)?data\s*$/i.test(messageBody)) {
      const { deleteUser } = require('../../lib/supabase');
      await deleteUser(user.id);
      await sendSms(from, "Your account and all data have been permanently deleted. You can restart anytime by texting us again.");
      return res.status(200).send('OK');
    }

    // If user is in onboarding, handle that flow
    if (!user.onboarding_complete) {
      const result = await processOnboarding(user, messageBody);
      replyText = result.replyText;
      intent = INTENTS.ONBOARDING;
      user = result.updatedUser;
    } else {
      // Existing user — check for simple commands first
      const preClassified = classifyIntent(messageBody);

      // Handle CANCEL command
      if (preClassified === INTENTS.CANCEL) {
        const cancelIndex = parseCancelCommand(messageBody);
        if (cancelIndex !== null) {
          const posts = await getUpcomingPosts(user.id);
          const targetPost = posts[cancelIndex - 1];
          if (targetPost) {
            await cancelPost(targetPost.id, user.id);
            const remaining = posts.length - 1;
            replyText = `Post canceled. ${remaining} post${remaining !== 1 ? 's' : ''} remaining.`;
            intent = INTENTS.CANCEL;
          } else {
            replyText = `No post found at position ${cancelIndex}. Reply "What do I have coming up?" to see your schedule.`;
            intent = INTENTS.CANCEL;
          }
        }
      }

      // Handle LIST_SCHEDULE command
      else if (preClassified === INTENTS.LIST_SCHEDULE) {
        const posts = await getUpcomingPosts(user.id);
        replyText = formatPostsList(posts);
        intent = INTENTS.LIST_SCHEDULE;
      }

      // Handle REFERRAL link request
      else if (preClassified === INTENTS.REFERRAL) {
        replyText = await handleReferralRequest(user);
        intent = INTENTS.REFERRAL;
      }

      // For everything else, use Claude
      else {
        // Check generation quota before calling Claude
        if (!hasGenerationQuota(user)) {
          replyText = ERROR_MESSAGES.generation_limit(user.plan);
          intent = INTENTS.UNKNOWN;
        } else {
          // Load conversation history
          const history = await getRecentMessages(user.id, 20);

          // Check if this is a response to a pending draft
          const draftResult = await handleDraftResponse(user, messageBody, history);

          if (draftResult.handled) {
            replyText = draftResult.replyText;
            intent = draftResult.intent || INTENTS.APPROVE;
          } else {
            // Call Claude with full context
            const accounts = await getSocialAccounts(user.id);
            const platforms = accounts.map(a => a.platform);

            const aiResult = await generateResponse(user, messageBody, history, platforms);
            replyText = aiResult.reply_text;
            intent = aiResult.intent;
            claudeModel = aiResult.model;
            tokensUsed = aiResult.tokensUsed;

            // If Claude returned a post action, save the draft
            if (aiResult.action) {
              if (aiResult.action.type === 'draft_post' && aiResult.action.content) {
                await createScheduledPost({
                  userId: user.id,
                  platforms: aiResult.action.platform === 'all'
                    ? platforms.length > 0 ? platforms : ['instagram']
                    : [aiResult.action.platform || 'instagram'],
                  content: aiResult.action.content,
                  status: 'draft',
                  scheduledFor: null,
                });
              } else if (aiResult.action.type === 'schedule_post' && aiResult.action.content) {
                await createScheduledPost({
                  userId: user.id,
                  platforms: aiResult.action.platform === 'all'
                    ? platforms.length > 0 ? platforms : ['instagram']
                    : [aiResult.action.platform || 'instagram'],
                  content: aiResult.action.content,
                  status: 'queued',
                  scheduledFor: aiResult.action.scheduled_for || null,
                });
              }
            }

            // Increment generation counter
            await incrementGenerationsUsed(user.id).catch(console.error);
          }
        }
      }
    }

    // Send the reply
    const sentMessage = await sendSms(from, replyText);

    // Log the outbound message
    await logMessage({
      userId: user.id,
      direction: 'outbound',
      body: replyText,
      intent,
      twilioSid: sentMessage.sid,
      claudeModel,
      tokensUsed,
    });

    return res.status(200).send('OK');

  } catch (err) {
    console.error('Inbound SMS handler error:', err);

    // Try to send a user-friendly error message
    if (from) {
      await sendSms(from, ERROR_MESSAGES.general).catch(console.error);

      // Log the error response if we have a user
      if (user) {
        await logMessage({
          userId: user.id,
          direction: 'outbound',
          body: ERROR_MESSAGES.general,
          intent: 'error',
        }).catch(console.error);
      }
    }

    return res.status(200).send('OK'); // Return 200 to prevent Twilio retries
  }
};
