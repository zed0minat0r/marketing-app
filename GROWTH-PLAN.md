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

## Phase 2 — Photo-First Growth (code exists; blocked on keys)

Real photos of a real business beat generic copy for local reach. Photo intake, tagging,
enhancement, and auto-drafting are BUILT — they need `R2_*` (Cloudflare R2) and
`REPLICATE_API_TOKEN` in Vercel env. When Matt provides keys: enable, then make the product
push photos ("text us a photo" nudges in onboarding + weekly texts when the library is thin).

## Phase 3 — Engagement Speed (spike done 2026-08-24; Meta-gated)

**Findings:** the OAuth flow currently requests `pages_show_list`, `pages_read_engagement`,
`pages_manage_posts`, `instagram_basic`, `instagram_content_publish` (meta-callback.js).
Reading comments rides `pages_read_engagement` (already requested). REPLYING needs
`pages_manage_engagement` (FB) + `instagram_manage_comments` (IG) — not requested anywhere,
and both are Advanced-tier App Review permissions. DMs need `pages_messaging` (bigger lift —
skip for now).

**The Development Mode loophole that makes beta possible:** while the Meta app is in Dev
Mode, ALL permissions work for users with a role on the app (admin/tester). Matt's own
accounts — beta user #1 — can run the full comment-reply loop with zero approvals.

**Path:** (1) add the two reply scopes to the OAuth URL + token storage; (2) extend
collect-analytics to pull new comments and text the owner a drafted reply for YES-approval;
(3) submit Meta App Review — materials for the current 5 permissions are already written in
docs/META-APP-REVIEW.md (submission status unknown — ASK MATT whether it was ever filed);
write statements for the 2 new scopes and submit all together. Review turnaround is weeks, so
file it long before public launch.

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

## Sequencing

1. Phase 1 now (this session): migration, tagging, growth lib + tests, weekly job, prompt.
2. Phase 4's city question + prompt flavor ride along cheaply with Phase 1's migration.
3. Phase 2 the day R2/Replicate keys arrive.
4. Phase 3 spike after Twilio approval + Meta dry run.
