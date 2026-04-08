# Sidekick API Reference

All endpoints are deployed as Vercel serverless functions. Production base URL: `https://sidekick.app`

**Internal endpoints** are marked with `[INTERNAL]`. They require the `x-internal-secret` header matching `INTERNAL_API_SECRET`.

---

## SMS

### POST /api/sms/inbound

Twilio webhook. Receives incoming SMS from users, routes through the AI pipeline, and sends a reply.

**Auth:** Twilio HMAC-SHA256 signature (`x-twilio-signature` header). Validated via `TWILIO_AUTH_TOKEN`. Skipped in dev when the env var is absent.

**Request body** (form-encoded, sent by Twilio):

| Field | Type | Description |
|-------|------|-------------|
| `From` | string | Sender's E.164 phone number |
| `Body` | string | Message text |
| `MessageSid` | string | Twilio message ID |
| `To` | string | Your Twilio number |

**Responses:**

- `200 OK` — Always returned to Twilio (prevents retries), even on internal errors.
- `403 Forbidden` — Invalid Twilio signature.
- `405 Method Not Allowed` — Non-POST request.

**Example curl (dev, no signature):**
```bash
curl -X POST https://sidekick.app/api/sms/inbound \
  -d "From=%2B15555550100&Body=Write+a+post+about+our+lunch+special&MessageSid=SM123&To=%2B18005551234"
```

---

### POST /api/sms/outbound

Sends an SMS to a phone number using Twilio. Called internally by other handlers.

**Auth:** None (internal module — not a public HTTP endpoint, though it may be routed via Vercel).

**Request body (JSON):**

| Field | Type | Description |
|-------|------|-------------|
| `to` | string | E.164 phone number |
| `body` | string | SMS text content |

**Responses:**

- `200 OK` — Message sent. Returns Twilio message SID.
- `500` — Twilio error.

---

## OAuth

### GET /api/oauth/meta/start

Initiates the Meta (Facebook + Instagram) OAuth 2.0 flow. The `token` parameter is a one-time link sent to the user via SMS.

**Auth:** One-time SMS token validated against `oauth_links` table.

**Query parameters:**

| Param | Required | Description |
|-------|----------|-------------|
| `token` | yes | One-time link token from SMS |

**Behavior:**
1. Validates the token (must exist, unused, not expired).
2. Marks token as used.
3. Generates CSRF state, stores in `oauth_states`.
4. Redirects `302` to Meta's OAuth consent screen.

**Scopes requested:** `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `instagram_basic`, `instagram_content_publish`, `instagram_manage_insights`, `business_management`

**Responses:**

- `302 Redirect` — To Meta OAuth.
- `400 Bad Request` — Invalid/expired/used token.
- `405 Method Not Allowed` — Non-GET request.
- `500` — Internal error.

**Example curl:**
```bash
curl -L "https://sidekick.app/api/oauth/meta/start?token=abc123def456"
```

---

### GET /api/oauth/meta/callback

Meta OAuth callback. Exchanges the `code` for an access token, fetches Pages and Instagram accounts, stores them encrypted.

**Query parameters:**

| Param | Required | Description |
|-------|----------|-------------|
| `code` | yes | Authorization code from Meta |
| `state` | yes | CSRF state token |

**Responses:**

- `302 Redirect` — To `/connected` on success.
- `400 Bad Request` — Invalid state or code.
- `500` — Token exchange or DB error.

---

### GET /api/oauth/twitter/start

Initiates X (Twitter) OAuth 2.0 PKCE flow. The `token` parameter is a one-time link sent to the user via SMS.

**Auth:** One-time SMS token validated against `oauth_links` table.

**Query parameters:**

| Param | Required | Description |
|-------|----------|-------------|
| `token` | yes | One-time link token from SMS |

**Behavior:**
1. Validates the token (must exist, unused, not expired).
2. Generates PKCE `code_verifier` + `code_challenge` (SHA256).
3. Packs verifier into the `state` field for retrieval at callback.
4. Redirects to Twitter's authorization page.

**Scopes requested:** `tweet.read`, `tweet.write`, `users.read`, `offline.access`

**Responses:**

- `302 Redirect` — To Twitter OAuth.
- `400 Bad Request` — Invalid/expired/used token.
- `405 Method Not Allowed` — Non-GET request.
- `500` — Internal error.

---

### GET /api/oauth/twitter/callback

Twitter OAuth callback. Exchanges code for tokens using PKCE, stores tokens encrypted.

**Query parameters:**

| Param | Required | Description |
|-------|----------|-------------|
| `code` | yes | Authorization code from Twitter |
| `state` | yes | CSRF + PKCE verifier state |

**Responses:**

- `302 Redirect` — To `/connected` on success.
- `400 Bad Request` — Invalid state or code.
- `500` — Token exchange or DB error.

---

## Social

### POST /api/social/post

`[INTERNAL]` Publish a scheduled post to its target social platforms.

**Auth:** `x-internal-secret` header required.

**Request body (JSON):**

| Field | Type | Description |
|-------|------|-------------|
| `post_id` | string (UUID) | ID of the `scheduled_posts` record |

**Behavior:**
- Loads the post from Supabase.
- Publishes to each platform in `post.platforms` (facebook, instagram, twitter).
- Updates post status to `posted` or `failed`.
- Texts the user confirmation with live URLs on success.

**Instagram note:** Feed posts require an image. If no `media_url` is on the post, the system attempts to generate a branded SVG via `IMAGE_UPLOAD_URL`. If that env var is not set, Instagram publishing fails gracefully and the user is notified via SMS.

**Responses:**

- `200 OK` — `{ success: true, urls: { facebook: "...", instagram: "..." }, errors: {} }`
- `200 OK` — `{ success: true, message: "Already posted" }` (idempotent)
- `400 Bad Request` — Missing `post_id`.
- `405 Method Not Allowed`
- `500` — All platforms failed.

**Example curl:**
```bash
curl -X POST https://sidekick.app/api/social/post \
  -H "Content-Type: application/json" \
  -H "x-internal-secret: $INTERNAL_API_SECRET" \
  -d '{"post_id": "uuid-here"}'
