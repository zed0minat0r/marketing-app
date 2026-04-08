'use strict';

const { ONBOARDING_MESSAGES, BUSINESS_TYPES, TONE_OPTIONS } = require('./constants');
const { updateUser } = require('./supabase');

/**
 * Onboarding state machine.
 * Each step:
 *   1. Validates/parses the user's input for the current step
 *   2. Stores the value in the DB
 *   3. Returns the next prompt or the completion message
 *
 * Steps: name -> type -> tone -> done
 */

function normalizeBusinessType(input) {
  const lower = input.toLowerCase().trim();
  for (const type of BUSINESS_TYPES) {
    if (lower.includes(type)) return type;
  }
  // Accept close matches
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
  // Accept synonyms
  if (lower.includes('fun') || lower.includes('relax') || lower.includes('chill')) return 'casual';
  if (lower.includes('formal') || lower.includes('corp') || lower.includes('business')) return 'professional';
  if (lower.includes('excit') || lower.includes('energet') || lower.includes('strong')) return 'bold';
  if (lower.includes('warm') || lower.includes('welcom') || lower.includes('approac')) return 'friendly';
  return 'professional'; // Default
}

/**
 * Process an onboarding message for a user.
 *
 * @param {Object} user - User record from DB
 * @param {string} messageBody - The user's SMS text
 * @returns {Promise<{replyText: string, done: boolean, updatedUser: Object}>}
 */
async function processOnboarding(user, messageBody) {
  const step = user.onboarding_step || 'name';
  const text = messageBody.trim();

  switch (step) {
    case 'name': {
      // Validate: name must be at least 2 characters
      if (text.length < 2) {
        return {
          replyText: "Please enter your business name (at least 2 characters).",
          done: false,
          updatedUser: user,
        };
      }

      const businessName = text.slice(0, 100); // Cap length
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
        onboarding_step: 'done',
        onboarding_complete: true,
      });

      return {
        replyText: ONBOARDING_MESSAGES.complete(updated.business_name || 'Your business'),
        done: true,
        updatedUser: updated,
      };
    }

    case 'done': {
      // Already onboarded — this shouldn't be reached via this function
      return {
        replyText: "You are already set up! Try: \"Write a post about our new special\"",
        done: true,
        updatedUser: user,
      };
    }

    default: {
      // Unexpected step — reset to name
      await updateUser(user.id, { onboarding_step: 'name' });
      return {
        replyText: ONBOARDING_MESSAGES.welcome,
        done: false,
        updatedUser: { ...user, onboarding_step: 'name' },
      };
    }
  }
}

module.exports = { processOnboarding };
