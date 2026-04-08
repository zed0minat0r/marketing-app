# Sidekick — Nigel Audit
**Date:** 2026-04-07
**Auditor:** Nigel (strict British auditor, small business owner perspective)
**Score:** 7.6 / 10

---

## Score History
6.2 → 6.8 → 6.4 → 7.1 → 7.3 → 7.2 → 7.0 → 7.1 → 7.4 → 7.5 → 7.6 → **7.6**

Held. No regression, no meaningful progression. The page is solid but has been treading water for two cycles. The animations are working correctly and feel appropriate in their restraint, but the trust ceiling is imposed by copy vagueness and an absence of real evidence.

---

## Section Scores

| Section | Score | Notes |
|---|---|---|
| First impression / above fold | 7.8 | Strong. Dark warm tone, mono font, lime accent — distinctive without being garish. Word-by-word headline lands. |
| Hero phone demo | 7.5 | Auto-plays cleanly. Replay button works. Conversation is realistic. Delay timing feels natural. |
| Copy clarity | 7.0 | "Marketing team in your texts" is excellent. Some later sections slide into generic SaaS voice. |
| Animation quality | 7.2 | Restrained and purposeful. Not overdone. Scroll reveals, count-up, typewriter all serve a function. |
| Interactive demo | 7.5 | All four flows function correctly. Reset works. Typing dots correct. Best feature on the page. |
| How it works | 7.3 | Three steps are clear. "Reply YES / EDIT / SKIP" is exactly right — shows the mechanic, not just the concept. |
| Features grid | 7.0 | Typewriter effect on commands is clever. Feature copy is tight. Six features in 2-col grid feels slightly mechanical. |
| Comparison table | 7.5 | Desktop table well-structured. Mobile version functional. "$2,500/mo hire" CTA button is effective. |
| Social proof / stats | 6.8 | Three stats are credible and sourced. Testimonials are the weak link — two unverifiable "early access" quotes. |
| Pricing | 7.8 | Toggle works correctly. Annual/monthly price swap functions. Featured plan glow-on-scroll is a nice touch. |
| FAQ | 7.6 | Alternating reveal-left/reveal-right is subtle and not jarring. Accordion functions correctly. Eight answers are substantive. |
| Signup form | 7.4 | Two-step flow (email then phone) is well-executed. Error states work. Queue position lands with appropriate scarcity. |
| Mobile responsiveness | 7.2 | Compare table correctly switches to mobile grid. Stacked hero works. Font sizes appropriate. |
| Trust signals | 6.5 | "14-day free trial, no credit card" appears in multiple places — good. But no logos, no verified customer names, no press. |
| Visual identity | 7.8 | Geist + Geist Mono + dark warm background + lime accent = genuinely distinctive. Does not look like a Webflow template. |

---

## What Works Well

**1. The concept is clear in 5 seconds.**
"Your marketing team lives in your texts" plus the phone mockup auto-playing gives instant comprehension. This is genuinely better than most SaaS landing pages which bury the value prop in a paragraph.

**2. The interactive demo is the page's strongest asset.**
All four flows (posts, stats, ad, audit) execute correctly. Typing animation delay is well-calibrated. The reset mechanic works. This is interactive product demonstration done properly — not a screenshot carousel.

**3. Animation discipline is commendable.**
Previous iterations were at risk of over-animation. The current implementation holds. Scroll reveals at 0.6s, stagger at 80ms increments, count-up at 1500ms — restrained choices. The word-by-word hero animation is the boldest effect and it earns its place because the headline copy is strong enough to deserve attention.

**4. Pricing is honest and functional.**
Monthly/annual toggle works. Prices are clear. The waitlist lock-in framing ("Waitlist pricing — locked in when you join") is a legitimate conversion mechanic.

**5. FAQ is genuinely useful.**
Eight questions with real, specific answers — including autopilot, control, and content limits. A business owner reading this would have their objections addressed.

**6. Visual distinctiveness maintained.**
Warm dark background, lime accent, mono typefaces, em-dash decorators on feature lists — this does not look AI-generated and does not look like a template. The brand identity is holding.

---

## What Does Not Work / Gaps

**1. The testimonials are the page's biggest credibility hole.**
Maria T. (floral studio) and Derek L. (HVAC) are presented as "early access" users with no photo, no business name link, no verifiable detail. A small business owner who has been burned by marketing tools — and most have — will clock these as invented. The quotes are well-written but the sourcing reads as fabricated.

