'use strict';

/**
 * Shared post-OAuth-connect helper.
 *
 * After any OAuth callback succeeds and stores the social account row(s),
 * the callback handler calls notifyConnected() to:
 *   1. Send the right SMS — onboarding step 'connect' → advance to 'photos'
 *      with the photo-library prompt; otherwise the standard "Connected!" msg.
 *   2. Advance the user's onboarding_step row when applicable.
 */

const { sendSms } = require('../api/sms/outbound');
const { getClient, updateUser } = require('./supabase');
const { ONBOARDING_MESSAGES } = require('./constants');

/**
 * @param {Object} args
 * @param {string} args.userId
 * @param {string} args.platformLabel   - "Facebook + Instagram", "LinkedIn", etc.
 * @param {string[]} [args.accountsList] - Display names of connected accounts
 */
async function notifyConnected({ userId, platformLabel, accountsList = [] }) {
  const { data: user } = await getClient()
    .from('users')
    .select('id, phone, business_name, onboarding_complete, onboarding_step')
    .eq('id', userId)
    .single();

  if (!user || !user.phone) return;

  const inConnectStep = !user.onboarding_complete && user.onboarding_step === 'connect';

  if (inConnectStep) {
    // Advance to 'photos' and ship the photo-library prompt as the success SMS.
    await updateUser(userId, { onboarding_step: 'photos' }).catch(err =>
      console.error('Failed to advance onboarding step after OAuth connect:', err)
    );
    const accountsLine = accountsList.length
      ? `\n\nConnected: ${accountsList.join(', ')}`
      : '';
    await sendSms(user.phone,
      `Connected to ${platformLabel}!${accountsLine}\n\n${ONBOARDING_MESSAGES.ask_photos}`
    );
    return;
  }

  // Post-onboarding connect — standard confirmation.
  const accountsLine = accountsList.length
    ? accountsList.join(', ')
    : platformLabel;
  await sendSms(user.phone,
    `Connected! I can now post to: ${accountsLine}\n\nTry: "Write a post about our latest special"`
  );
}

module.exports = { notifyConnected };
