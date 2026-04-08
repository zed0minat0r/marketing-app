# TextMarketer — Architecture

## Product Vision
Text-first AI marketing agent for small businesses. No app, no dashboard, no login. Business owners manage marketing entirely via text message.

---

## Phase 1 — Landing Page (GitHub Pages)

### Tech
- Single-page HTML + Tailwind CDN, no build step
- Hosted on GitHub Pages

### Sections
1. Hero — bold headline, subtext, phone number signup CTA
2. Interactive Demo — fake iMessage-style conversation UI with typing animation. Users pick prompt buttons ("Post to social", "Check my stats", "Write ad copy") to see demo flows
3. How It Works — 3 steps: Text us → AI generates → You approve
4. Features — content calendar, ad copy, website audit, review management, analytics
5. Pricing — Starter $49/mo, Growth $99/mo, Pro $199/mo
6. Final CTA — phone number signup

### Signups
- Formspree or simple phone number collection (no backend needed)

---

## Phase 2 — Backend

### Tech Stack
| Layer | Service | Why |
|-------|---------|-----|
| SMS | Twilio | Industry standard, webhooks, 2-way messaging |
| AI | Claude API | Content generation, intent parsing, audits |
| Social Posting | Buffer API | One integration → Instagram, Facebook, X, LinkedIn, TikTok |
| Database | Supabase | Free PostgreSQL, built-in auth, RLS |
| API Server | Vercel Edge Functions | Stateless, auto-scale, free tier |
| Auth | Phone OTP via Twilio | No passwords, phone = identity |
| Billing | Stripe | Subscriptions, usage metering |

### Data Flow
```
User texts → Twilio webhook → Vercel Edge Function
  → Claude API (parse intent + generate content)
  → Response back via Twilio SMS
  → If posting: Buffer API → social platforms
  → Log to Supabase
```

### Database Schema (Supabase/PostgreSQL)
```sql
users (
  id uuid PK,
  phone text UNIQUE NOT NULL,
  business_name text,
  business_type text,
  location text,
  tone text DEFAULT 'professional',
  plan text DEFAULT 'starter',
  stripe_customer_id text,
  created_at timestamptz
)

messages (
  id uuid PK,
  user_id uuid FK → users,
  direction text CHECK (in, out),
  body text,
  intent text,
  created_at timestamptz
)

posts (
  id uuid PK,
  user_id uuid FK → users,
  platform text,
  content text,
  status text CHECK (draft, scheduled, posted, failed),
  scheduled_for timestamptz,
  buffer_id text,
  created_at timestamptz
)

audits (
  id uuid PK,
  user_id uuid FK → users,
  url text,
  scores jsonb,
  recommendations jsonb,
  created_at timestamptz
)
```

### API Endpoints (Vercel Edge Functions)
```
POST /api/sms/webhook     — Twilio incoming SMS
POST /api/sms/send        — Send outbound SMS
POST /api/ai/generate     — Generate content via Claude
POST /api/social/post     — Post via Buffer
POST /api/audit/run       — Run website audit
GET  /api/user/stats      — User analytics
POST /api/auth/otp        — Send OTP
POST /api/auth/verify     — Verify OTP
```

### Key Decisions

**Buffer as middleware:** One integration covers all social platforms. Avoids maintaining 5+ separate OAuth flows and APIs.

**Phone = identity:** No email, no username, no login page. Phone number is the auth key. Matches text-first UX.

**Edge Functions:** Stateless, auto-scale. Each SMS webhook is an independent request. Perfect for this use case.

### Pricing
| Plan | Price | AI Generations | Social Accounts | Website Audits |
|------|-------|---------------|-----------------|----------------|
| Starter | $49/mo | 100/mo | 3 | 1/mo |
| Growth | $99/mo | 500/mo | Unlimited | 5/mo |
| Pro | $199/mo | Unlimited | Unlimited | Unlimited |

### Estimated COGS
~$2-4/user/month (Claude API + Twilio SMS + Buffer). At $49 starter = 92-96% gross margin.
