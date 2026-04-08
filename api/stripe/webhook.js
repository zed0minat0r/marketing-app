'use strict';

/**
 * POST /api/stripe/webhook
 *
 * Handles Stripe subscription webhook events.
 * Validates Stripe signature, then updates user plan and generation limits.
 *
 * Events handled:
 *   - customer.subscription.created
 *   - customer.subscription.updated
 *   - customer.subscription.deleted
 *   - invoice.payment_failed
 */

const stripe = require('stripe');
const { getClient, updateUser } = require('../../lib/supabase');
const { sendSms } = require('../sms/outbound');
const { PLAN_LIMITS } = require('../../lib/constants');

// Map Stripe price IDs to plan names
// These price IDs must match your actual Stripe price IDs in env vars
const PRICE_TO_PLAN = {
  [process.env.STRIPE_PRICE_STARTER]: 'starter',
  [process.env.STRIPE_PRICE_GROWTH]: 'growth',
  [process.env.STRIPE_PRICE_PRO]: 'pro',
};

function getPlanFromSubscription(subscription) {
  const priceId = subscription.items?.data?.[0]?.price?.id;
  return PRICE_TO_PLAN[priceId] || 'starter';
}

async function getUserByStripeId(stripeCustomerId) {
  const { data, error } = await getClient()
    .from('users')
    .select('*')
    .eq('stripe_customer_id', stripeCustomerId)
    .single();

  if (error && error.code === 'PGRST116') return null;
  if (error) throw error;
  return data;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not set');
    return res.status(500).json({ error: 'Webhook not configured' });
  }

  // Stripe requires the raw body for signature verification
  // Vercel provides the raw body via req.body when content-type is not parsed
  const sig = req.headers['stripe-signature'];
  if (!sig) {
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }

  let event;
  try {
    const stripeClient = stripe(process.env.STRIPE_SECRET_KEY);
    // For Vercel, we need to read the raw body
    // The body is a Buffer when using bodyParser: false in vercel.json
    const rawBody = req.body instanceof Buffer
      ? req.body
      : JSON.stringify(req.body);

    event = stripeClient.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('Stripe signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        const plan = getPlanFromSubscription(subscription);
        const generationsLimit = plan === 'pro' ? 999999 : PLAN_LIMITS[plan];

        const user = await getUserByStripeId(customerId);
        if (!user) {
          console.warn(`No user found for Stripe customer ${customerId}`);
          break;
        }

        const isUpgrade = user.plan !== plan;
        await updateUser(user.id, {
          plan,
          generations_limit: generationsLimit,
          stripe_subscription_id: subscription.id,
          // Reset usage counter on new billing period
          ...(subscription.current_period_start > Date.now() / 1000 - 86400
            ? { generations_used: 0 }
            : {}),
        });

        if (isUpgrade && user.phone) {
          const planDisplay = { starter: 'Starter', growth: 'Growth', pro: 'Pro' }[plan] || plan;
          const limit = plan === 'pro' ? 'unlimited' : `${generationsLimit}`;
          await sendSms(user.phone,
            `Plan updated to ${planDisplay}! You now have ${limit} post generations per month.`
          ).catch(console.error);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        const user = await getUserByStripeId(customerId);
        if (!user) break;

        // Downgrade to starter on cancellation
        await updateUser(user.id, {
          plan: 'starter',
          generations_limit: PLAN_LIMITS.starter,
          stripe_subscription_id: null,
        });

        if (user.phone) {
          await sendSms(user.phone,
            `Your Sidekick subscription was canceled. You are now on the free Starter plan (50 generations/month). Text UPGRADE to resubscribe.`
          ).catch(console.error);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const customerId = invoice.customer;

        const user = await getUserByStripeId(customerId);
        if (!user || !user.phone) break;

        await sendSms(user.phone,
          `Payment failed for your Sidekick subscription. Please update your payment method at sidekick.app/billing to keep your account active.`
        ).catch(console.error);
        break;
      }

      default:
        // Ignore unhandled events
        break;
    }

    return res.status(200).json({ received: true });

  } catch (err) {
    console.error('Stripe webhook handler error:', err);
    return res.status(500).json({ error: err.message });
  }
};
