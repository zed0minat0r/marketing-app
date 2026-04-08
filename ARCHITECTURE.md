# TextMarketer -- Full Architecture Document

**Last updated:** 2026-04-07
**Author:** Architect Agent

---

## Table of Contents

1. [Product Vision](#product-vision)
2. [Phase Overview](#phase-overview)
3. [Tech Stack](#tech-stack)
4. [Phase 1 -- Landing Page (DONE)](#phase-1----landing-page)
5. [Phase 2 -- Twilio SMS + Claude AI Core](#phase-2----twilio-sms--claude-ai-core)
6. [Phase 3 -- Social Media API Connections](#phase-3----social-media-api-connections)
7. [Phase 4 -- Scheduling Engine](#phase-4----scheduling-engine)
8. [Phase 5 -- Analytics via Text](#phase-5----analytics-via-text)
9. [Database Schema](#database-schema)
10. [API Design](#api-design)
11. [SMS Conversation Flows](#sms-conversation-flows)
12. [Infrastructure Diagram](#infrastructure-diagram)
13. [Security Considerations](#security-considerations)
14. [Cost Estimates at Scale](#cost-estimates-at-scale)
15. [Key Architecture Decisions](#key-architecture-decisions)

---

## Product Vision

Small business owners manage their entire marketing via text message. No app to download, no dashboard to learn, no login. Their phone number is their identity. Claude AI is their marketing team.

"A marketing team in your texts."

---

## Phase Overview

| Phase | Name | Status | Description |
|-------|------|--------|-------------|
| 1 | Landing Page | DONE | GitHub Pages site with signup CTA |
| 2 | SMS + AI Core | Next | Twilio webhook -> Claude API -> conversational marketing assistant |
| 3 | Social Media | Planned | Connect FB/IG (Meta Graph API), X (Twitter API) -- post via text |
| 4 | Scheduling | Planned | Queue posts, auto-publish on user-defined schedules |
| 5 | Analytics | Planned | Weekly engagement summaries delivered via text |

---

## Tech Stack

| Layer | Service | Rationale |
|-------|---------|-----------|
| **SMS Gateway** | Twilio Programmable Messaging | Industry standard. Webhooks for inbound, REST API for outbound. Short code support for scale. |
| **AI Engine** | Claude API (Anthropic) | Content generation, intent parsing, conversation management. Sonnet for speed, Opus for complex tasks. |
| **API Server** | Node.js on Vercel Serverless Functions | JavaScript ecosystem, fast cold starts, auto-scale to zero, generous free tier. Each webhook is a stateless request -- perfect fit. |
| **Database** | Supabase (PostgreSQL) | Managed Postgres with Row Level Security, real-time subscriptions, generous free tier (500MB). Avoid vendor lock-in vs. Firebase. |
| **Job Queue / Scheduler** | Upstash QStash | Serverless message queue with scheduled delivery. No always-on server needed. Pairs perfectly with Vercel. |
| **Social Media** | Meta Graph API (direct), X API v2 (direct) | Direct integration -- no middleware like Buffer. Full control over OAuth, posting, and analytics. Avoids Buffer's per-channel costs. |
| **Auth** | Phone OTP via Twilio Verify | No passwords. Phone number = identity. Matches the text-first UX. |
| **Billing** | Stripe | Subscriptions with usage-based metering. Webhooks for plan changes. |
| **Monitoring** | Sentry (errors) + Vercel Analytics (performance) | Free tiers sufficient for early stage. |
| **Secrets Management** | Vercel Environment Variables | Encrypted at rest. Per-environment (preview/production). |

### Why Node.js over Python

- Vercel's native runtime -- zero config deployment
- Twilio and Stripe have first-class Node SDKs
- Non-blocking I/O suits webhook-heavy workloads
- Shared language with any future frontend work

### Why Direct Social APIs over Buffer

Buffer adds $6/channel/month at scale and limits API access to analytics. Going direct with Meta Graph API and X API v2 gives us:
- Full control over posting, scheduling, and metrics retrieval
- No per-channel cost beyond API rate limits
- Ability to read comments/replies for the analytics phase
- One less vendor dependency

---

## Phase 1 -- Landing Page

**Status: DONE**

- Single HTML file + Tailwind CSS via CDN
- Hosted on GitHub Pages at https://zed0minat0r.github.io/marketing-app/
- Interactive SMS demo conversation
- Phone number signup CTA (Formspree collection)
- Pricing tiers displayed: Starter $49, Growth $99, Pro $199

No changes needed. This is the live marketing site.

---

## Phase 2 -- Twilio SMS + Claude AI Core

### Overview

User sends a text to our Twilio number. Twilio fires a webhook to our Vercel function. We parse intent with Claude, generate a response, and send it back via Twilio.

### Data Flow

```
User sends SMS
     |
     v
Twilio receives message on our number (+1-XXX-XXX-XXXX)
     |
     v
Twilio POSTs webhook to POST /api/sms/inbound
     |
     v
Vercel Function:
  1. Look up user by phone number in Supabase
  2. If new user -> onboarding flow (ask business name, type, tone)
  3. If existing -> load conversation history (last 20 messages)
  4. Build Claude prompt with:
     - System prompt (marketing assistant persona + user's business context)
     - Conversation history
     - Current message
  5. Claude responds with:
     - reply_text: what to send back to user
     - intent: classified action (post, schedule, analytics, help, etc.)
     - action: optional structured action (e.g., {type: "draft_post", platform: "instagram", content: "..."})
  6. Store inbound + outbound messages in Supabase
  7. Send reply via Twilio REST API
     |
     v
User receives SMS reply
```

### Onboarding Flow (First-Time User)

```
System: Welcome to TextMarketer! I am your AI marketing team.
        Let us get you set up. What is your business name?
User:   Mike's Pizza
System: Great! What type of business is Mike's Pizza?
        (restaurant, retail, service, ecommerce, other)
User:   Restaurant
System: Last question -- how should your marketing sound?
        (casual, professional, bold, friendly)
User:   Casual
System: You are all set! Mike's Pizza is ready to go.
        Text me anytime. Try: "Write a post about our new pepperoni special"
```

### Claude System Prompt Structure

```
You are TextMarketer, an AI marketing assistant for small businesses.
You communicate exclusively via SMS. Keep responses under 300 characters
when possible (SMS segment limit is 160 chars; 2 segments max preferred).

Business context:
- Name: {business_name}
- Type: {business_type}
- Tone: {tone_preference}
- Connected platforms: {platforms_list}
- Plan: {plan_name} ({generations_remaining} generations left this month)

You can:
1. Draft social media posts (user must approve before posting)
2. Schedule posts for later
3. Provide marketing tips
4. Summarize engagement analytics

Always end draft posts with:
"Reply YES to post, EDIT to change, or SKIP."

Never post without explicit user approval.
```

### Key Phase 2 Deliverables

- Twilio number provisioned and configured
- POST /api/sms/inbound webhook
- POST /api/sms/outbound internal sender
- Claude API integration with conversation context
- User onboarding state machine
- Message logging to Supabase
- Rate limiting (see Security section)

---

## Phase 3 -- Social Media API Connections

### Overview

Users connect their social accounts via a one-time OAuth flow (sent as a link in a text). Once connected, Claude drafts posts and the user approves via text reply.

### OAuth Flow via SMS

```
User:   Connect my Instagram
System: Tap this link to connect your Instagram account:
        https://textmarketer.com/connect/instagram?token=abc123
        (Link expires in 15 minutes)
     |
     v
User taps link -> Browser opens -> Meta OAuth consent screen
     |
     v
User authorizes -> Redirect to /api/oauth/meta/callback
     |
     v
Server stores access_token + refresh_token in social_accounts table
     |
     v
System: Instagram connected! You can now post to @mikespizza.
        Try: "Post a photo caption about our lunch special"
```

### Supported Platforms

| Platform | API | Capabilities | OAuth |
|----------|-----|-------------|-------|
| Facebook Page | Meta Graph API v19.0 | Text posts, photo posts, link posts, read insights | Facebook Login for Business |
| Instagram Business | Meta Graph API v19.0 | Feed posts, Stories (image), Reels (video URL), read insights | Same Meta OAuth -- request instagram_basic, instagram_content_publish |
| X (Twitter) | X API v2 | Tweets, threads, read metrics | OAuth 2.0 PKCE |

### Post Creation Flow

```
User:   Post about our new summer menu to Instagram
     |
     v
Claude drafts post:
System: Here is your Instagram post:

        "Summer is here and so is our new menu!
        Fresh salads, grilled fish tacos, and our
        famous watermelon lemonade. Come taste
        the season at Mike's Pizza.
        #SummerMenu #MikesPizza #FreshFood"

        Reply YES to post now, EDIT to change,
        LATER to schedule, or SKIP to cancel.
     |
     v
User:   YES
     |
     v
Server calls Meta Graph API:
  POST /{page-id}/feed (Facebook)
  POST /{ig-user-id}/media + POST /{ig-user-id}/media_publish (Instagram)
     |
     v
System: Posted to Instagram! View it: https://instagram.com/p/xxxxx
```

### Token Management

- Meta tokens: Exchange short-lived token (1hr) for long-lived token (60 days). Set up Upstash cron to refresh at day 50.
- X tokens: OAuth 2.0 with refresh tokens. Refresh on 401 response automatically.
- Store all tokens encrypted at rest in Supabase (pgcrypto extension).

### Key Phase 3 Deliverables

- OAuth link generation endpoints for Meta and X
- OAuth callback handlers with token storage
- POST /api/social/post -- platform-agnostic posting
- Token refresh background jobs via Upstash QStash
- Draft -> Approve -> Post conversation flow
- Multi-platform support ("Post this to Facebook and Instagram")

---

## Phase 4 -- Scheduling Engine

### Overview

Users can schedule posts for specific times or let the AI suggest optimal posting times based on platform best practices.

### Architecture

```
User:   Schedule a post about happy hour for Friday at 4pm
     |
     v
Claude parses:
  - Content request: "happy hour post"
  - Schedule: Friday 4:00 PM ET (user's timezone)
  - Platform: default or ask
     |
     v
System: Here is your scheduled post for Friday 4:00 PM:

        "Friday vibes start at 4! Half-price
        wings and $5 margaritas until 7pm.
        Bring the crew to Mike's Pizza.
        #HappyHour #FridayVibes #MikesPizza"

        Posting to: Instagram, Facebook
        Reply YES to schedule, EDIT to change, or SKIP.
     |
     v
User:   YES
     |
     v
Server:
  1. Insert into scheduled_posts with status='queued'
  2. Create QStash scheduled message:
     POST https://textmarketer.com/api/jobs/publish
     Deliver-At: 2026-04-10T20:00:00Z (Friday 4pm ET -> UTC)
     Body: { post_id: "uuid-here" }
     |
     v
At scheduled time, QStash fires webhook:
  1. Load post from scheduled_posts
  2. Call social media API to publish
  3. Update status to 'posted' or 'failed'
  4. Text user: "Your happy hour post is now live on Instagram and Facebook!"
```

### Smart Scheduling

When users say "schedule it for a good time" without specifying:

| Platform | Suggested Times (ET) |
|----------|---------------------|
| Instagram | Tue-Thu 11am, Mon-Fri 6pm |
| Facebook | Wed 11am, Fri 1pm |
| X/Twitter | Mon-Fri 8am, 12pm |

These defaults get refined per-user as we collect engagement data in Phase 5.

### Queue Management via Text

```
User:   What is scheduled?
System: You have 3 upcoming posts:
        1. Fri 4pm - Happy hour (IG, FB)
        2. Sat 11am - Brunch special (IG)
        3. Mon 9am - Monday motivation (X)
        Reply CANCEL 1 to remove, or EDIT 2 to change.

User:   CANCEL 1
System: Happy hour post canceled.
        2 posts remaining this week.
```

### Key Phase 4 Deliverables

- Upstash QStash integration for deferred job delivery
- POST /api/jobs/publish -- fires at scheduled time, publishes post
- Timezone handling (store user TZ in profile, all internal times UTC)
- Queue listing and management via text commands
- Retry logic: if publish fails, retry 3x with exponential backoff, then text user about failure
- Content calendar summary on demand

---

## Phase 5 -- Analytics via Text

### Overview

Weekly automated summary of marketing performance sent via text. Users can also ask for stats on demand.

### Weekly Summary (Auto-sent)

```
System: Weekly Marketing Report for Mike's Pizza
        (Mar 31 - Apr 6)

        POSTS: 7 published
        REACH: 2,341 people (+18% vs last week)
        ENGAGEMENT: 186 interactions
        TOP POST: "Summer menu" on IG -- 89 likes, 12 comments

        SUGGESTION: Your food photos get 3x more
        engagement than text posts. Try posting
        a behind-the-scenes kitchen shot this week.

        Reply MORE for full breakdown or TIPS for ideas.
```

### On-Demand Analytics

```
User:   How did my posts do this week?
System: This week's highlights:
        - Instagram: 1,200 reach, 4.2% engagement rate
        - Facebook: 890 reach, 2.1% engagement rate
        - X: 340 impressions, 8 retweets

        Your best day was Wednesday.
        Reply COMPARE for last week comparison.
```

### Data Collection

Nightly batch job (Upstash QStash cron, runs at 2am UTC):

1. For each user with connected accounts:
   - Meta Graph API: GET /{post-id}/insights for each post from last 24hrs
   - X API: GET /tweets/{id}?tweet.fields=public_metrics
2. Store raw metrics in analytics_snapshots table
3. Aggregate into weekly_analytics on Sunday night

### Metrics We Track

| Metric | Facebook | Instagram | X |
|--------|----------|-----------|---|
| Reach/Impressions | reach | reach | impression_count |
| Likes | reactions.summary.total_count | like_count | like_count |
| Comments | comments.summary.total_count | comments_count | reply_count |
| Shares/Retweets | shares.count | -- | retweet_count |
| Clicks | clicks | -- | url_link_clicks |
| Saves | -- | saved | bookmark_count |

### Key Phase 5 Deliverables

- Nightly metrics collection job via QStash cron
- analytics_snapshots table for raw per-post metrics
- weekly_analytics aggregation
- Auto-send weekly summary every Monday at 9am user-local-time
- On-demand stats via text ("how did my posts do?")
- AI-generated suggestions based on engagement patterns

---

## Database Schema

All tables live in Supabase (PostgreSQL). UUIDs as primary keys. Timestamps in UTC.

```sql
-- =============================================
-- USERS
-- =============================================
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone         TEXT UNIQUE NOT NULL,          -- E.164 format: +14845551234
  business_name TEXT,
  business_type TEXT,                          -- restaurant, retail, service, ecommerce, other
  tone          TEXT DEFAULT 'professional',   -- casual, professional, bold, friendly
  timezone      TEXT DEFAULT 'America/New_York',
  plan          TEXT DEFAULT 'starter',        -- starter, growth, pro
  stripe_customer_id  TEXT,
  stripe_subscription_id TEXT,
  onboarding_complete BOOLEAN DEFAULT FALSE,
  onboarding_step     TEXT DEFAULT 'name',     -- name, type, tone, done
  generations_used    INT DEFAULT 0,           -- reset monthly
  generations_limit   INT DEFAULT 100,         -- per plan
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_phone ON users(phone);

-- =============================================
-- CONVERSATIONS (message log)
-- =============================================
CREATE TABLE conversations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  direction     TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  body          TEXT NOT NULL,
  intent        TEXT,              -- post, schedule, analytics, help, connect, cancel, approve, edit, onboarding
  twilio_sid    TEXT,              -- Twilio message SID for delivery tracking
  claude_model  TEXT,              -- which model was used for this response
  tokens_used   INT,              -- Claude API tokens consumed
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_created_at ON conversations(created_at);

-- =============================================
-- SOCIAL ACCOUNTS (OAuth connections)
-- =============================================
CREATE TABLE social_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform        TEXT NOT NULL,     -- facebook, instagram, twitter
  platform_user_id TEXT NOT NULL,    -- platform-specific user/page ID
  platform_username TEXT,            -- display name (@mikespizza)
  access_token    TEXT NOT NULL,     -- encrypted via pgcrypto
  refresh_token   TEXT,              -- encrypted via pgcrypto
  token_expires_at TIMESTAMPTZ,
  scopes          TEXT[],            -- granted OAuth scopes
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, platform, platform_user_id)
);

CREATE INDEX idx_social_accounts_user_id ON social_accounts(user_id);

-- =============================================
-- SCHEDULED POSTS
-- =============================================
CREATE TABLE scheduled_posts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platforms       TEXT[] NOT NULL,            -- ['instagram', 'facebook']
  content         TEXT NOT NULL,
  media_url       TEXT,                       -- optional image/video URL
  status          TEXT DEFAULT 'queued'
                  CHECK (status IN ('draft', 'queued', 'publishing', 'posted', 'failed', 'canceled')),
  scheduled_for   TIMESTAMPTZ,               -- NULL = post immediately
  qstash_message_id TEXT,                    -- Upstash QStash message ID for cancellation
  published_urls  JSONB DEFAULT '{}',        -- {"instagram": "https://...", "facebook": "https://..."}
  error_message   TEXT,                      -- populated on failure
  retry_count     INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scheduled_posts_user_id ON scheduled_posts(user_id);
CREATE INDEX idx_scheduled_posts_status ON scheduled_posts(status);
CREATE INDEX idx_scheduled_posts_scheduled_for ON scheduled_posts(scheduled_for);

-- =============================================
-- ANALYTICS SNAPSHOTS (per-post metrics, collected nightly)
-- =============================================
CREATE TABLE analytics_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id         UUID NOT NULL REFERENCES scheduled_posts(id) ON DELETE CASCADE,
  platform        TEXT NOT NULL,
  impressions     INT DEFAULT 0,
  reach           INT DEFAULT 0,
  likes           INT DEFAULT 0,
  comments        INT DEFAULT 0,
  shares          INT DEFAULT 0,
  saves           INT DEFAULT 0,
  clicks          INT DEFAULT 0,
  raw_data        JSONB,             -- full API response for future use
  snapshot_date   DATE NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, platform, snapshot_date)
);

CREATE INDEX idx_analytics_post_id ON analytics_snapshots(post_id);
CREATE INDEX idx_analytics_snapshot_date ON analytics_snapshots(snapshot_date);

-- =============================================
-- WEEKLY ANALYTICS (aggregated per user per week)
-- =============================================
CREATE TABLE weekly_analytics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start      DATE NOT NULL,             -- Monday of the week
  posts_count     INT DEFAULT 0,
  total_reach     INT DEFAULT 0,
  total_impressions INT DEFAULT 0,
  total_engagement INT DEFAULT 0,            -- likes + comments + shares
  top_post_id     UUID REFERENCES scheduled_posts(id),
  summary_text    TEXT,                      -- Claude-generated summary sent to user
  sent_at         TIMESTAMPTZ,               -- when the weekly text was sent
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, week_start)
);

CREATE INDEX idx_weekly_analytics_user_id ON weekly_analytics(user_id);

-- =============================================
-- OAUTH STATES (temporary, for CSRF protection)
-- =============================================
CREATE TABLE oauth_states (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform    TEXT NOT NULL,
  state       TEXT UNIQUE NOT NULL,           -- random string for CSRF
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_oauth_states_state ON oauth_states(state);
```

### Entity Relationship Summary

```
users
  |-- 1:N -- conversations
  |-- 1:N -- social_accounts
  |-- 1:N -- scheduled_posts
  |         |-- 1:N -- analytics_snapshots
  |-- 1:N -- weekly_analytics
  |-- 1:N -- oauth_states (temporary)
```

---

## API Design

All endpoints deployed as Vercel Serverless Functions under /api/.

### Webhook Endpoints (External -> Us)

```
POST /api/sms/inbound
  Description: Twilio webhook for incoming SMS
  Auth: Twilio request signature validation (X-Twilio-Signature header)
  Body: Twilio webhook payload (From, Body, MessageSid, etc.)
  Response: TwiML or 200 OK (we send replies via REST API, not TwiML)
  Rate limit: 1 msg/sec per phone number

POST /api/oauth/meta/callback
  Description: Meta OAuth redirect handler
  Query: ?code=xxx&state=yyy
  Action: Exchange code for token, store in social_accounts, text user confirmation
  Redirect: /connected?platform=instagram

POST /api/oauth/twitter/callback
  Description: X/Twitter OAuth 2.0 PKCE callback
  Query: ?code=xxx&state=yyy
  Action: Exchange code for token pair, store in social_accounts

POST /api/jobs/publish
  Description: QStash fires this at scheduled time to publish a post
  Auth: QStash signature verification (Upstash-Signature header)
  Body: { post_id: "uuid" }
  Action: Load post, call social API, update status, text user

POST /api/jobs/collect-analytics
  Description: QStash nightly cron -- collect metrics for all posts
  Auth: QStash signature verification
  Action: Iterate users, pull metrics from social APIs, store snapshots

POST /api/jobs/weekly-summary
  Description: QStash weekly cron -- generate and send weekly analytics text
  Auth: QStash signature verification
  Action: Aggregate snapshots, Claude generates summary, send via Twilio

POST /api/stripe/webhook
  Description: Stripe webhook for subscription events
  Auth: Stripe webhook signature verification
  Events: customer.subscription.created, updated, deleted
  Action: Update user plan, generations_limit
```

### Internal Endpoints (Our Server -> Our Server)

```
POST /api/sms/send
  Description: Send an outbound SMS via Twilio
  Auth: Internal only (Vercel function-to-function, no public access)
  Body: { to: "+1...", body: "..." }

POST /api/ai/generate
  Description: Call Claude API with conversation context
  Auth: Internal only
  Body: { user_id: "uuid", message: "...", conversation_history: [...] }
  Response: { reply: "...", intent: "...", action: {...} }

POST /api/social/post
  Description: Publish content to a social platform
  Auth: Internal only
  Body: { user_id: "uuid", platform: "instagram", content: "...", media_url: "..." }
  Response: { success: true, url: "https://..." }
```

### User-Facing Endpoints (Browser, for OAuth only)

```
GET /api/oauth/meta/start?token=abc123
  Description: Initiates Meta OAuth flow
  Auth: Short-lived token sent via SMS (15 min expiry)
  Action: Generate state, store in oauth_states, redirect to Meta

GET /api/oauth/twitter/start?token=abc123
  Description: Initiates Twitter OAuth 2.0 PKCE flow
  Auth: Short-lived token sent via SMS

GET /connected
  Description: Static success page after OAuth ("Account connected! Return to your texts.")
```

---

## SMS Conversation Flows

### Flow 1: First Contact (Onboarding)

```
USER  ->  "Hi"
BOT   <-  "Welcome to TextMarketer! I am your AI marketing
           team, right here in your texts.
           First -- what is your business called?"
USER  ->  "Mike's Pizza"
BOT   <-  "Mike's Pizza -- great name! What kind of business?
           (restaurant, retail, service, ecommerce, other)"
USER  ->  "Restaurant"
BOT   <-  "And how should your marketing sound?
           (casual, professional, bold, friendly)"
USER  ->  "Casual"
BOT   <-  "All set! Mike's Pizza is ready to roll.

           Here is what I can do:
           - Write social posts
           - Schedule content
           - Connect your social accounts
           - Track your marketing performance

           Try: 'Write a post about our new pepperoni special'"
```

### Flow 2: Draft and Post

```
USER  ->  "Write a post about our lunch deal for Instagram"
BOT   <-  "Here is your Instagram post:

           'Lunch at Mike's is calling your name.
           $8.99 gets you 2 slices + a drink, every
           weekday 11am-2pm. Tag a friend who needs
           this in their life.
           #LunchDeal #MikesPizza #SliceOfHeaven'

           Reply YES to post, EDIT to change, LATER
           to schedule, or SKIP to cancel."
USER  ->  "YES"
BOT   <-  "Posted to Instagram! View it:
           https://instagram.com/p/xxxxx"
```

### Flow 3: Edit Before Posting

```
USER  ->  "EDIT make it shorter and add our address"
BOT   <-  "Updated:

           'Lunch deal: 2 slices + drink for $8.99.
           Mon-Fri, 11-2. 123 Main St.
           #MikesPizza #LunchDeal'

           Reply YES to post or EDIT again."
USER  ->  "YES"
BOT   <-  "Posted to Instagram!"
```

### Flow 4: Schedule a Post

```
USER  ->  "Schedule a post about happy hour for Friday at 5pm"
BOT   <-  "Here is your post for Fri Apr 10 at 5:00 PM ET:

           'Friday happy hour starts NOW! $5 margaritas
           and half-price wings until 7pm. See you at
           Mike's Pizza. #HappyHour #TGIF'

           Posting to: Instagram, Facebook
           Reply YES to schedule, EDIT, or SKIP."
USER  ->  "YES"
BOT   <-  "Scheduled! I will post it Friday at 5pm
           and let you know when it is live."

-- Friday 5:00 PM --
BOT   <-  "Your happy hour post is now live!
           IG: https://instagram.com/p/xxxxx
           FB: https://facebook.com/xxxxx"
```

### Flow 5: Check Schedule

```
USER  ->  "What do I have coming up?"
BOT   <-  "Upcoming posts:
           1. Fri 5pm -- Happy hour (IG, FB)
           2. Sat 11am -- Brunch promo (IG)
           3. Mon 9am -- Monday motivation (X)

           Reply CANCEL 1 to remove or EDIT 2 to change."
USER  ->  "CANCEL 1"
BOT   <-  "Happy hour post canceled. 2 posts remaining."
```

### Flow 6: Connect Social Account

```
USER  ->  "Connect my Instagram"
BOT   <-  "Tap this link to connect Instagram:
           https://textmarketer.com/api/oauth/meta/start?token=abc123

           (Expires in 15 minutes)"

-- User taps link, authorizes in browser --

BOT   <-  "Instagram connected! You are logged in as
           @mikespizza. I can now post directly to your feed."
```

### Flow 7: Weekly Analytics (Auto-sent Monday 9am)

```
BOT   <-  "Weekly Report: Mike's Pizza (Mar 31 - Apr 6)

           7 posts published
           2,341 people reached (+18%)
           186 total interactions
           Best: 'Lunch deal' on IG -- 89 likes

           TIP: Food photos get 3x more engagement than
           text-only posts. Try a behind-the-scenes shot.

           Reply MORE for details or TIPS for content ideas."
```

### Flow 8: On-Demand Analytics

```
USER  ->  "How did that lunch post do?"
BOT   <-  "Your lunch deal post (Apr 3, Instagram):
           Reach: 456 people
           Likes: 89
           Comments: 12
           Saves: 8

           That is your best performing post this week!
           Want me to write a similar one?"
```

---

## Infrastructure Diagram

```
                    +------------------+
                    |   User's Phone   |
                    +--------+---------+
                             |
                        SMS / MMS
                             |
                    +--------v---------+
                    |     Twilio       |
                    |  Programmable    |
                    |   Messaging     |
                    +--------+---------+
                             |
                     Webhook POST
                             |
              +--------------v---------------+
              |        Vercel Edge           |
              |     Serverless Functions     |
              |                              |
              |  /api/sms/inbound            |
              |  /api/sms/send               |
              |  /api/ai/generate            |
              |  /api/social/post            |
              |  /api/oauth/*                |
              |  /api/jobs/*                 |
              |  /api/stripe/webhook         |
              +-+-----+-----+-----+---------+
                |     |     |     |
       +--------+  +--+  +--+  +--+---------+
       |           |      |      |           |
+------v---+ +----v--+ +-v----+ +v--------+ +v---------+
| Claude   | |Supa-  | |Up-   | |Social   | |Stripe    |
| API      | |base   | |stash | |APIs     | |Billing   |
| (Sonnet) | |Postgre| |QStash| |Meta/X   | |          |
+----------+ +-------+ +------+ +---------+ +----------+

Upstash QStash Scheduled Jobs:
  - Publish posts at scheduled time -> /api/jobs/publish
  - Nightly analytics collection     -> /api/jobs/collect-analytics
  - Weekly summary generation         -> /api/jobs/weekly-summary
  - Token refresh (every 50 days)     -> /api/jobs/refresh-tokens
```

### Deployment Architecture

```
GitHub Repo
  |
  |-- /public          (Phase 1 landing page -- GitHub Pages)
  |-- /api             (Vercel Serverless Functions)
  |-- /lib             (Shared utilities, DB client, Twilio client)
  |-- /prompts         (Claude system prompts, versioned)
  |-- supabase/
  |     |-- migrations (SQL schema migrations)
  |-- vercel.json      (Route config, env vars reference)
  |-- package.json
```

---

## Security Considerations

### Authentication and Authorization

1. **Phone = Identity**: No passwords. Users are identified by their phone number (E.164 format). Twilio validates the sender.
2. **Twilio Signature Validation**: Every inbound webhook is verified using the X-Twilio-Signature header against our auth token. Reject unsigned requests.
3. **QStash Signature Validation**: All scheduled job webhooks verified using Upstash-Signature header.
4. **Stripe Webhook Verification**: Validate Stripe-Signature header on all billing webhooks.
5. **OAuth State Tokens**: CSRF protection on all OAuth flows. Random 32-byte state stored in DB, verified on callback. 15-minute expiry.
6. **SMS Link Tokens**: One-time-use, short-lived (15min) tokens for OAuth initiation links sent via text.

### Data Privacy

1. **Token Encryption**: All social media access/refresh tokens encrypted at rest using pgcrypto (AES-256). Decrypted only in-memory during API calls.
2. **Message Retention**: Conversation history retained for 90 days by default. Users can text "DELETE MY DATA" to trigger full account deletion (CCPA/GDPR compliance).
3. **Minimal Data Collection**: We store only what is needed: phone, business info, messages, tokens, metrics. No browsing data, no device fingerprinting.
4. **PII Isolation**: Phone numbers and business data are in a separate schema from analytics. Row Level Security enforced -- users can only access their own data.

### Rate Limiting

| Endpoint | Limit | Reason |
|----------|-------|--------|
| /api/sms/inbound | 1 msg/sec per phone | Prevent SMS spam/abuse |
| /api/ai/generate | Tied to plan limits | 100/500/unlimited per month |
| /api/social/post | 10 posts/hour per user | Respect social platform rate limits |
| /api/oauth/* | 5 attempts/hour per phone | Prevent OAuth abuse |

Implementation: Upstash Redis for distributed rate limiting (compatible with Vercel serverless).

### Infrastructure Security

- All Vercel functions run in isolated containers
- Environment variables encrypted at rest
- No secrets in code -- all via Vercel env vars
- Supabase RLS policies on every table
- HTTPS enforced everywhere (Vercel default)
- Dependency scanning via GitHub Dependabot

---

## Cost Estimates at Scale

### Per-User Monthly Costs

| Component | 100 Users | 1,000 Users | 10,000 Users |
|-----------|-----------|-------------|--------------|
| **Twilio SMS** (avg 60 msgs/user/mo at $0.0079/msg) | $47 | $474 | $4,740 |
| **Claude API** (avg 50 generations/user, ~1K tokens each, Sonnet at $3/$15 per 1M) | $20 | $200 | $2,000 |
| **Supabase** (Pro $25/mo, scales with connections) | $25 | $25 | $75 |
| **Vercel** (Pro $20/mo, function invocations) | $20 | $20 | $150 |
| **Upstash** (QStash + Redis, pay per message) | $10 | $30 | $200 |
| **Total Infrastructure** | **$122/mo** | **$749/mo** | **$7,165/mo** |
| **Revenue** (avg $75/user/mo) | $7,500 | $75,000 | $750,000 |
| **Gross Margin** | **98.4%** | **99.0%** | **99.0%** |

### Cost Breakdown Notes

- Twilio: Using standard long code. At 5,000+ users, switch to short code ($1,000/mo flat + lower per-message rates) for better deliverability.
- Claude API: Sonnet for 90% of requests (fast, cheap). Opus only for complex multi-platform content strategies (estimated 5% of requests).
- Supabase: Free tier covers up to ~500 users. Pro plan at $25/mo for 500-5,000. Enterprise for 10K+.
- SMS optimization: Use MMS for rich content previews where possible (same Twilio pricing). Keep messages under 160 chars (1 segment) when possible.

### Break-Even Analysis

- Fixed costs (Supabase + Vercel + Upstash): ~$55/mo
- Variable per-user: ~$0.67/user/mo
- At $49/mo starter plan: Break even at 2 paying users

---

## Key Architecture Decisions

### Decision 1: Direct Social APIs vs. Buffer/Hootsuite Middleware

**Choice: Direct APIs (Meta Graph, X API)**

Pros:
- Zero per-channel cost (Buffer charges $6/channel/month)
- Full analytics access (Buffer limits API metrics access)
- Read comments and replies (needed for Phase 5)
- No dependency on third-party uptime

Cons:
- More OAuth flows to maintain (2 vs 1)
- More API surface to monitor for breaking changes

At 1,000 users with 3 channels each, Buffer would cost $18,000/year. Direct integration costs $0 in API fees.

### Decision 2: Upstash QStash vs. Cron Jobs vs. BullMQ

**Choice: Upstash QStash**

- Serverless-native: no always-on worker process
- Scheduled delivery: send a message now, deliver at future timestamp
- Built-in retry with exponential backoff
- Signature verification for security
- $1/100K messages -- trivial cost
- Perfect fit for Vercel (no persistent connections needed)

### Decision 3: Vercel Serverless vs. Railway/Fly.io Persistent Server

**Choice: Vercel Serverless Functions**

- Scale to zero (no cost when idle)
- Each webhook is independent -- no shared state needed
- Auto-scaling handles SMS traffic spikes
- 10-second function timeout is sufficient for our use case (Claude API responds in 2-3s)

Caveat: If we need WebSocket connections or long-running jobs (>10s), we add a Railway worker for that specific job. Keep the core webhook path on Vercel.

### Decision 4: Phone-Only Auth vs. Adding Email

**Choice: Phone-only (for now)**

- Matches the product philosophy: everything via text
- Simplifies the entire auth model
- Twilio validates sender phone number on every message
- Add email as optional in Phase 5 for weekly report PDFs if users request it

### Decision 5: Conversation Context Window

**Choice: Last 20 messages + user profile**

- Claude Sonnet context: send system prompt (~500 tokens) + user profile (~200 tokens) + last 20 messages (~2,000 tokens) + current message
- Total ~3,000 tokens input per request -- fast and cheap
- Older messages archived but not sent to Claude
- If user references something older, Claude can ask "Can you remind me what you are referring to?"

---

## Implementation Priority (Recommended Order)

```
Phase 2 -- Week 1-2:
  [x] Provision Twilio number
  [x] Set up Vercel project with /api routes
  [x] Supabase project + schema migration
  [ ] POST /api/sms/inbound webhook
  [ ] Claude API integration (intent parsing + response generation)
  [ ] Onboarding state machine
  [ ] Message logging
  [ ] Basic rate limiting

Phase 2 -- Week 3:
  [ ] Stripe subscription integration
  [ ] Usage metering (generations per month)
  [ ] Error handling + Sentry monitoring
  [ ] End-to-end testing with real SMS

Phase 3 -- Week 4-5:
  [ ] Meta OAuth flow (Facebook + Instagram)
  [ ] X/Twitter OAuth flow
  [ ] POST /api/social/post (publish to platforms)
  [ ] Draft -> Approve -> Post conversation flow
  [ ] Token refresh jobs

Phase 4 -- Week 6-7:
  [ ] Upstash QStash integration
  [ ] Scheduled post creation via text
  [ ] POST /api/jobs/publish
  [ ] Queue management commands (list, cancel, edit)
  [ ] Smart scheduling suggestions

Phase 5 -- Week 8-9:
  [ ] Nightly metrics collection job
  [ ] analytics_snapshots storage
  [ ] Weekly aggregation + Claude summary generation
  [ ] Auto-send weekly report
  [ ] On-demand stats via text
```

---

## Appendix: Environment Variables

```
# Twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# Claude API
ANTHROPIC_API_KEY=

# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ANON_KEY=

# Meta (Facebook/Instagram)
META_APP_ID=
META_APP_SECRET=

# X/Twitter
TWITTER_CLIENT_ID=
TWITTER_CLIENT_SECRET=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Upstash
QSTASH_TOKEN=
QSTASH_CURRENT_SIGNING_KEY=
QSTASH_NEXT_SIGNING_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# App
APP_URL=https://textmarketer.com
ENCRYPTION_KEY=  # for pgcrypto token encryption
```
