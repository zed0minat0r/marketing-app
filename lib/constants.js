'use strict';

// Supported social platforms
const SUPPORTED_PLATFORMS = [
  'facebook',
  'instagram',
  'twitter',
  'linkedin',
  'pinterest',
  'google',
];

// Plan limits
const PLAN_LIMITS = {
  starter: 50,
  growth: 200,
  pro: Infinity,
};

const PLAN_NAMES = {
  starter: 'Starter ($49/mo)',
  growth: 'Growth ($99/mo)',
  pro: 'Pro ($199/mo)',
};

// Onboarding steps in order
const ONBOARDING_STEPS = ['name', 'type', 'tone', 'connect', 'photos', 'done'];

const BUSINESS_TYPES = ['restaurant', 'retail', 'service', 'ecommerce', 'other'];
const TONE_OPTIONS = ['casual', 'professional', 'bold', 'friendly'];

// Intent categories
const INTENTS = {
  ONBOARDING: 'onboarding',
  POST: 'post',
  SCHEDULE: 'schedule',
  ANALYTICS: 'analytics',
  HELP: 'help',
  CONNECT: 'connect',
  CANCEL: 'cancel',
  APPROVE: 'approve',
  EDIT: 'edit',
  SKIP: 'skip',
  LIST_SCHEDULE: 'list_schedule',
  DELETE_DATA: 'delete_data',
  REFERRAL: 'referral',
  ONBOARDING: 'onboarding',
  PHOTO_INTAKE: 'photo_intake',
  PHOTO_INTAKE_PREF: 'photo_intake_pref',
  COMPLIANCE_STOP: 'compliance_stop',
  COMPLIANCE_START: 'compliance_start',
  COMPLIANCE_HELP: 'compliance_help',
  UNKNOWN: 'unknown',
};

// Rate limit config (per phone number)
const RATE_LIMITS = {
  sms_inbound: { requests: 1, window: 1000 }, // 1 per second
  ai_generate: { requests: 10, window: 60000 }, // 10 per minute
  oauth: { requests: 5, window: 3600000 }, // 5 per hour
};

// Claude models
const CLAUDE_MODELS = {
  fast: 'claude-sonnet-4-5',
  powerful: 'claude-opus-4-5',
};

// System prompt builder
function buildSystemPrompt(user, connectedPlatforms) {
  const platforms = connectedPlatforms && connectedPlatforms.length > 0
    ? connectedPlatforms.join(', ')
    : 'none connected yet';

  const generationsLeft = user.plan === 'pro'
    ? 'unlimited'
    : `${Math.max(0, (user.generations_limit || PLAN_LIMITS[user.plan] || 50) - (user.generations_used || 0))} generations left this month`;

  return `You are Sidekick, an AI marketing assistant for small businesses. You communicate exclusively via SMS. Keep responses under 300 characters when possible (SMS segment limit is 160 chars; 2 segments max preferred). Be direct and conversational — you are texting, not writing an email.

Business context:
- Name: ${user.business_name || 'Not set'}
- Type: ${user.business_type || 'Not set'}
- Tone: ${user.tone || 'professional'}
- Connected platforms: ${platforms}
- Plan: ${PLAN_NAMES[user.plan] || user.plan} (${generationsLeft})

You can:
1. Draft social media posts (user must approve before posting)
2. Schedule posts for later
3. Provide marketing tips tailored to their business type
4. Summarize engagement analytics
5. Help connect social media accounts (Facebook, Instagram, LinkedIn, Google Business, X, Pinterest)
6. Save photos the user texts in to their photo library — they're tagged and auto-enhanced

The user has a photo library built from photos they text directly to this number (MMS). When they ask for an image post, the most recent library photo is used automatically — you do NOT need to ask them for an image URL. If their library is empty and they want an image-required post (Instagram, Pinterest, Google Business), instruct them to "text me a few photos of your work or space first."

When drafting posts:
- Match the user's tone preference (${user.tone || 'professional'})
- Include relevant hashtags
- Keep it platform-appropriate (LinkedIn = longer/professional, X = ≤280 chars, IG = caption + hashtag-friendly)
- Always end with: "Reply YES to post, EDIT to change, LATER to schedule, or SKIP to cancel."

Never post without explicit user approval (YES response).

When user says YES/EDIT/SKIP/LATER, recognize it as a response to the last post draft.

Respond ONLY with valid JSON in this exact format — no extra text, no markdown:
{
  "reply_text": "Your SMS reply text here",
  "intent": "one of: post|schedule|analytics|help|connect|cancel|approve|edit|skip|list_schedule|unknown",
  "action": null
}

For post drafts, action should be:
{
  "type": "draft_post",
  "platform": "facebook|instagram|twitter|linkedin|pinterest|google|all",
  "content": "the post content",
  "scheduled_for": null
}

For schedule actions, action should be:
{
  "type": "schedule_post",
  "platform": "facebook|instagram|twitter|linkedin|pinterest|google|all",
  "content": "the post content",
  "scheduled_for": "ISO 8601 datetime string"
}`;
}

