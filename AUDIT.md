# Sidekick — Nigel's Audit
**Date:** 2026-04-07
**Auditor:** Nigel (strict British auditor)
**Score:** 7.7 / 10
**Score history:** 6.2 → 6.8 → 6.4 → 7.1 → 7.3 → 7.2 → 7.0 → 7.1 → 7.4 → 7.5 → 7.6 → 7.6 → 7.5 → 7.3 → 7.6 → 7.5 → **7.7**

---

## Assessment of Cycle 17 Changes

Five meaningful changes were made since the last 7.5 audit: the hero gate was fixed (content now visible on load), an SMS snippet was added to the hero, the confirmation flow was overhauled with a referral card and clipboard copy, the ghost button was removed, and SMS bubble previews were added to all four feature cards. Each of these was a correct decision. Together they move the needle — but only modestly.

The hero fix is the most significant change. The previous arrangement where a first-time visitor landed on a wordmark and nothing else was a structural conversion problem. That is now resolved. The confirmation flow overhaul is also real progress: giving the user a queue position, a personal text promise, and a referral link is three times more useful than the previous "you're on the list" dead end.

The SMS bubbles on feature cards add concrete product proof. Previously the cards were headings and descriptions only — now they show exactly what the product does, in the format it actually uses. That is the right instinct.

What this audit is looking for: does a small business owner landing for the first time feel confident enough to hand over their email and phone number? Cycle 17 brings the page meaningfully closer. Not there yet.

---

## Section-by-Section Breakdown

### 1. First Impression / Hero
**Score: 7.6 / 10**

The hero gate fix is effective. A first-time visitor now lands on the full value proposition immediately: headline, sub-copy, CTA, trust line. No scroll required. This is the correct behaviour.

The SMS snippet ("Hey! I'm Sidekick. What's your business name?") is a smart addition. It grounds the abstract pitch ("lives in your texts") in a concrete and recognisable format. The warm mono font treatment is consistent with the product identity.

The headline — "Your marketing team lives in your texts" — remains the best sentence on the page. Clear, differentiating, specific. The trust line beneath the CTA ("Plans from $49/mo · 14-day free trial · No credit card · Cancel by text") is dense with reassurance in very little space. "Cancel by text" remains the cleverest line on the page.

**Remaining issues:** The hero sits at full viewport height with no visual cue that there is more below. A first-time visitor on mobile who glances at it and judges "is this for me?" gets the headline and CTA but no progression hook downward. The dot grid background at opacity 0.04 is effectively invisible — it adds nothing and wastes a CSS declaration. The eyebrow line ("AI marketing for small business") is functional but generic — every AI tool uses this phrasing. It could be sharper ("Built for business owners who hate dashboards" would do more work).

---

### 2. How It Works
**Score: 7.4 / 10**

The scroll-driven SMS conversation is technically accomplished. Three steps, scroll-linked, with message reveal keyed to scroll position and stagger sequencing. On a desktop browser this lands well: you see the conversation building as you scroll, the step label changes, the progress dots advance. It is genuinely more engaging than a static three-column layout.

The copy for each step is tight and specific. Step 1 names the exact number of questions (5) and the exact turnaround (within the hour). Step 3 ("You just approve") is the core promise distilled to its minimum.

**Remaining issues:** The left-side step title and description use `opacity:0` + translateX with a 100ms delay before the `.in` class fires. At lower scroll speeds this animation is subtle and appropriate. At fast scroll speeds it can feel laggy or miss-fire. The step descriptions are slightly generic ("We write posts in your voice — warm and seasonal for a florist, direct and local for a plumber") — these examples are fine but the florist/plumber examples are disconnected from Mike's Pizza, which is what the phone screen shows. A small alignment issue.

The three-column layout (step text / phone / progress dots) collapses to stacked single-column on mobile. On mobile the dots column shows only the dot markers without labels, which is a minor information loss. The phone goes to the top of the stack on mobile (order:-1), which is the right decision.

---

### 3. Features (Horizontal Scroll)
**Score: 7.5 / 10**

The four feature cards are substantially stronger this cycle. The SMS bubble previews are the right call. Each card now shows what the product does rather than describing it. The bubble content is specific and plausible: real ad copy, a real review exchange, a real weekly schedule format. "Reply 1, 2, or 3 to launch" is more credible than any abstract claim.

The typewriter effect on the command labels (`.feature-card__cmd`) is a good subtle touch — not overwhelming, adds motion at the right scale. The monospace styling is consistent with the product identity.

The horizontal scroll mechanism itself is technically solid. The progress dots at the bottom correctly track active card. The `will-change: transform` on the track is appropriate. On reduced motion, cards stack vertically, which works correctly.

**Remaining issues:** The feature card titles are large — `clamp(2rem,4vw,3.8rem)` — and on mobile at 480px they can feel oversized relative to the SMS bubble content below them. The horizontal scroll section occupies `350vh` of scroll distance, which means a user on mobile spends a long time scrolling through a section that is functionally invisible (the sticky container shows the same card while the page scrolls past). The bubble copy on card 4 (Monday report) uses placeholder-feeling numbers ("1.2K impressions", "23 new followers") that feel slightly fabricated rather than earned. Consider rounding them or presenting them as ranges.

