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

## Phase 3 — Engagement Speed (research first; Meta-gated)

Fast comment/DM replies are a bigger reach lever than more posts, but reading/writing
comments needs Meta permissions likely gated on App Review (see docs/META-APP-REVIEW.md).
Step 1 is a spike: what do our current scopes allow on owned pages? v1 shape when unblocked:
collect-analytics also pulls new comments → drafts replies → owner approves by text → posted.
Do NOT promise this on the site until the spike lands.

## Phase 4 — Local Mechanics

- Generation prompt uses `users.city` + business type for geo-flavored copy and local tags.
- "Ask for reviews" command: drafts a review-request message the OWNER forwards to their own
  customers. Sidekick never texts third parties — the owner's customers never opted in to us
  (TCPA line we do not cross).
- Onboarding gains the city question (fills `users.city`).

## Sequencing

1. Phase 1 now (this session): migration, tagging, growth lib + tests, weekly job, prompt.
2. Phase 4's city question + prompt flavor ride along cheaply with Phase 1's migration.
3. Phase 2 the day R2/Replicate keys arrive.
4. Phase 3 spike after Twilio approval + Meta dry run.
