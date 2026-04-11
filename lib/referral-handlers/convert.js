'use strict';

/**
 * POST /api/referral/convert
 *
 * Called when a referred user completes signup.
 * - Creates a referral record (pending -> converted)
 * - Credits the referrer: +1 referral_count, -50 queue_position
 * - If referrer hits 3 referrals: queue_position = 1, referral_reward_claimed = true
 * - Sends the referrer an SMS notification via Twilio
 *
 * Body:
 *   {
 *     referralCode: string,         -- the ref code from the signup cookie
 *     newUserPhone: string,         -- E.164 phone of the person who just signed up
 *     newUserEmail?: string         -- optional email
 *   }
 */

const { getClient, getUserByPhone, updateUser } = require('../supabase');
const { sendSms } = require('../../api/sms/outbound');

const REFERRALS_TO_REWARD = 3;
const QUEUE_JUMP_PER_REFERRAL = 50;

/**
 * Look up a user by referral code.
 */
async function getUserByReferralCode(code) {
  const { data, error } = await getClient()
    .from('users')
    .select('*')
    .eq('referral_code', code)
    .single();

  if (error && error.code === 'PGRST116') return null;
  if (error) throw error;
  return data;
}

/**
 * Check if a referral already exists for this phone/code pair to prevent double-crediting.
 */
async function referralExists(referrerUserId, referredPhone) {
  const { data, error } = await getClient()
    .from('referrals')
    .select('id')
    .eq('referrer_user_id', referrerUserId)
    .eq('referred_phone', referredPhone)
    .single();

  if (error && error.code === 'PGRST116') return false;
  if (error) throw error;
  return !!data;
}

/**
 * Insert a referral record.
 */
async function createReferral({ referrerUserId, referredEmail, referredPhone }) {
  const { data, error } = await getClient()
    .from('referrals')
    .insert({
      referrer_user_id: referrerUserId,
      referred_email: referredEmail || null,
      referred_phone: referredPhone || null,
      status: 'converted',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Credit the referrer using the DB function and return updated stats.
 */
async function creditReferrer(referrerId) {
  const { data, error } = await getClient().rpc('credit_referrer', {
    referrer_id_input: referrerId,
  });
  if (error) throw error;
  // credit_referrer returns a single row TABLE
  return data && data[0] ? data[0] : data;
}

/**
 * Build the SMS notification text to send to the referrer.
 */
function buildReferrerSms({ referredName, newCount, queuePosition, rewardClaimed }) {
  const name = referredName || 'Someone';
  const more = REFERRALS_TO_REWARD - newCount;

  if (rewardClaimed && newCount === REFERRALS_TO_REWARD) {
    // Just hit the reward threshold
    return `${name} just joined using your Sidekick link! You have referred ${newCount}/${REFERRALS_TO_REWARD} -- you have skipped to the front of the waitlist and earned 2 months free. We will be in touch soon!`;
  }

  if (rewardClaimed) {
    // Already had the reward, additional referrals
    return `${name} just joined using your Sidekick link! You have now referred ${newCount} people. Thanks for spreading the word!`;
  }

  const plural = more === 1 ? 'referral' : 'referrals';
  return `${name} just joined using your Sidekick link! You have referred ${newCount}/${REFERRALS_TO_REWARD}. ${more} more ${plural} to skip the waitlist + get 2 months free.`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { referralCode, newUserPhone, newUserEmail } = req.body || {};

  if (!referralCode || !newUserPhone) {
    return res.status(400).json({ error: 'referralCode and newUserPhone are required' });
  }

  const code = referralCode.trim().toUpperCase();

  if (!/^[A-Z0-9]{6}$/.test(code)) {
    return res.status(400).json({ error: 'Invalid referral code format' });
  }

  try {
    // Find the referrer
    const referrer = await getUserByReferralCode(code);
    if (!referrer) {
      return res.status(404).json({ error: 'Referral code not found' });
    }

    // Do not credit self-referral
    if (referrer.phone === newUserPhone) {
      return res.status(400).json({ error: 'Self-referral not allowed' });
    }

    // Prevent duplicate credits
    const alreadyExists = await referralExists(referrer.id, newUserPhone);
    if (alreadyExists) {
      return res.status(409).json({ error: 'Referral already recorded for this phone' });
    }

    // Look up the new user's name (may not be fully onboarded yet)
    let referredName = null;
    try {
      const newUser = await getUserByPhone(newUserPhone);
      if (newUser && newUser.business_name) {
        referredName = newUser.business_name;
      }
    } catch (_) {
      // Non-fatal — name is optional for the SMS
    }

    // Record the referral
    await createReferral({
      referrerUserId: referrer.id,
      referredEmail: newUserEmail || null,
      referredPhone: newUserPhone,
    });

    // Credit the referrer (uses DB function: +1 count, -50 position, reward at 3)
    const stats = await creditReferrer(referrer.id);

    const newCount = stats?.new_referral_count ?? (referrer.referral_count + 1);
    const newQueuePosition = stats?.new_queue_position ?? referrer.queue_position;
    const rewardClaimed = stats?.reward_claimed ?? false;

    // Send SMS notification to referrer
    try {
      const smsText = buildReferrerSms({
        referredName,
        newCount,
        queuePosition: newQueuePosition,
        rewardClaimed,
      });
      await sendSms(referrer.phone, smsText);
    } catch (smsErr) {
      // Non-fatal — log but do not fail the response
      console.error('Failed to send referral SMS to referrer:', smsErr.message);
    }

    return res.status(200).json({
      success: true,
      referrerId: referrer.id,
      newReferralCount: newCount,
      newQueuePosition,
      rewardClaimed,
    });
  } catch (err) {
    console.error('referral/convert error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
