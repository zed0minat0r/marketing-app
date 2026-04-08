'use strict';

/**
 * GET /api/referral/track?ref=CODE
 *
 * Called when a visitor lands on the site via a referral link.
 * Sets a cookie with the referral code and redirects to the main page.
 * The convert endpoint reads this cookie when the visitor signs up.
 */

const { getClient } = require('../../lib/supabase');

const COOKIE_NAME = 'sidekick_ref';
const COOKIE_MAX_AGE_DAYS = 30;

/**
 * Validate that the referral code exists in the DB.
 * Returns the referrer user row or null.
 */
async function getReferrerByCode(code) {
  const { data, error } = await getClient()
    .from('users')
    .select('id, business_name, referral_code, queue_position, referral_count')
    .eq('referral_code', code)
    .single();

  if (error && error.code === 'PGRST116') return null;
  if (error) throw error;
  return data;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const code = (req.query?.ref || '').trim().toUpperCase();
  const appUrl = (process.env.APP_URL || 'https://trysidekick.com').replace(/\/$/, '');

  if (!code || !/^[A-Z0-9]{6}$/.test(code)) {
    // Invalid code format — redirect without setting cookie
    return res.redirect(302, appUrl);
  }

  try {
    const referrer = await getReferrerByCode(code);

    if (!referrer) {
      // Unknown code — redirect cleanly
      return res.redirect(302, appUrl);
    }

    // Set a cookie so the signup flow can credit this referral
    const maxAge = COOKIE_MAX_AGE_DAYS * 24 * 60 * 60;
    res.setHeader(
      'Set-Cookie',
      `${COOKIE_NAME}=${code}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Lax; Secure`
    );

    // Redirect to homepage (the landing page reads the cookie when user signs up)
    return res.redirect(302, appUrl);
  } catch (err) {
    console.error('referral/track error:', err);
    // Fail open — still redirect
    return res.redirect(302, appUrl);
  }
};
