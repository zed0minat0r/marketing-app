'use strict';

const { ONBOARDING_MESSAGES, BUSINESS_TYPES, TONE_OPTIONS } = require('./constants');
const {
  updateUser,
  getSocialAccounts,
  countCustomerPhotos,
} = require('./supabase');
const {
  createOAuthStartLink,
  normalizePlatform,
  platformLabel,
} = require('./oauth-link');

/**
 * Onboarding state machine.
 * Steps: name -> type -> tone -> connect -> photos -> done
 *
 * Each step:
 *   1. Validates/parses the user's input for the current step
 *   2. Stores the value in the DB
 *   3. Returns the next prompt or the completion message
 *
 * MMS attachments arriving during the `photos` step are handled by the
 * inbound webhook directly (it routes media to processInboundMedia + then
 * calls advancePhotoStep to keep onboarding moving). Pure-text replies to
 * the `photos` step (DONE / SKIP / anything else) go through here.
 */

function normalizeBusinessType(input) {
  const lower = input.toLowerCase().trim();
  for (const type of BUSINESS_TYPES) {
    if (lower.includes(type)) return type;
  }
  if (lower.includes('food') || lower.includes('cafe') || lower.includes('diner') || lower.includes('pizz')) return 'restaurant';
  if (lower.includes('shop') || lower.includes('store') || lower.includes('boutique')) return 'retail';
  if (lower.includes('consult') || lower.includes('agency') || lower.includes('salon') || lower.includes('plumb') || lower.includes('clean')) return 'service';
  if (lower.includes('online') || lower.includes('ecomm') || lower.includes('amazon') || lower.includes('shopify')) return 'ecommerce';
  return 'other';
}

function normalizeTone(input) {
  const lower = input.toLowerCase().trim();
  for (const tone of TONE_OPTIONS) {
    if (lower.includes(tone)) return tone;
  }
  if (lower.includes('fun') || lower.includes('relax') || lower.includes('chill')) return 'casual';
  if (lower.includes('formal') || lower.includes('corp') || lower.includes('business')) return 'professional';
  if (lower.includes('excit') || lower.includes('energet') || lower.includes('strong')) return 'bold';
  if (lower.includes('warm') || lower.includes('welcom') || lower.includes('approac')) return 'friendly';
  return 'professional';
}

/**
 * Build the default "connect" prompt with a Facebook OAuth link baked in.
 */
async function buildConnectPrompt(user) {
  try {
    const link = await createOAuthStartLink({ userId: user.id, platform: 'meta' });
    return ONBOARDING_MESSAGES.ask_connect.replace('{link}', link);
  } catch (err) {
    console.error('Failed to create default OAuth link during onboarding:', err);
    return "Next -- let's connect a social account so I can actually post for you.\n\nReply with one of: FACEBOOK, INSTAGRAM, GOOGLE, LINKEDIN, X, PINTEREST. Or reply SKIP to do this later.";
  }
}

/**
 * Build the completion message based on whether the user has at least one
 * connected social account.
 */
async function buildCompleteMessage(user) {
  let hasConnection = false;
  try {
    const accounts = await getSocialAccounts(user.id);
    hasConnection = (accounts || []).length > 0;
  } catch (err) {
    console.error('Failed to read social accounts at onboarding completion:', err);
  }
  const name = user.business_name || 'Your business';
  return hasConnection
    ? ONBOARDING_MESSAGES.complete(name)
    : ONBOARDING_MESSAGES.complete_no_connection(name);
}

/**
 * Mark onboarding complete and return the completion message.
 */
async function finalizeOnboarding(user) {
  const updated = await updateUser(user.id, {
    onboarding_step: 'done',
    onboarding_complete: true,
  });
  const replyText = await buildCompleteMessage(updated);
  return { replyText, done: true, updatedUser: updated };
}

/**
 * Process an onboarding message for a user (text only — MMS during 'photos'
 * is handled in the webhook).
 */
