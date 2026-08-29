# Sidekick Growth Engine — Game Plan

**Date:** 2026-08-24. **Goal:** Sidekick doesn't just post for the user — it grows their pages.
The engine: **post → measure → adapt**, built on plumbing that already exists
(nightly `analytics_snapshots`, weekly summary job, per-user voice settings).

Constraints honored throughout: Vercel Hobby (12 functions max — we're at 10, add ZERO new
functions; 1 daily cron — everything rides the existing dispatch), Twilio pending (nothing
below requires live SMS to build; live testing after approval), no invented numbers ever
(RULE 7) — every claim in a user-facing message traces to a measured value.

---

## Phase 1 — The Adaptive Loop (build NOW, testable without Twilio)

The weekly report stops reporting and starts steering.

1. **Migration 007:**
   - `users.city TEXT` (local mechanics later; asked during onboarding eventually)
   - `users.content_insights JSONB` — rolling learned performance: top topic/format/hour,
     best post, computed `as_of`
   - `users.active_experiment JSONB` — the one live test: `{type, variant, control,
     started_at, posts:[]}`
   - `scheduled_posts.topic TEXT`, `scheduled_posts.format TEXT` — tagged at generation time

2. **Tag content at creation** — the generation JSON contract gains `topic` (2-3 word label,
   e.g. "weekend special") and `format` ("photo" | "offer" | "announcement" | "tip" |
   "engagement question"). Stored on the post row. Costs zero extra tokens (same call).

3. **`lib/growth.js`** — pure analysis, unit-testable:
   - `computeInsights(posts, snapshots)` → engagement per post, winners by topic / format /
     posting hour, best single post. Honest small-sample handling: below 3 posts in a bucket
     we report the best post, not a "trend".
   - `evaluateExperiment(experiment, posts, snapshots)` → did the variant beat the control?
     Returns a measured verdict or "not enough data" — never a guess.
   - `proposeExperiment(insights, history)` → next single test. v1 rotates: posting time →
     format → topic. One live experiment at a time.

