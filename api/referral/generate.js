'use strict';

/**
 * POST /api/referral/generate
 *
 * Generate (or return existing) referral code + link for a user.
 * Called after a user completes signup/onboarding.
 *
 * Body: { phone } — E.164 phone number of the user
 * Returns: { referralCode, referralLink, queuePosition, referralCount }
 */

const {
  getUserByPhone,
  getClient,
  updateUser,
} = require('../../lib/supabase');

/**
 * Generate a unique 6-char alphanumeric referral code via the DB function.
 */
async function generateCode() {
  const { data, error } = await getClient().rpc('generate_referral_code');
  if (error) throw error;
  return data;
}

/**
 * Assign a queue position to a user via the DB function.
 */
async function assignQueuePosition(userId) {
  const { data, error } = await getClient().rpc('assign_queue_position', {
    user_id_input: userId,
  });
  if (error) throw error;
  return data;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { phone } = req.body || {};
  if (!phone) {
    return res.status(400).json({ error: 'phone is required' });
  }

  try {
    const user = await getUserByPhone(phone);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let { referral_code, queue_position, referral_count } = user;

    // Generate code if user does not have one yet
    if (!referral_code) {
      referral_code = await generateCode();
      await updateUser(user.id, { referral_code });
    }

    // Assign queue position if not set
    if (!queue_position) {
      queue_position = await assignQueuePosition(user.id);
    }

    const appUrl = (process.env.APP_URL || 'https://trysidekick.com').replace(/\/$/, '');
    const referralLink = `${appUrl}/?ref=${referral_code}`;

    return res.status(200).json({
      referralCode: referral_code,
      referralLink,
      queuePosition: queue_position,
      referralCount: referral_count || 0,
    });
  } catch (err) {
    console.error('referral/generate error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
