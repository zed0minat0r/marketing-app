'use strict';

/**
 * seed.js
 *
 * Populates the local Postgres database with representative test data:
 *   - 5 users at different onboarding stages
 *   - 20 conversations (mix of inbound/outbound, various intents)
 *   - 3 social accounts (one per user for the first 3 users)
 *   - 5 scheduled posts (mix of statuses)
 *
 * Usage:
 *   node dev/seed.js
 *
 * Requires the DATABASE_URL env var (or uses the default docker-compose DB):
 *   DATABASE_URL=postgresql://sidekick:sidekick_dev@localhost:5432/sidekick
 */

const { Client } = require('pg');

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://sidekick:sidekick_dev@localhost:5432/sidekick';

// =============================================
// HELPERS
// =============================================

function randomUUID() {
  // Node 14.17+ has crypto.randomUUID; fall back for older versions
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  const { randomBytes } = require('crypto');
  const b = randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = b.toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function hoursAgo(n) {
  const d = new Date();
  d.setHours(d.getHours() - n);
  return d.toISOString();
}

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

// =============================================
// SEED DATA
// =============================================

const USERS = [
  {
    id: randomUUID(),
    phone: '+14845551001',
    business_name: "Mike's Pizza",
    business_type: 'restaurant',
    tone: 'friendly',
    timezone: 'America/New_York',
    plan: 'growth',
    onboarding_complete: true,
    onboarding_step: 'done',
    generations_used: 18,
    generations_limit: 150,
    created_at: daysAgo(30),
  },
  {
    id: randomUUID(),
    phone: '+12125552002',
    business_name: 'Bloom Boutique',
    business_type: 'retail',
    tone: 'casual',
    timezone: 'America/Chicago',
    plan: 'pro',
    onboarding_complete: true,
    onboarding_step: 'done',
    generations_used: 42,
    generations_limit: 500,
    created_at: daysAgo(14),
  },
  {
    id: randomUUID(),
    phone: '+13105553003',
    business_name: 'Apex Fitness',
    business_type: 'service',
    tone: 'bold',
    timezone: 'America/Los_Angeles',
    plan: 'starter',
    onboarding_complete: true,
    onboarding_step: 'done',
    generations_used: 7,
    generations_limit: 50,
    created_at: daysAgo(7),
  },
  {
    id: randomUUID(),
    phone: '+17025554004',
    business_name: null,
    business_type: null,
    tone: 'professional',
    timezone: 'America/New_York',
    plan: 'starter',
    onboarding_complete: false,
    onboarding_step: 'type',
    generations_used: 0,
    generations_limit: 50,
    created_at: daysAgo(2),
  },
  {
    id: randomUUID(),
    phone: '+16465555005',
    business_name: null,
    business_type: null,
    tone: 'professional',
    timezone: 'America/New_York',
    plan: 'starter',
    onboarding_complete: false,
    onboarding_step: 'name',
    generations_used: 0,
    generations_limit: 50,
    created_at: hoursAgo(3),
  },
];

function buildConversations(users) {
  const u1 = users[0]; // Mike's Pizza — active
  const u2 = users[1]; // Bloom Boutique — active
  const u3 = users[2]; // Apex Fitness — active
  const u4 = users[3]; // mid-onboarding
  const u5 = users[4]; // just signed up

  return [
    // Mike's Pizza — full conversation history
    { user_id: u1.id, direction: 'inbound', body: 'Post about our lunch special', intent: 'post', created_at: daysAgo(6) },
    { user_id: u1.id, direction: 'outbound', body: "Here's a draft for Instagram and Facebook:\n\"Lunch just got better! 🍕 Our daily special...\"", intent: 'post', created_at: daysAgo(6) },
    { user_id: u1.id, direction: 'inbound', body: 'approve', intent: 'approve', created_at: daysAgo(6) },
    { user_id: u1.id, direction: 'outbound', body: 'Posted! Your lunch special is live on Instagram and Facebook.', intent: 'approve', created_at: daysAgo(6) },
    { user_id: u1.id, direction: 'inbound', body: 'Schedule a post for Friday 6pm about our weekend special', intent: 'schedule', created_at: daysAgo(4) },
    { user_id: u1.id, direction: 'outbound', body: "Got it! Here's a draft for your Friday 6pm post:\n\"Weekend vibes start now! 🎉\"", intent: 'schedule', created_at: daysAgo(4) },
    { user_id: u1.id, direction: 'inbound', body: 'analytics', intent: 'analytics', created_at: daysAgo(2) },
    { user_id: u1.id, direction: 'outbound', body: "This week's highlights:\n• 3 posts published\n• Est. reach: 1,240 people\n• Top post: lunch special (47 likes)", intent: 'analytics', created_at: daysAgo(2) },

    // Bloom Boutique — recent posts
    { user_id: u2.id, direction: 'inbound', body: 'new arrivals are here! spring collection just dropped', intent: 'post', created_at: daysAgo(3) },
    { user_id: u2.id, direction: 'outbound', body: "Spring has arrived at Bloom Boutique! ✨ Our brand new spring collection just dropped...", intent: 'post', created_at: daysAgo(3) },
    { user_id: u2.id, direction: 'inbound', body: 'looks great approve', intent: 'approve', created_at: daysAgo(3) },
    { user_id: u2.id, direction: 'outbound', body: 'Posted to Instagram and Facebook! Your spring collection announcement is live.', intent: 'approve', created_at: daysAgo(3) },
    { user_id: u2.id, direction: 'inbound', body: 'connect instagram', intent: 'connect', created_at: daysAgo(10) },
    { user_id: u2.id, direction: 'outbound', body: 'Click this link to connect your Instagram: https://app.sidekick.ai/oauth/meta/start?token=abc123', intent: 'connect', created_at: daysAgo(10) },

    // Apex Fitness
    { user_id: u3.id, direction: 'inbound', body: 'Post about our 30-day challenge starting Monday', intent: 'post', created_at: daysAgo(1) },
    { user_id: u3.id, direction: 'outbound', body: "The 30-Day Challenge is HERE 💪 Starting Monday, transform your body...", intent: 'post', created_at: daysAgo(1) },
    { user_id: u3.id, direction: 'inbound', body: 'edit — make it shorter', intent: 'edit', created_at: daysAgo(1) },
    { user_id: u3.id, direction: 'outbound', body: "30-Day Challenge starts MONDAY. Are you in? 💪 DM us to sign up.", intent: 'edit', created_at: daysAgo(1) },

    // Mid-onboarding user
    { user_id: u4.id, direction: 'inbound', body: 'Rivera Tacos', intent: 'onboarding', created_at: daysAgo(2) },
    { user_id: u4.id, direction: 'outbound', body: "Love it! What type of business is Rivera Tacos? (restaurant / retail / service / ecommerce)", intent: 'onboarding', created_at: daysAgo(2) },

    // Just signed up
    { user_id: u5.id, direction: 'inbound', body: 'hi', intent: 'onboarding', created_at: hoursAgo(3) },
    { user_id: u5.id, direction: 'outbound', body: "Welcome to Sidekick! I'm your AI marketing assistant. What's your business name?", intent: 'onboarding', created_at: hoursAgo(3) },
  ].map(c => ({ id: randomUUID(), ...c }));
}

function buildSocialAccounts(users) {
  const u1 = users[0];
  const u2 = users[1];
  const u3 = users[2];

  return [
    {
      id: randomUUID(),
      user_id: u1.id,
      platform: 'instagram',
      platform_user_id: '17841401234567890',
      platform_username: '@mikespizza_philly',
      access_token: 'mock_ig_token_user1',
      refresh_token: null,
      token_expires_at: daysFromNow(50),
      scopes: ['instagram_basic', 'instagram_content_publish'],
      is_active: true,
      created_at: daysAgo(28),
    },
    {
      id: randomUUID(),
      user_id: u2.id,
      platform: 'instagram',
      platform_user_id: '17841409876543210',
      platform_username: '@bloomboutique_ny',
      access_token: 'mock_ig_token_user2',
      refresh_token: null,
      token_expires_at: daysFromNow(45),
      scopes: ['instagram_basic', 'instagram_content_publish'],
      is_active: true,
      created_at: daysAgo(10),
    },
    {
      id: randomUUID(),
      user_id: u2.id,
      platform: 'facebook',
      platform_user_id: '112233445566778',
      platform_username: 'Bloom Boutique NYC',
      access_token: 'mock_fb_token_user2',
      refresh_token: null,
      token_expires_at: daysFromNow(45),
      scopes: ['pages_manage_posts', 'pages_read_engagement'],
      is_active: true,
      created_at: daysAgo(10),
    },
    {
      id: randomUUID(),
      user_id: u3.id,
      platform: 'instagram',
      platform_user_id: '17841405544332211',
      platform_username: '@apexfitness_la',
      access_token: 'mock_ig_token_user3',
      refresh_token: null,
      token_expires_at: daysFromNow(30),
      scopes: ['instagram_basic', 'instagram_content_publish'],
      is_active: true,
      created_at: daysAgo(5),
    },
  ];
}

function buildScheduledPosts(users) {
  const u1 = users[0];
  const u2 = users[1];
  const u3 = users[2];

  return [
    {
      id: randomUUID(),
      user_id: u1.id,
      platforms: ['instagram', 'facebook'],
      content: "Lunch just got better! 🍕 Our daily special today is the Margherita Supreme with homemade sauce. Only $9.99 until 3pm. Come in or order online!",
      media_url: null,
      status: 'posted',
      scheduled_for: daysAgo(6),
      published_urls: JSON.stringify({ instagram: 'https://www.instagram.com/p/mock1/', facebook: 'https://www.facebook.com/mikespizza/posts/mock1' }),
      created_at: daysAgo(6),
    },
    {
      id: randomUUID(),
      user_id: u1.id,
      platforms: ['instagram'],
      content: "Weekend vibes start now! 🎉 Our Saturday special: buy 1 large pizza, get a free order of garlic knots. Valid this weekend only!",
      media_url: null,
      status: 'queued',
      scheduled_for: daysFromNow(2),
      published_urls: JSON.stringify({}),
      created_at: daysAgo(4),
    },
    {
      id: randomUUID(),
      user_id: u2.id,
      platforms: ['instagram', 'facebook'],
      content: "Spring has arrived at Bloom Boutique! ✨ Our brand new spring collection just dropped — fresh florals, lightweight layers, and everything you need for the season.",
      media_url: null,
      status: 'posted',
      scheduled_for: daysAgo(3),
      published_urls: JSON.stringify({ instagram: 'https://www.instagram.com/p/mock2/', facebook: 'https://www.facebook.com/bloomboutique/posts/mock2' }),
      created_at: daysAgo(3),
    },
    {
      id: randomUUID(),
      user_id: u3.id,
      platforms: ['instagram'],
      content: "30-Day Challenge starts MONDAY. Are you in? 💪 DM us to sign up. Spots are limited — first 20 members get a free protein shake on us.",
      media_url: null,
      status: 'draft',
      scheduled_for: null,
      published_urls: JSON.stringify({}),
      created_at: daysAgo(1),
    },
    {
      id: randomUUID(),
      user_id: u2.id,
      platforms: ['instagram'],
      content: "SALE ALERT 🛍️ Extra 20% off all spring arrivals this weekend. Use code SPRING20 at checkout — online and in-store.",
      media_url: null,
      status: 'queued',
      scheduled_for: daysFromNow(1),
      published_urls: JSON.stringify({}),
      created_at: daysAgo(1),
    },
  ];
}

// =============================================
// MAIN
// =============================================

async function seed() {
  const client = new Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    console.log('Connected to Postgres:', DATABASE_URL.replace(/:([^:@]+)@/, ':****@'));
    console.log();

    // Clear existing seed data in dependency order
    console.log('Clearing existing data...');
    await client.query('DELETE FROM scheduled_posts');
    await client.query('DELETE FROM social_accounts');
    await client.query('DELETE FROM conversations');
    await client.query('DELETE FROM users');
    console.log('  Done.\n');

    // Insert users
    console.log(`Inserting ${USERS.length} users...`);
    for (const u of USERS) {
      await client.query(
        `INSERT INTO users
          (id, phone, business_name, business_type, tone, timezone, plan,
           onboarding_complete, onboarding_step, generations_used, generations_limit, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          u.id, u.phone, u.business_name, u.business_type, u.tone, u.timezone, u.plan,
          u.onboarding_complete, u.onboarding_step, u.generations_used, u.generations_limit, u.created_at,
        ]
      );
      console.log(`  ${u.phone} — ${u.business_name || '(no name yet)'} [${u.plan}]`);
    }
    console.log();

    // Insert conversations
    const conversations = buildConversations(USERS);
    console.log(`Inserting ${conversations.length} conversations...`);
    for (const c of conversations) {
      await client.query(
        `INSERT INTO conversations (id, user_id, direction, body, intent, created_at)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [c.id, c.user_id, c.direction, c.body, c.intent, c.created_at]
      );
    }
    console.log(`  ${conversations.length} messages inserted.\n`);

    // Insert social accounts
    const socialAccounts = buildSocialAccounts(USERS);
    console.log(`Inserting ${socialAccounts.length} social accounts...`);
    for (const s of socialAccounts) {
      await client.query(
        `INSERT INTO social_accounts
          (id, user_id, platform, platform_user_id, platform_username,
           access_token, refresh_token, token_expires_at, scopes, is_active, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          s.id, s.user_id, s.platform, s.platform_user_id, s.platform_username,
          s.access_token, s.refresh_token, s.token_expires_at,
          s.scopes, s.is_active, s.created_at,
        ]
      );
      console.log(`  ${s.platform_username} (${s.platform})`);
    }
    console.log();

    // Insert scheduled posts
    const posts = buildScheduledPosts(USERS);
    console.log(`Inserting ${posts.length} scheduled posts...`);
    for (const p of posts) {
      await client.query(
        `INSERT INTO scheduled_posts
          (id, user_id, platforms, content, media_url, status, scheduled_for, published_urls, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          p.id, p.user_id, p.platforms, p.content, p.media_url,
          p.status, p.scheduled_for, p.published_urls, p.created_at,
        ]
      );
      console.log(`  [${p.status}] ${p.content.slice(0, 60)}...`);
    }
    console.log();

    console.log('Seed complete!');
    console.log();
    console.log('Summary:');
    console.log(`  Users:           ${USERS.length}`);
    console.log(`  Conversations:   ${conversations.length}`);
    console.log(`  Social accounts: ${socialAccounts.length}`);
    console.log(`  Scheduled posts: ${posts.length}`);
    console.log();
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seed();