```

---

## AI

### POST /api/ai/generate

`[INTERNAL]` Call Claude directly with user context and conversation history. Returns structured JSON (intent + optional action).

**Auth:** `x-internal-secret` header required.

**Request body (JSON):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `user_id` | string (UUID) | yes | User's Supabase ID |
| `message` | string | yes | User's message |
| `conversation_history` | array | no | Prior messages (fetches last 20 if omitted) |

**Response (JSON):**

| Field | Type | Description |
|-------|------|-------------|
| `reply` | string | Claude's SMS reply text |
| `intent` | string | Classified intent |
| `action` | object or null | Structured action (draft_post, schedule_post) |
| `model` | string | Claude model used |
| `tokens_used` | number | Token count |

**Example curl:**
```bash
curl -X POST https://sidekick.app/api/ai/generate \
  -H "Content-Type: application/json" \
  -H "x-internal-secret: $INTERNAL_API_SECRET" \
  -d '{"user_id": "uuid-here", "message": "Write a post about our new menu"}'
```

---

## Jobs

All job endpoints are triggered by QStash and validate the `upstash-signature` header. Signature validation is skipped in dev when `QSTASH_CURRENT_SIGNING_KEY` is absent.

### POST /api/jobs/publish

Publishes a queued post at its scheduled time.

**Auth:** QStash JWT signature.

**Request body (JSON):**

| Field | Type | Description |
|-------|------|-------------|
| `post_id` | string (UUID) | Post to publish |

**Behavior:**
- Idempotent: skips if status is already `posted` or `publishing` (unless stale >5 min).
- Retries up to 3 times on failure (returns 500 to trigger QStash retry).
- Texts user success/failure after publishing.

**Responses:**

- `200 OK` — Published or already posted.
- `400` — Missing `post_id`.
- `403` — Invalid QStash signature.
- `404` — Post not found.
- `500` — Publish failed (triggers QStash retry).

---

### POST /api/jobs/collect-analytics

`Cron: nightly at 2am UTC`

Collects engagement metrics for posts published in the last 25 hours from Facebook, Instagram, and Twitter APIs.

**Auth:** QStash JWT signature.

**Request body:** Empty JSON `{}`

**Response:**

```json
{ "success": true, "collected": 12, "failed": 1, "postsProcessed": 7 }
```

---

### POST /api/jobs/weekly-summary

`Cron: Monday 9am UTC`

Generates and sends a weekly analytics summary via SMS to all users with at least one post in the prior week.

**Auth:** QStash JWT signature.

**Request body:** Empty JSON `{}`

**Response:**

```json
{ "success": true, "sent": 43, "skipped": 12, "weekStart": "2026-03-30" }
```

---

### POST /api/jobs/refresh-tokens

`Cron: every 50 days`

Refreshes social media access tokens expiring within 15 days. Meta tokens are exchanged for long-lived tokens. Twitter tokens use the refresh_token grant. Users are notified via SMS if refresh fails so they can reconnect.

**Auth:** QStash JWT signature.

**Response:**

```json
{ "success": true, "refreshed": 8, "failed": 1, "accountsChecked": 9 }
```

---

### POST /api/jobs/reset-generations

`Cron: 1st of each month at midnight UTC`

Resets `generations_used` to 0 for all users. Calls the `reset_monthly_generations()` Supabase RPC; falls back to a direct UPDATE if the RPC does not exist.

**Auth:** QStash JWT signature.

**Response:**

```json
{ "success": true, "message": "Monthly generation counters reset", "timestamp": "2026-04-01T00:00:00.000Z" }
```

---

### POST /api/jobs/cleanup-conversations

`Cron: Sunday 3am UTC`

Deletes conversation records older than 90 days per data retention policy. Notifies affected users via SMS before deleting.

**Auth:** QStash JWT signature.

**Response:**

```json
{ "success": true, "deletedForUsers": 3, "usersNotified": 3, "cutoffDate": "2026-01-07T03:00:00.000Z" }
```

---

## Stripe

### POST /api/stripe/webhook

Handles Stripe subscription lifecycle events. Raw body is passed through for Stripe signature verification (body parsing is disabled in `vercel.json` for this route).

**Auth:** Stripe webhook signature (`stripe-signature` header) validated against `STRIPE_WEBHOOK_SECRET`.

**Events handled:**

| Event | Action |
|-------|--------|
| `customer.subscription.created` | Updates user plan + generation limit. Texts user on upgrade. |
| `customer.subscription.updated` | Same as above. |
| `customer.subscription.deleted` | Downgrades to Starter. Texts user. |
| `invoice.payment_failed` | Texts user to update payment method. |

**Response:**

- `200 OK` — `{ received: true }`
- `400` — Invalid signature or missing header.
- `405` — Non-POST.
- `500` — Internal error.

**Example curl (test mode):**
```bash
stripe trigger customer.subscription.created \
  --webhook-url https://sidekick.app/api/stripe/webhook
```