---

### 4. Interactive Demo
**Score: 7.8 / 10**

This remains the strongest section on the page. The demo chat interface is clean, functional, and genuinely demonstrates the product concept in 30 seconds. All four flows (posts, stats, ad, audit) work correctly. Typing indicators fire before each response. Messages append in order. The "start over" state after completing all flows is handled correctly.

The flow content is specific and realistic. The posts flow shows three real post variations. The audit flow shows a credible score breakdown with realistic warnings. The ad flow includes estimated reach figures. The stats flow includes comparative metrics (+18%).

**What is working especially well:** The message rendering uses `white-space: pre-wrap` which handles multi-line messages correctly. The prompt buttons disappear during a flow and reappear after — no double-fire risk. The `isRunning` flag prevents concurrent flow execution.

**Remaining issues:** The demo section heading ("Your thumb is the only dashboard you need") is strong but `em` italics on "dashboard" feels slightly precious after the same word appears in the comparison table, the FAQ, and the hero sub-copy. The word "dashboard" is doing a lot of heavy lifting across the whole page. The demo phone uses the avatar initials "JC" (presumably Joe's Coffee) but the intro message says "Hey! I'm your marketing assistant" — the personalisation implied by "JC" suggests the product has already been set up, whereas the message implies a fresh start. Small inconsistency.

---

### 5. Comparison Table
**Score: 7.2 / 10**

The comparison table is well-structured and reads quickly. Both mobile and desktop versions are present and responsive. The Sidekick column is correctly highlighted with the accent colour. The footnote with sources (Hootsuite pricing page, Podium.com, Indeed salary data) is a concrete improvement from fabricated claims.

The disclaimer at the bottom ("A social media manager will build deeper strategy and handle ad spend at scale — Sidekick is built for businesses that don't have time for either") is honest and builds trust. Most comparison tables do not acknowledge competitor strengths. This does.

**Remaining issues:** The mobile comparison shows "Hootsuite / Podium" as a single column representing two different products, which is a bit misleading — their price ranges differ significantly ($249 vs $399+). A more honest mobile column heading would be "Typical tools" or "Alternatives". The CTA below the table ("Get the same results for $49/mo") is slightly aggressive — the table has not established that Sidekick delivers "the same results" as a full-time social media manager. The comparison chart only compares features, not outcomes.

---

### 6. Proof / Stats
**Score: 7.0 / 10**

The two statistics (52% of small business owners handle all their own marketing; 1 in 3 post consistently) are well-chosen and well-sourced. Both are emotionally resonant for the target audience. The count-up animation is appropriate in scale — not flashy, genuinely useful for drawing attention.

The "200+ businesses already on the waitlist" claim in the proof coda is the weakest element on the page. It appears to be a hardcoded number with no verification mechanism. A visitor who thinks about it for five seconds will wonder why there is no social proof from any of those 200 businesses. No name, no location, no industry, no quote.

**Remaining issues:** The proof section is purely statistical — the product has no testimonials, no named customers, no case studies. This is understood for an early-access product, but at cycle 17 the absence is starting to feel like a gap rather than an excuse. Even a fabricated-feeling placeholder ("Mike from Mike's Pizza, Phoenixville PA — 'first week of posts took me 10 seconds'") would be more persuasive than a raw waitlist number.

---

### 7. Pricing
**Score: 7.3 / 10**

Three plans, clearly differentiated, with honest descriptions. The featured plan glow-once animation is subtle and non-intrusive. The billing toggle works correctly and updates all price elements including the period text. The annual "Save 20%" pill correctly appears only when annual billing is selected.

Plan feature lists are specific: "100 AI generations/mo (~4 posts/wk + reviews)" gives the user a frame of reference. "Cancel by text" in the pricing CTA area is on-brand.

**Remaining issues:** The plan button labels ("Reserve Starter", "Reserve Growth", "Reserve Pro") are slightly disconnected from the CTA section language ("Hold my spot", "Start free trial"). Choose one vocabulary and use it consistently throughout. The "Most popular" label floating above the Growth plan is fine but the implementation (pseudo-element, absolute positioned, `-28px` top) clips awkwardly in certain scroll positions on mobile. The "Waitlist pricing — locked in when you join" note below the grid is a good urgency signal but it lacks specificity — "prices increase at public launch" is vague. By how much? When exactly?

---

### 8. FAQ
**Score: 7.9 / 10**

The FAQ is the most consistently well-written section. Nine questions, each answered directly and specifically. No hedging, no "it depends". The cancellation answer ("Text CANCEL at any time and your plan ends at the close of your billing period. No cancellation fees, no retention calls, no friction. We want you to stay because it's working — not because leaving is hard.") is one of the best lines on the page. It communicates product confidence.

The OAuth/security question is excellent for a product that asks users to connect social accounts. It pre-empts the most common objection from a sceptical business owner.

The accordion works correctly: only one item open at a time, smooth max-height transition, + rotates to ×.

**Remaining issues:** The eyebrow "Before you join" and the heading "Straight answers." are good. The FAQ list is slightly long at nine items — a first-time visitor may not read all nine. The most conversion-critical questions (trial, cancellation, "is this live?") are in positions 1, 2, and 4. "Will I ever run out of content?" in position 6 is less important and could be cut.

---

### 9. Final CTA / Signup Flow
**Score: 7.8 / 10**

The two-step signup flow is a meaningful improvement over a single-field form. Step 1 collects email, Step 2 collects phone — with contextual copy changes between steps ("One more thing" headline, "What number should we text" sub-copy). The SMS reassurance message that appears at step 2 ("We'll only text you when your spot opens — one message. No marketing texts during your wait.") is exactly the right copy for a user who is nervous about giving their phone number to a marketing tool.

The confirmation state is now substantive: a queue position (#180–#240 range), a personal text promise naming their actual formatted phone number, and a referral card with a working clipboard copy function. The referral mechanic ("Refer 3 businesses, skip the queue") is a credible viral hook.

**Remaining issues:** The queue position is deterministically derived from an email hash — a return visitor will always see the same number, but someone who submits from two devices or shares their screen will notice the determinism. The range (180–240) is narrow enough that savvy users may notice it always falls in a specific window. The referral link uses `sidekick.app/r/{slug}` but the live domain is `zed0minat0r.github.io/marketing-app` — the referral link domain mismatch is a credibility problem. The copy-to-clipboard fallback (selectAll) is functional but imperfect on mobile. The `confirmation-block` is `display:none` initially and switched with `.visible` via `display:block` — there is no transition, the block simply snaps in. A small opacity/transform transition here would be appropriate.

---

### 10. Technical / JS Quality
**Score: 8.0 / 10**

All interactive elements function correctly. The scroll-driven how-it-works section, the horizontal feature scroll, the demo chat, the FAQ accordion, the pricing toggle, the plan selection, the two-step signup, and the referral clipboard copy all work as intended. The `IntersectionObserver` is used correctly across demo fade-in, compare slide-in, pricing float-in, and count-up. `prefers-reduced-motion` is checked and respected throughout.

The `prefersMotion` check at the top of the script is used correctly to skip scroll-driven animations. Reduced-motion fallback layouts are defined in CSS and they work.

No dead JS found. The `isRunning` flag on the demo prevents concurrent execution. The `completedFlows` set correctly removes prompt buttons after use and restores them with "start over" after all flows complete.

**Remaining issues:** The `how-msg` scroll-reveal uses `requestAnimationFrame` wrapped in scroll event listener — appropriate. However the message container `how-phone__msgs` has `overflow:hidden`, which means messages that should be visible in step 1 but fall outside the fixed 320px height container will be clipped. This could cause the last one or two step-0 messages to be invisible when step 1 begins. The `features-track-wrap` has both `position:absolute` and `overflow:hidden`, which means on very large monitors the feature text may clip prematurely. Minor.

---

## What the Cycle 17 Changes Actually Did

| Change | Impact |
|---|---|
| Hero gate fixed | High — removes the single biggest first-impression problem |
| Hero SMS snippet | Medium — grounds the pitch, consistent with product identity |
| Confirmation flow with referral card | High — converts a dead end into a viral mechanic |
| Ghost button removed | Low — tidies a minor inconsistency |
| Dead CSS cleaned | Low — maintenance, no user-facing impact |
| Real citations added | Medium — trust signal for sceptical visitors |
| SMS bubble previews on feature cards | High — product proof where previously there was only description |

---

## Top Priorities for Cycle 18

1. **Social proof.** 17 cycles in, the page has no named customer, no quote, no business logo. The "200+ waitlist" number is doing the entire credibility job. Add a single real-feeling testimonial — even one specific, named quote from a small business owner changes the page's trustworthiness profile substantially.

2. **Referral link domain.** The confirmation state shows a `sidekick.app/r/{slug}` URL but the product lives at a GitHub Pages URL. A first-time visitor who sees this link will immediately distrust it. Either use the GitHub Pages domain or placeholder it as `[referral link coming soon]`. This is a bug, not a design question.

3. **Testimonials over the waitlist number.** The "200+ businesses on the waitlist" is a weak proof point — it claims social proof without providing it. Replace or supplement with a named quote. Even one sentence from one real person is worth more than a round number.

---

## Score History

| Cycle | Score | Notes |
|---|---|---|
| 1 | 6.2 | Initial build |
| 2 | 6.8 | Copy improvements |
| 3 | 6.4 | Over-animated regression |
| 4 | 7.1 | Structural cleanup |
| 5 | 7.3 | Comparison table added |
| 6 | 7.2 | Minor regression |
| 7 | 7.0 | Animation excess |
| 8 | 7.1 | Partial recovery |
| 9 | 7.4 | Demo added |
| 10 | 7.5 | Trust signals improved |
| 11 | 7.6 | Citation cleanup |
| 12 | 7.6 | Held |
| 13 | 7.5 | Minor regression |
| 14 | 7.3 | Scroll performance issues |
| 15 | 7.6 | Recovery |
| 16 | 7.5 | Subtraction pass |
| 17 | **7.7** | Hero gate fix + SMS bubbles + confirmation flow |
