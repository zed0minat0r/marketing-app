# Sidekick Local Dev Environment

A local development stack with Postgres, Redis, and a mock Twilio interceptor.
No real SMS will be sent and no real money will be charged during local development.

---

## Prerequisites

- Docker and Docker Compose
- Node.js 18+
- npm

---

## 1. Start the local database and Redis

```bash
cd /path/to/marketing-app
docker compose -f dev/docker-compose.yml up -d
```

Wait for the containers to be healthy (about 10 seconds):

```bash
docker compose -f dev/docker-compose.yml ps
```

Both `sidekick-postgres` and `sidekick-redis` should show `healthy`.

The Postgres container auto-runs `schema.sql` on first boot — no manual migration needed.

---

## 2. Configure your local environment

Copy the example env file and fill in any missing values:

```bash
cp .env.example .env.local
```

Update `.env.local` for local dev. At minimum:

```env
# Local Postgres (docker-compose)
DATABASE_URL=postgresql://sidekick:sidekick_dev@localhost:5432/sidekick

# Local Redis
UPSTASH_REDIS_REST_URL=redis://localhost:6379
# Leave UPSTASH_REDIS_REST_TOKEN blank for local Redis

# Supabase (use your real project for DB, or point at local Postgres)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Admin dashboard password
ADMIN_PASSWORD=your-local-admin-password

# Point SMS outbound at mock Twilio instead of real Twilio
TWILIO_API_URL=http://localhost:3001
```

---

## 3. Seed the database with test data

```bash
npm run dev:seed
```

This inserts:
- 5 users at different onboarding stages
- 20 conversations (mix of inbound/outbound, various intents)
- 3 social accounts (Instagram, Facebook)
- 5 scheduled posts (draft, queued, posted)

To reset and re-seed, just run the command again — it clears existing data first.

---

## 4. Start the mock Twilio interceptor

```bash
npm run dev:mock-twilio
```

The mock server listens on `http://localhost:3001`. It intercepts all SMS traffic and
prints messages to your terminal instead of sending real texts.

Test it with curl:

```bash
# Simulate an inbound SMS from a user
curl -X POST http://localhost:3001/sms/inbound \
  -d "From=%2B14845551234&To=%2B18005550100&Body=Post+about+our+lunch+special"

# Simulate sending an outbound SMS
curl -X POST http://localhost:3001/sms/send \
  -d "From=%2B18005550100&To=%2B14845551234&Body=Here+is+your+draft+post..."

# View recent intercepted messages
curl http://localhost:3001/messages | jq .

# Health check
curl http://localhost:3001/health
```

---

## 5. Start the app in dev mode

```bash
npm run dev
```

This starts Vercel dev server on `http://localhost:3000`.

---

## 6. Open the admin dashboard

Navigate to:

```
http://localhost:3000/admin.html
```

The admin password is checked client-side against a SHA-256 hash.
For local dev, set `window._ADMIN_HASH` in your server's HTML response or temporarily
hard-code a known hash for development.

To generate the SHA-256 hash of your password:

```bash
node -e "const crypto=require('crypto'); console.log(crypto.createHash('sha256').update('your-password').digest('hex'))"
```

---

## Teardown

```bash
# Stop containers (keeps data)
docker compose -f dev/docker-compose.yml stop

# Stop and remove containers and volumes (wipes DB)
docker compose -f dev/docker-compose.yml down -v
```

---

## Connection Details

| Service  | Host       | Port | Credentials                          |
|----------|------------|------|--------------------------------------|
| Postgres | localhost  | 5432 | sidekick / sidekick_dev / sidekick   |
| Redis    | localhost  | 6379 | (no auth)                            |
| Mock SMS | localhost  | 3001 | N/A                                  |
| App      | localhost  | 3000 | N/A                                  |