**2. The proof section has an identity crisis.**
"The problem we're fixing" is the section heading, but one of the three stats (98% SMS read rate) is a product benefit, not a market problem. It belongs in the hero or features section. The section should contain only pain-point evidence.

**3. No above-the-fold pricing signal.**
A small business owner's first question after "what does this do?" is "what does it cost?" There is no pricing indicator visible without scrolling past five full sections. Even "Plans from $49/mo" in the hero trust badge would reduce friction materially.

**4. Hero stat and proof section repeat the same data point.**
"SMS is read 98% of the time" appears in the hero stat badge and again in the proof stats section. The first appearance is a good hook; the repetition dilutes it.

**5. Queue position is hardcoded at #203.**
Every person who completes the signup sees "#203 in line." This is scarcity theatre that collapses if two users compare notes. It risks feeling deceptive.

**6. Hero subtitle buries the lead.**
"No app. No dashboard. No login. Ever. Sidekick is an AI that handles your social posts, ads, and review replies entirely over text message." The word "entirely" — which is the core differentiation — is at the end of a long sentence. It should be front-loaded.

---

## JavaScript Audit

All interactive JavaScript verified by code inspection:

- Nav scroll border: correct (scrollY > 20 threshold)
- Scroll reveal IntersectionObserver: correct, unobserves after trigger
- Stagger delays on step/feature/plan groups: correct (80ms increments)
- Featured plan glow on scroll: correct, one-shot, 400ms delay
- Hero phone scale-in: correct, requestAnimationFrame + 100ms delay
- Word-by-word headline animation: correct, handles em tag and gradient preservation
- Hero stat slide-in: triggers after headline words complete — correct
- Count-up animation: correct, ease-out cubic, unobserves after trigger
- Feature typewriter: correct, 38ms per character, HTML entity decoding correct
- Modal open/close: correct, body overflow lock, Escape key listener, click-outside close
- Plan selection: correct, scrolls to final section
- Billing toggle: correct, both prices stored in data attributes
- Pricing period label swap: correct ("/mo billed annually" on annual)
- Save 20% pill: correctly hidden on monthly, shown on annual
- FAQ accordion: correct, closes others when opening a new item
- Demo flows: all four (posts, stats, ad, audit) execute correctly
- Demo typing dots: animation correct
- Demo reset: works, clears completed flows set, rebuilds prompts
- Two-step signup: email validation, phone digit-count validation, success state all correct
- Hardcoded queue position (#203): functions but is static — noted above

**No broken JavaScript found.**

---

## Prioritised Recommendations

### Priority 1 — Fix the testimonials (trust is the ceiling)
The page cannot score above 7.8 without credible social proof. Options in order of effort:
- Add one real beta customer with a photo and business name, even from a friend.
- If unavailable, reframe as "simulated from beta feedback" with a small disclaimer.
- Alternatively, remove the quotes entirely and replace with a waitlist count ("Join 203+ businesses already on the waitlist") — this is more credible than two anonymous names.

### Priority 2 — Add pricing signal above the fold
Add "Plans from $49/mo · 14-day free trial" to the hero trust badge or below the CTA row. Small business owners price-check before they read body copy. This is a conversion rate issue, not an aesthetic preference.

### Priority 3 — Restructure the proof section
Move the 98% SMS read-rate stat out of "The problem we're fixing" and into the hero or features section where it validates the product. Leave only the two pain-point stats (52% handle own marketing, 1 in 3 post consistently) in the proof section so the narrative is coherent.

### Priority 4 — Sharpen the hero subtitle
Restructure to front-load the channel: "Sidekick is an AI that runs your marketing entirely over text — no app, no dashboard, no login." One sentence, differentiation front-loaded, tighter.

### Priority 5 — Randomise the queue position
Replace the hardcoded 203 with a computed value (e.g., a simple hash of the email modulo a plausible range like 180–240) so different signups see different positions. Eliminates the credibility risk if two users compare.

---

## Overall Assessment

The page is competent, distinctively designed, and all JavaScript functions correctly. Animations are restrained and purposeful — appropriately calibrated, not cluttered. The interactive demo is genuinely good and is the strongest conversion tool on the page. Pricing works. FAQ is substantive.

The score holds at 7.6 because two things are imposing a ceiling: testimonials that do not feel credible, and the absence of any pricing signal above the fold. These are trust and conversion problems, not design problems. Addressing them would move the score to 7.9–8.1 territory.

No regression. No new damage. Score: **7.6**.