// Onboarding prompts
const ONBOARDING_MESSAGES = {
  welcome: "Welcome to Sidekick! I am your AI marketing team, right here in your texts.\n\nFirst -- what is your business called?",
  ask_type: (name) => `${name} -- great name! What kind of business?\n(restaurant, retail, service, ecommerce, other)`,
  ask_tone: "And how should your marketing sound?\n(casual, professional, bold, friendly)",

  // Step 4 — connect first platform. Default suggestion is Facebook (single
  // OAuth grants both Facebook Page and Instagram posting rights). They can
  // text another platform to pick differently, or SKIP to defer.
  ask_connect: "Next -- let's connect a social account so I can actually post for you.\n\nTap below to connect Facebook + Instagram together:\n{link}\n\nOr reply: INSTAGRAM, GOOGLE, LINKEDIN, X, PINTEREST to pick a different one. Reply SKIP to do this later.",

  // Sent after the user picks a non-default platform.
  ask_connect_alt: (label, link) => `Tap below to connect ${label}:\n${link}\n\nOr reply with a different platform name. Reply SKIP to do this later.`,

  ask_connect_invalid: "I did not recognize that platform. Try: INSTAGRAM, FACEBOOK, GOOGLE, LINKEDIN, X, PINTEREST, or SKIP.",

  // Step 5 — photo library kickoff. We ask for 3-5 but accept any (1 is enough
  // to advance) and accept DONE as an explicit move-on.
  ask_photos: "Awesome -- one last thing. Text me 3-5 photos of your space, products, or finished work -- anything you'd want to show off. I'll save them so I can use them in posts later.\n\nReply DONE when you're finished, or SKIP to do this later.",

  photo_received_during_onboarding: (count) => count === 1
    ? "Got it -- 1 photo saved. Keep them coming, or reply DONE when finished."
    : `Got it -- ${count} photos saved. Keep them coming, or reply DONE when finished.`,

  complete: (name) => `All set! ${name} is ready to roll.\n\nHere is what I can do:\n- Write social posts (just say "post about our Friday special")\n- Schedule content for any day/time\n- Auto-publish to your connected accounts\n- Track your marketing performance\n\nText me a photo anytime to add to your library. Text "Connect <platform>" to add more accounts.`,

  complete_no_connection: (name) => `All set! ${name} is ready.\n\nOne thing -- you haven't connected a social account yet, so I can draft posts but can't publish them. Text "Connect Facebook" (or Instagram / Google / LinkedIn / X / Pinterest) when you're ready.\n\nIn the meantime, text "Write a post about [topic]" and I'll draft something.`,
};

// Error messages
const ERROR_MESSAGES = {
  rate_limit: "Slow down! Wait a moment before sending another message.",
  generation_limit: (plan) => `You have used all your generations this month on the ${plan} plan. Reply UPGRADE to increase your limit.`,
  general: "Something went wrong on our end. Please try again in a moment.",
  not_onboarded: "Please complete setup first. What is your business name?",
};

module.exports = {
  SUPPORTED_PLATFORMS,
  PLAN_LIMITS,
  PLAN_NAMES,
  ONBOARDING_STEPS,
  BUSINESS_TYPES,
  TONE_OPTIONS,
  INTENTS,
  RATE_LIMITS,
  CLAUDE_MODELS,
  buildSystemPrompt,
  ONBOARDING_MESSAGES,
  ERROR_MESSAGES,
};
