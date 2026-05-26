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
const { processInboundMedia, extractMedia } = require('../../lib/photo-intake');
const { resolveComplianceAction, COMPLIANCE_REPLIES } = require('../../lib/sms-compliance');
const { scheduleSocialPublish, cancelScheduledPublish } = require('../../lib/qstash-publisher');
const {
  getUserByPhone,
  createUser,
  updateUser,
  logMessage,
  getRecentMessages,
  getSocialAccounts,
  createScheduledPost,
  getMostRecentDraftPost,
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

      // Flip the existing draft row to 'queued' — DO NOT create a new row
      // from the AI's reply text, which contains the "Reply YES to post"
      // wrapper that would otherwise end up in the actual post body.
      const draft = await getMostRecentDraftPost(user.id);
      if (!draft) {
        return {
          handled: true,
          replyText: "I could not find a draft to approve. Try \"Write a post about [topic]\" to start a new one.",
          intent: INTENTS.APPROVE,
        };
      }

      const platforms = accounts.map(a => a.platform);

      // Schedule with QStash so the publish job actually fires. delay=null
      // = "as soon as possible" (1s in the publisher).
      let qstashMessageId = null;
      try {
        const { messageId } = await scheduleSocialPublish({
          postId: draft.id,
          scheduledFor: null,
        });
        qstashMessageId = messageId;
      } catch (err) {
        console.error('QStash enqueue failed for immediate publish:', err.message);
        // Don't fail the user-facing flow — leave the row as queued, the user
        // can retry. Worth surfacing the error in admin logs.
      }

      await updateScheduledPost(draft.id, {
        platforms,
        status: 'queued',
        qstash_message_id: qstashMessageId,
        scheduled_for: null,
      });

      return {
        handled: true,
        replyText: `Got it! Your post is queued for publishing to ${platforms.join(' & ')}.\n\nI will let you know when it is live.`,
        intent: INTENTS.APPROVE,
        postId: draft.id,
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
  const appUrl = (process.env.APP_URL || 'https://sidekik.com').replace(/\/$/, '');
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
  const numMedia = parseInt(req.body?.NumMedia || '0', 10) || 0;
  const hasMedia = numMedia > 0;

  // MMS may arrive with media-only and an empty body — that's valid.
  if (!from || (!messageBody && !hasMedia)) {
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

    // ---- Carrier compliance: STOP / HELP / START ----
    // These keywords are legally required to be honored on toll-free numbers.
    // Match the BARE keyword only (so "CANCEL 1" still cancels a post, etc.)
    // and force-send the compliance ack even if the user is opted out — these
    // messages ARE the opt-in/opt-out acknowledgments.
    const complianceAction = resolveComplianceAction(messageBody);
    if (complianceAction === 'stop') {
      await updateUser(user.id, { opted_out_at: new Date().toISOString() }).catch(err =>
        console.error('Failed to mark user opted out:', err)
      );
      await sendSms(from, COMPLIANCE_REPLIES.stop, { force: true }).catch(console.error);
      await logMessage({
        userId: user.id, direction: 'outbound', body: COMPLIANCE_REPLIES.stop, intent: INTENTS.COMPLIANCE_STOP,
      }).catch(console.error);
      return res.status(200).send('OK');
    }
    if (complianceAction === 'start') {
      await updateUser(user.id, { opted_out_at: null }).catch(err =>
        console.error('Failed to clear opt-out:', err)
      );
      await sendSms(from, COMPLIANCE_REPLIES.start, { force: true }).catch(console.error);
      await logMessage({
        userId: user.id, direction: 'outbound', body: COMPLIANCE_REPLIES.start, intent: INTENTS.COMPLIANCE_START,
      }).catch(console.error);
      return res.status(200).send('OK');
    }
    if (complianceAction === 'help') {
      await sendSms(from, COMPLIANCE_REPLIES.help, { force: true }).catch(console.error);
      await logMessage({
        userId: user.id, direction: 'outbound', body: COMPLIANCE_REPLIES.help, intent: INTENTS.COMPLIANCE_HELP,
      }).catch(console.error);
      return res.status(200).send('OK');
    }

    // Handle data deletion request first
    if (/^delete\s+(my\s+)?data\s*$/i.test(messageBody)) {
      const { deleteUser } = require('../../lib/supabase');
      await deleteUser(user.id);
      await sendSms(from, "Your account and all data have been permanently deleted. You can restart anytime by texting us again.");
      return res.status(200).send('OK');
    }

    // ---- MMS: photo intake flow ----
    // Inbound MMS lands as a separate path from text: we save each attachment
    // to the user's photo library and reply with a confirmation.
    if (hasMedia) {
      const inPhotoStep = !user.onboarding_complete && user.onboarding_step === 'photos';
      // Block photo intake for users mid-onboarding EXCEPT during the photos
      // step, where MMS is the whole point.
      if (!user.onboarding_complete && !inPhotoStep) {
        replyText = "Got your photo, but please finish quick setup first. " +
                    "Reply with your business name to continue.";
        intent = INTENTS.ONBOARDING;
      } else {
        const result = await processInboundMedia({
          user,
          twilioSid: messageSid,
          caption: messageBody,
          body: req.body,
          waitForTagging: !user.first_photo_received_at, // wait only on the first
        });

        if (result.savedCount === 0) {
          if (result.capHit) {
            replyText = "You've hit your daily photo limit. Send more tomorrow — your existing library is still good.";
          } else {
            replyText = result.skippedCount > 0
              ? "I could not save that attachment. We only support image files up to 10MB (JPG, PNG, HEIC, WebP)."
              : "Got your message but no photo was attached.";
          }
          intent = INTENTS.UNKNOWN;
        } else {
          const tag = result.primaryTagGuess;
          const isFirstPhoto = !user.first_photo_received_at;

          if (inPhotoStep) {
            // MMS during the onboarding 'photos' step — reply with simple
            // count and stay on this step until they text DONE/SKIP.
            const { photoStepConfirmation } = require('../../lib/onboarding');
            replyText = await photoStepConfirmation(user);
            if (isFirstPhoto) {
              await updateUser(user.id, {
                first_photo_received_at: new Date().toISOString(),
              }).catch(err => console.error('Failed to mark first_photo_received_at:', err));
            }
          } else if (isFirstPhoto) {
            // First-photo onboarding prompt — asks how they want photo intake
            // to behave from now on. Persists later when they answer DRAFT/LIBRARY.
            const tagPhrase = tag ? `that ${tag} shot` : 'your photo';
            replyText =
              `Saved ${tagPhrase} to your library.\n\n` +
              `Want me to draft a post from photos you text me, or just keep them in your library for later?\n\n` +
              `Reply DRAFT or LIBRARY.`;
            await updateUser(user.id, {
              first_photo_received_at: new Date().toISOString(),
            }).catch(err => console.error('Failed to mark first_photo_received_at:', err));
          } else if (user.confirm_photos_enabled !== false) {
            const tagPhrase = tag ? `${tag} shot` : 'photo';
            const countSuffix = result.savedCount > 1 ? ` (+${result.savedCount - 1} more)` : '';
            replyText = `Got it — saved that ${tagPhrase} to your library${countSuffix}.`;
          } else {
            // User has confirmations off — reply 200 OK without sending anything.
            replyText = '';
          }
          intent = INTENTS.PHOTO_INTAKE;
        }
      }

      if (replyText) {
        const sentMessage = await sendSms(from, replyText);
        await logMessage({
          userId: user.id,
          direction: 'outbound',
          body: replyText,
          intent,
          twilioSid: sentMessage.sid,
        }).catch(console.error);
      }
      return res.status(200).send('OK');
    }

    // ---- Photo-intake follow-up: DRAFT / LIBRARY response ----
    // After their very first photo, we ask how they want intake to behave.
    // Answer is one word — match before falling into the normal flow.
    if (user.first_photo_received_at && user.auto_draft_on_photo === null) {
      const trimmed = messageBody.trim().toUpperCase();
      if (trimmed === 'DRAFT' || trimmed === 'LIBRARY') {
        const autoDraft = (trimmed === 'DRAFT');
        await updateUser(user.id, { auto_draft_on_photo: autoDraft });
        replyText = autoDraft
          ? "Got it. From now on, every photo you text me, I will draft a post for you to approve."
          : "Got it. Photos will just save to your library for later — I won't auto-draft.";
        intent = INTENTS.PHOTO_INTAKE_PREF;

        const sentMessage = await sendSms(from, replyText);
        await logMessage({
          userId: user.id,
          direction: 'outbound',
          body: replyText,
          intent,
          twilioSid: sentMessage.sid,
        }).catch(console.error);
        return res.status(200).send('OK');
      }
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
            // Cancel the pending QStash job (best-effort — may already have
            // fired or never been enqueued). Then mark the row canceled.
            if (targetPost.qstash_message_id) {
              await cancelScheduledPublish(targetPost.qstash_message_id);
            }
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

      // Handle CONNECT <platform> intent: generate a one-time OAuth link
      // and text it back. Falls through to Claude if no platform is identified.
      else if (preClassified === INTENTS.CONNECT) {
        const { createOAuthStartLink, normalizePlatform, platformLabel } =
          require('../../lib/oauth-link');
        const platformKey = normalizePlatform(messageBody)
          // Also try just the platform word inside a "connect X" phrase
          || normalizePlatform(messageBody.replace(/^(connect|link|add|attach)\s+/i, '').replace(/\s+(account|please)?$/i, ''));

        if (platformKey) {
          try {
            const link = await createOAuthStartLink({ userId: user.id, platform: platformKey });
            const label = platformLabel(platformKey, messageBody);
            replyText = `Tap to connect ${label}:\n${link}\n\nLink expires in 15 minutes.`;
            intent = INTENTS.CONNECT;
          } catch (err) {
            console.error('Failed to create OAuth link:', err);
            replyText = "I could not generate a connect link right now. Please try again in a moment.";
            intent = INTENTS.CONNECT;
          }
        } else {
          replyText = "Which platform? Try: \"Connect Facebook\", \"Connect Instagram\", \"Connect Google\", \"Connect LinkedIn\", \"Connect X\", or \"Connect Pinterest\".";
          intent = INTENTS.CONNECT;
        }
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
                // Persist the queued post AND enqueue a QStash job at the
                // scheduled time so the publish handler actually fires.
                const scheduledPost = await createScheduledPost({
                  userId: user.id,
                  platforms: aiResult.action.platform === 'all'
                    ? platforms.length > 0 ? platforms : ['instagram']
                    : [aiResult.action.platform || 'instagram'],
                  content: aiResult.action.content,
                  status: 'queued',
                  scheduledFor: aiResult.action.scheduled_for || null,
                });

                try {
                  const { messageId } = await scheduleSocialPublish({
                    postId: scheduledPost.id,
                    scheduledFor: aiResult.action.scheduled_for || null,
                  });
                  await updateScheduledPost(scheduledPost.id, {
                    qstash_message_id: messageId,
                  });
                } catch (err) {
                  console.error('QStash enqueue failed for scheduled post:', err.message);
                  // Mark as failed-to-schedule so admin can see / retry
                  await updateScheduledPost(scheduledPost.id, {
                    status: 'failed',
                    error_message: `QStash enqueue failed: ${err.message}`,
                  }).catch(() => {});
                }
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
