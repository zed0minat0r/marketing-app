# Sidekick Developer Setup

## Prerequisites

- **Node.js 20+** — `node --version` should print `v20.x.x` or higher
- **npm 10+** — included with Node 20
- **Git**
- **Vercel CLI** — `npm install -g vercel` (for local dev and deploys)
- **Docker** (optional) — only needed to run Supabase locally

## 1. Clone and Install

```bash
git clone https://github.com/zed0minat0r/marketing-app.git
cd marketing-app
npm install
```

## 2. Environment Variables

Copy the example file:

```bash
cp .env.example .env.local
```

Fill in each variable. See the sections below for where to find each value.

### Required Variables

| Variable | Where to get it |
|----------|----------------|
| `TWILIO_ACCOUNT_SID` | [Twilio Console](https://console.twilio.com) — Account Info |
| `TWILIO_AUTH_TOKEN` | Same page |
| `TWILIO_PHONE_NUMBER` | Twilio Console — Phone Numbers |
| `ANTHROPIC_API_KEY` | [Anthropic Console](https://console.anthropic.com) — API Keys |
| `SUPABASE_URL` | Supabase Dashboard — Settings — API |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page — use Service Role key, not Anon |
| `META_APP_ID` | [Meta for Developers](https://developers.facebook.com) — App Settings — Basic |
| `META_APP_SECRET` | Same page |
| `TWITTER_CLIENT_ID` | [Twitter Developer Portal](https://developer.twitter.com) — App Keys |
| `TWITTER_CLIENT_SECRET` | Same page |
| `STRIPE_SECRET_KEY` | [Stripe Dashboard](https://dashboard.stripe.com/apikeys) |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard — Webhooks — Signing secret |
| `STRIPE_PRICE_STARTER` | Stripe Dashboard — Products — Starter price ID |
| `STRIPE_PRICE_GROWTH` | Stripe Dashboard — Products — Growth price ID |
| `STRIPE_PRICE_PRO` | Stripe Dashboard — Products — Pro price ID |
| `QSTASH_TOKEN` | [Upstash Console](https://console.upstash.com) — QStash |
| `QSTASH_CURRENT_SIGNING_KEY` | Same page |
| `QSTASH_NEXT_SIGNING_KEY` | Same page |
| `UPSTASH_REDIS_REST_URL` | Upstash Console — Redis |
| `UPSTASH_REDIS_REST_TOKEN` | Same page |
| `APP_URL` | Your production URL, e.g. `https://sidekick.app` |
| `ENCRYPTION_KEY` | Generate locally (see below) |

### Generate ENCRYPTION_KEY

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Paste the output into `ENCRYPTION_KEY`. This key encrypts OAuth tokens stored in the database. Changing it will break decryption of any stored tokens — treat it like a database password.

## 3. Local Development

### Start the dev server

```bash
vercel dev
```

This runs all serverless functions locally on `http://localhost:3000`.

### Mock Twilio (no real SMS)

For local development, set `TWILIO_AUTH_TOKEN` to an empty string. The inbound handler will skip signature validation and accept any POST to `/api/sms/inbound`.

Test the flow with curl:

```bash
curl -X POST http://localhost:3000/api/sms/inbound \
  -d "From=%2B15555550100&Body=Hello&MessageSid=SM_test_001&To=%2B18005551234"
```

Watch the terminal for the outbound SMS log — it will print what would have been sent.

### Seed data (optional)

If you want to test with a pre-existing user, insert a row directly via the Supabase dashboard or psql:

```sql
INSERT INTO users (phone, business_name, business_type, tone, plan, onboarding_complete)
VALUES ('+15555550100', 'Test Cafe', 'restaurant', 'casual', 'growth', true);
```

### Run Supabase locally (optional)

Install the Supabase CLI and start a local instance:

```bash
npx supabase start
```

Update `.env.local` with the local Supabase URL and keys printed by that command.

## 4. Running Tests

```bash
npm test
```

Tests use Node's built-in test runner (`node:test`) — no test framework to install. The suite covers:

- `tests/crypto.test.js` — AES-256-GCM encrypt/decrypt, edge cases, wrong keys
- `tests/rate-limit.test.js` — Rate limiter logic
- `tests/intent.test.js` — Intent classification and command parsing
- `tests/onboarding.test.js` — Onboarding flow state machine
- `tests/integration.test.js` — End-to-end handler integration

The only required env var for tests is `ENCRYPTION_KEY`:

```bash
ENCRYPTION_KEY=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa npm test
```

## 5. Deploying to Vercel

### First-time setup

```bash
vercel link
```

Follow the prompts to connect the project to your Vercel account.

### Set environment variables

Set all variables in the Vercel dashboard under Project — Settings — Environment Variables, or via CLI:

```bash
vercel env add ENCRYPTION_KEY production
vercel env add ANTHROPIC_API_KEY production
# ... repeat for each variable
```

### Deploy

```bash
npm run deploy
# or
vercel --prod
```

Vercel reads `vercel.json` for function memory/timeout config and route rewrites. No additional config needed.

## 6. Configuring the Twilio Webhook URL

After deploying, point Twilio to your inbound endpoint:

1. Open [Twilio Console](https://console.twilio.com) — Phone Numbers — Manage — Active Numbers.
2. Select your Sidekick number.
3. Under **Messaging Configuration**, set:
   - **A message comes in**: Webhook
   - **URL**: `https://your-app.vercel.app/api/sms/inbound`
   - **HTTP Method**: POST
4. Save.

Test it by texting your Twilio number from any phone.

## 7. Setting Up QStash Cron Jobs

QStash delivers scheduled HTTP requests to your Vercel functions. Set these up in the [Upstash QStash console](https://console.upstash.com/qstash).

| Job | Endpoint | Schedule (cron) | Notes |
|-----|----------|-----------------|-------|
| Collect analytics | `/api/jobs/collect-analytics` | `0 2 * * *` | Nightly at 2am UTC |
| Weekly summary | `/api/jobs/weekly-summary` | `0 9 * * 1` | Monday 9am UTC |
| Refresh tokens | `/api/jobs/refresh-tokens` | `0 0 */50 * *` | Every 50 days |
| Reset generations | `/api/jobs/reset-generations` | `0 0 1 * *` | 1st of month, midnight UTC |
| Cleanup conversations | `/api/jobs/cleanup-conversations` | `0 3 * * 0` | Sunday 3am UTC |

For each job:
1. In QStash, create a new schedule.
2. **URL**: `https://your-app.vercel.app/api/jobs/<job-name>`
3. **Method**: POST
4. **Body**: `{}`
5. **Schedule**: paste the cron expression above.

QStash will sign each request with `QSTASH_CURRENT_SIGNING_KEY` automatically. The functions verify this signature before executing.

The publish job (`/api/jobs/publish`) is not a cron — it is called by QStash on-demand when a post is scheduled. Sidekick enqueues it via the QStash SDK with a `delay` matching the scheduled post time.

## 8. Configuring Stripe Webhooks

1. Open [Stripe Dashboard](https://dashboard.stripe.com/webhooks) — Webhooks — Add endpoint.
2. **Endpoint URL**: `https://your-app.vercel.app/api/stripe/webhook`
3. **Events to listen to**:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
4. Copy the **Signing secret** (`whsec_...`) and set it as `STRIPE_WEBHOOK_SECRET`.

For local testing use the Stripe CLI:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

The Stripe CLI prints a webhook secret for local use — set that as `STRIPE_WEBHOOK_SECRET` in `.env.local`.