async function processOnboarding(user, messageBody) {
  const step = user.onboarding_step || 'name';
  const text = messageBody.trim();

  switch (step) {
    case 'name': {
      // First-message detection — a brand-new user texts "hi" / "hello" /
      // "hey" / a single short word — that's a greeting, not a business
      // name. Don't capture it; send the welcome + prompt for the name.
      const looksLikeGreeting = /^(hi|hello|hey|yo|sup|hola|howdy|good\s+(morning|afternoon|evening)|what.?s\s+up|\?+)$/i;
      if (looksLikeGreeting.test(text)) {
        return {
          replyText: ONBOARDING_MESSAGES.welcome,
          done: false,
          updatedUser: user,
        };
      }

      if (text.length < 2) {
        return {
          replyText: "Please enter your business name (at least 2 characters).",
          done: false,
          updatedUser: user,
        };
      }
      const businessName = text.slice(0, 100);
      const updated = await updateUser(user.id, {
        business_name: businessName,
        onboarding_step: 'type',
      });
      return {
        replyText: ONBOARDING_MESSAGES.ask_type(businessName),
        done: false,
        updatedUser: updated,
      };
    }

    case 'type': {
      const businessType = normalizeBusinessType(text);
      const updated = await updateUser(user.id, {
        business_type: businessType,
        onboarding_step: 'tone',
      });
      return {
        replyText: ONBOARDING_MESSAGES.ask_tone,
        done: false,
        updatedUser: updated,
      };
    }

    case 'tone': {
      const tone = normalizeTone(text);
      const updated = await updateUser(user.id, {
        tone,
        onboarding_step: 'connect',
      });
      const replyText = await buildConnectPrompt(updated);
      return {
        replyText,
        done: false,
        updatedUser: updated,
      };
    }

    case 'connect': {
      const upper = text.toUpperCase();
      if (upper === 'SKIP') {
        // Advance to photos step; they can still connect later via SMS.
        const updated = await updateUser(user.id, { onboarding_step: 'photos' });
        return {
          replyText: "No problem -- you can connect any time by texting \"Connect Facebook\" (or another platform).\n\n" + ONBOARDING_MESSAGES.ask_photos,
          done: false,
          updatedUser: updated,
        };
      }

      const platformKey = normalizePlatform(text);
      if (!platformKey) {
        return {
          replyText: ONBOARDING_MESSAGES.ask_connect_invalid,
          done: false,
          updatedUser: user,
        };
      }
      try {
        const link = await createOAuthStartLink({ userId: user.id, platform: platformKey });
        const label = platformLabel(platformKey, text);
        return {
          // Stay on the connect step until the OAuth callback flips the user
          // to 'photos' (see callback handler). If they tap the link AND
          // succeed, they'll see the photos prompt next time they text us.
          // If they pick another platform first, we just hand them a new link.
          replyText: ONBOARDING_MESSAGES.ask_connect_alt(label, link),
          done: false,
          updatedUser: user,
        };
      } catch (err) {
        console.error('Failed to create OAuth link in onboarding:', err);
        return {
          replyText: "Something went wrong generating that connect link. Please try again, or reply SKIP to do this later.",
          done: false,
          updatedUser: user,
        };
      }
    }

    case 'photos': {
      const upper = text.toUpperCase();
      if (upper === 'DONE' || upper === 'SKIP') {
        return finalizeOnboarding(user);
      }
      // Any other text during the photos step — gently nudge them.
      return {
        replyText: "Just text me a photo (or a few) when you're ready. Reply DONE when finished, or SKIP to do this later.",
        done: false,
        updatedUser: user,
      };
    }

    case 'done': {
      return {
        replyText: "You are already set up! Try: \"Write a post about our new special\"",
        done: true,
        updatedUser: user,
      };
    }

    default: {
      await updateUser(user.id, { onboarding_step: 'name' });
      return {
        replyText: ONBOARDING_MESSAGES.welcome,
        done: false,
        updatedUser: { ...user, onboarding_step: 'name' },
      };
    }
  }
}

/**
 * Called by the inbound webhook when MMS lands during the 'photos' step.
 * Returns the message we should send back.
 */
async function photoStepConfirmation(user) {
  let count = 0;
  try {
    count = await countCustomerPhotos(user.id);
  } catch {}
  return ONBOARDING_MESSAGES.photo_received_during_onboarding(count);
}

module.exports = {
  processOnboarding,
  finalizeOnboarding,
  photoStepConfirmation,
  buildConnectPrompt,
  normalizeTone,
};