4. **Weekly job evolves** (same dispatch cron): report → evaluate last experiment → recompute
   insights → store both on the user → propose next experiment → the Monday text carries all
   of it ("Your photo posts got 2.1x your average reach - leaning into that. This week's
   test: posting at 7pm instead of noon.").

5. **Prompt injection** — `buildSystemPrompt` gains a MEASURED-WINS section from
   `content_insights` + the active experiment, so every generated draft leans toward what
   worked and honors the live test.

## Phase 2 — Photo-First Growth (NOT BLOCKED — live since 2026-08-24)

Real photos of a real business beat generic copy for local reach. Photo intake, tagging and
auto-drafting are BUILT AND WORKING TODAY.

**This section used to say "blocked on keys" and that is wrong — it misled me into telling Matt
photos were blocked on 2026-08-29, and he corrected me.** `lib/storage.js` is dual-backend and
**Supabase Storage is the DEFAULT**, riding the `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` the app
already requires, into the public `customer-photos` bucket. Cloudflare R2 is an optional upgrade that
only takes over when ALL five `R2_*` vars are set. `config-check` lists `R2_*` and
`REPLICATE_API_TOKEN` under OPTIONAL_KEYS, and the live config reports 22/22 required set with zero
missing.

The only thing absent without `REPLICATE_API_TOKEN` is the photo ENHANCEMENT step, which is written
to skip gracefully rather than fail.

**The remaining work is product, not plumbing:** make Sidekick push for photos — "text us a photo"
nudges during onboarding, and in the weekly text when a user's photo library is thin.

## Phase 3 — Engagement Speed (BUILT 2026-08-24; one manual step outstanding)

**This section used to describe Phase 3 as unbuilt and said `pages_manage_engagement` and
`instagram_manage_comments` were "not requested anywhere". Both are wrong** — it was written as a
spike plan on 2026-08-24 and the work shipped the same day (commit 2136e52), but the plan was never
updated. On 2026-08-29 I read it instead of the code and told Matt there was a feature to build.
Verify against the code, not this file.

**What actually exists:**
- `lib/oauth-handlers/meta-start.js` requests all nine scopes, including `pages_manage_engagement`
  and `instagram_manage_comments`.
- `api/meta/webhook.js` — the subscription handshake plus event intake. Every payload is treated as
  an untrusted hint and the comment is re-fetched from the Graph API with our stored page token.
- `lib/comment-replies.js` and `lib/review-replies.js` — draft a reply in the owner's voice.
- Approval over SMS: `YES` / `SKIP` / `reply: ...`.
- `META_WEBHOOK_VERIFY_TOKEN` is set in Vercel and the live webhook correctly 403s a bad token.

**THE ONLY THING LEFT is a one-time step inside Matt's Meta dashboard** (docs/SETUP.md §8), which
nobody can do for him: subscribe object **Page** (field `feed`) and object **Instagram** (field
`comments`) to `https://marketing-app-navy.vercel.app/api/meta/webhook` using the verify token from
Vercel env. He can reveal that value in the Vercel dashboard; the API returns it encrypted.

Until that subscription exists, Meta never pushes comment events and the loop simply never fires.

**Dev Mode still applies:** while the app is in Development Mode every permission works for accounts
with a role on it, so the whole loop is testable on Matt's own page with zero approvals.

**Meta App Review** — materials for the permissions are written in `docs/META-APP-REVIEW.md`.
**Whether it was ever filed is still unknown — ASK MATT.** Turnaround is weeks, so it wants filing
long before public launch.

## Phase 4 — Local Mechanics

- Generation prompt uses `users.city` + business type for geo-flavored copy and local tags.
- "Ask for reviews" command: drafts a review-request message the OWNER forwards to their own
  customers. Sidekick never texts third parties — the owner's customers never opted in to us
  (TCPA line we do not cross).
- Onboarding gains the city question (fills `users.city`).

## Competitive research verdict (2026-08-24)

Full sweep of Hootsuite/Buffer/Later, Podium/Birdeye/NiceJob, Constant Contact, and the
AI-first tools (Predis, Ocoya). Key conclusions:

- **Add: review REQUESTS by text (the missing money feature).** Podium ($399-999/mo),
  Birdeye ($299-399/mo), NiceJob ($75-125/mo) sell review GENERATION, not just replies.
  SMS review requests convert 3-5x email (12-15% vs 3-4%). Sidekick's version: owner texts a
  customer's number after a job, Sidekick sends one review invite. COMPLIANCE: this texts
  third parties - needs a consent attestation flow (owner confirms the customer agreed),
  STOP honored, single-message policy, and eventually a Twilio use-case update (current
  toll-free verification declares owner-only traffic). Design consent first, then build.
- **Review replies validated** but AI drafting is not the moat (Podium/Birdeye have it;
  Google is rolling out free AI replies inside Business Profile). The moat is
  approve-from-your-truck-in-one-text.
- **The adaptive loop is the pitch lead**: only 18% of SMBs feel confident their marketing
  works (Constant Contact 2025); "tells you every week what actually worked" attacks the #1
  documented pain. Lead marketing with it.
- **Website audit is commoditized** (HubSpot Grader free forever) - repurpose as the free
  acquisition hook ("text AUDIT to this number"), not a paid capability.
- **Ads descope confirmed.** Future middle path: "this post is your winner - boost it for
  $20?" (reuses the adaptive loop's data, avoids the Marketing API).
- **Positioning that holds up**: "Marketing that runs itself over text - no app, no
  dashboard, no login - and it tells you every week what actually worked." The
  operator-texts interaction model has no direct competitor; the $49-199 band is empty for
  the combined social+reviews+engagement job.

**Revised build order:** (1) Google review monitoring + text-approved replies →
(2) review requests by text (consent design first) → (3) FB/IG comment replies →
(4) website audit becomes the free funnel.

## Phase 5 — Customer Messaging (promos, appointment reminders, review requests)

Matt's direction 2026-08-24: Sidekick should text the BUSINESS'S CUSTOMERS (promos,
appointment reminders). Original call was to run beta on the ONE existing toll-free number
(~$1.15/mo/business local numbers offered and declined on cost).
REVISED 2026-08-25 (Matt): the STOP collision is not acceptable - "we definitely need
multiple twilio lines." Every business that buys the customer-messaging add-on gets its OWN
number, funded by the add-on fee. The shared toll-free remains for owner-facing traffic only.

Design constraints locked in:
- The "from" number is a DATA FIELD (per business, defaulting to the shared toll-free), so
  provisioning a per-business number is config + a Twilio purchase, not a rebuild.
- Per-business numbers eliminate the STOP collision entirely: a customer's STOP only ever
  silences the one business they stopped. Cost: ~$1.15/mo local (needs A2P 10DLC campaign
  registration - we have the EIN) or ~$2.15/mo toll-free (needs per-number verification);
  either is covered many times over by the add-on price.
- Consent: the OWNER attests their customer agreed to receive texts (attestation stored,
  like the waitlist consent snapshot); every customer message carries the business name and
  opt-out language; STOP honored instantly and logged.
- Twilio use case must be updated before this ships to real customers (current verification
  declares owner-only traffic).

v1 surface: "remind [name] [number] [when] about [what]" (appointment reminder),
"text my customers [promo]" (to the consented list), review requests after a job. All
approval-by-text, all logged per business.

## Parked: Twitter/X posting

Matt's call 2026-08-25: skip. X's API has no free tier (pay-per-use since Feb 2026,
~$0.015/post, $0.20 with a link) and our users' customers are on IG/FB/Google. If demand
appears, ship it as a PAID ADD-ON whose fee covers the per-post cost - same model as
customer messaging. ~1 day build (OAuth 2.0 PKCE connect + publish handler).

## Sequencing

1. Phase 1 now (this session): migration, tagging, growth lib + tests, weekly job, prompt.
2. Phase 4's city question + prompt flavor ride along cheaply with Phase 1's migration.
3. Phase 2 the day R2/Replicate keys arrive.
4. Phase 3 spike after Twilio approval + Meta dry run.
