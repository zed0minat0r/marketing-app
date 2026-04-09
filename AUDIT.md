# Sidekick — Nigel's Audit
**Date:** 2026-04-07
**Auditor:** Nigel (strict British auditor)
**Score:** 7.5 / 10
**Score history:** 6.2 → 6.8 → 6.4 → 7.1 → 7.3 → 7.2 → 7.0 → 7.1 → 7.4 → 7.5 → 7.6 → 7.6 → 7.5 → 7.3 → 7.6 → **7.5**

---

## Assessment of the Subtraction Pass

The changes described — typewriter removed, features trimmed 6→4, film grain/scroll glow/glassmorphism stripped, stat numbers scaled down, trust line strengthened, SMS reassurance added, citations fixed — are directionally correct. Fewer moving parts, more honest claims, better trust language. However, the page has not improved from 7.6. It has held at 7.5. The subtraction pass removed excess but did not fix the underlying structural problems that have been present since cycle 7. It is leaner but not meaningfully better for a first-time visitor.

---

## Section-by-Section Breakdown

### 1. First Impression / Hero
**Score: 7.2 / 10**

The scroll-linked wordmark shrink is genuinely clever and technically clean. It communicates "this is not another generic SaaS template" within the first two seconds, which is valuable. The dark, warm palette with lime accent is distinctive — not teal, not blue, not Inter. Good.

However: the hero still asks the user to scroll before the value proposition appears. A small business owner who has never heard of Sidekick lands on a massive word — "Sidekick" — with zero context and no call to action. The actual headline ("Your marketing team lives in your texts") and useful sub-copy are hidden behind 60% of a scroll phase. A business owner who is exhausted and time-poor will not scroll to find the pitch. They will leave.

The dot grid background is subtle at opacity 0.04 — almost invisible, which is appropriate. The eyebrow line "AI marketing for small business" is functional.

Hero trust line ("Plans from $49/mo · 14-day free trial · No credit card · Cancel by text") is strong and specific. "Cancel by text" is appropriately on-brand and differentiating.

**What is wrong:** The headline content is only visible to users who scroll halfway through the first section. For anyone who is not immediately engaged, the page starts with one word. That is a structural conversion risk.

---

### 2. How It Works
**Score: 7.8 / 10**

This is the best section on the page. The three-column scroll-driven layout — copy on left, live phone conversation in centre, dot progress on right — is coherent and communicates the product's core behaviour rather than merely describing it. The phone conversation content is specific and believable: Mike's Pizza, real platform questions, realistic post copy. The checkmark reveal is restrained.

The step copy is good: "Answer 5 questions over text" is concrete, not vague. "You just approve" is exactly the right framing for a time-poor business owner.

The one persistent issue: on mobile the dots-col becomes a horizontal row of dots with no labels. The step progression — Setup / Content / Approved — is invisible on mobile. The dots convey nothing without labels. This has been noted in previous audits and remains unaddressed.

---

### 3. Features (Horizontal Scroll)
**Score: 7.0 / 10**

Trimming from 6 to 4 cards was the right call. The remaining four map directly to real small business pain points: Facebook ad, Google review, weekly posts, Monday report.

The typewriter animation on the command lines (e.g. `> "run an ad"`, `> new review detected`) is a nice touch — not gratuitous, it demonstrates the interface metaphor.

However: the feature cards are almost entirely text. There is no visual evidence of the product — no screenshot, no rendered output, no phone frame, no example post. The How It Works section shows a phone; the features section abandons it. A first-time visitor is asked to believe four claims with no supporting artefact.

Also: the horizontal scroll is scroll-jacked. A user who wants to reach pricing must scroll through all 4 cards. At 350vh for 4 cards that is 87.5vh per card — defensible, but still feels like being held hostage when you already understand the product. No escape mechanism exists short of dragging the scrollbar.

---

### 4. Interactive Demo
**Score: 8.2 / 10**

This remains the strongest differentiator on the page. Four complete conversation flows (posts, stats, ad, audit), each with realistic typing delays and specific, named content: Joe's Coffee, Phoenixville location, actual post copy. The "start over" mechanic after all flows are complete is clean. The phone fade-in on scroll is smooth and not overdone.

The audit flow is a particularly good piece of copy — scoring the user's hypothetical website at 6.2/10 with specific labelled issues (WARN/FAIL) is concrete and confidence-building.

Minor inconsistency: the demo phone header shows "JC" avatar (Joe's Coffee) but the prompt buttons remain generic ("Write this week's posts" rather than "Write Joe's posts"). Not damaging.

The reset mechanism works correctly. JavaScript is sound. No broken flows detected.

---

### 5. Comparison Table
**Score: 7.4 / 10**

The comparison is credible. Real competitor names (Hootsuite, Podium), real price ranges, a citation note that acknowledges a social media manager's genuine advantages. The concession — "A social media manager will build deeper strategy and handle ad spend at scale — Sidekick is built for businesses that don't have time for either" — is unusually honest for a landing page and builds trust. This is the right call.

The CTA button text "Get the same results for $49/mo →" is slightly aggressive given the concession immediately above. Minor tonal inconsistency.

Mobile correctly switches to a condensed three-column layout. The compare row slide-in animation is subtle (24px translateX) and does not feel gratuitous.

---

### 6. Proof / Stats
**Score: 6.8 / 10**

The stat numbers have been scaled back (52%, 1 in 3) and the sources now say "According to industry research on small business marketing" — which is vague. Previous audits noted the citations were fixed; they are still insufficient. "Industry research" is not a citation. A real business owner considering $49/month may notice this and feel uneasy.

The "200+ businesses already on the waitlist" claim is plausible but unverifiable. It is neither bold enough to impress nor specific enough to be credible. The number has not moved in several audit cycles, which itself becomes a signal.

The CTA strip inline with proof ("Join 200+ businesses on the waitlist →") is repetitive. This is the third CTA before reaching pricing. The page has CTAs in: nav, hero, compare section, proof section, pricing. This is excessive and risks feeling desperate rather than confident.

---

### 7. Pricing
**Score: 7.6 / 10**

Three tiers, clear differentiation, honest feature lists with specific limits. The usage context in parentheses — "(~4 posts/wk + reviews)" — is exactly right. A business owner can immediately see whether they fit.

The monthly/annual toggle works correctly. Price updates on click. The "Save 20%" pill appears only on annual. No bugs detected.

The featured plan glow animation fires once on scroll-in and does not loop. Restrained.

"Less than your cheapest employee" is strong and resonant for the target audience.

One concern: "Waitlist pricing — locked in when you join. Prices increase at public launch." is a reasonable hook but at cycle 16, every audit still shows this line. When "waitlist pricing" is always the price, the scarcity mechanism becomes implausible.

---

### 8. FAQ
**Score: 8.0 / 10**

Nine questions, all legitimately useful for a business owner's decision. The accordion works correctly. The answers are specific and the cancel mechanic ("Text CANCEL at any time") is exactly on-brand. The OAuth security answer is genuinely reassuring and pre-emptively addresses a real objection.

"What if it posts something wrong or off-brand?" is smart to include proactively. The answer is correct.

Missing: an explicit answer to how many rounds of feedback it typically takes before the AI matches a business's voice. This is a real concern for a first-time user.

---

### 9. Final CTA / Signup Form
**Score: 7.3 / 10**

The two-step form is smart UX — lower commitment threshold on the first screen, natural revelation of the phone number step after commitment. The SMS reassurance text appears after the email step, which is the correct placement.

The queue position mechanic (hash-derived #180–#240 in line) is a cosmetic trick and sophisticated visitors will notice the number is too consistent to be random. Also: "in line" for a service that opens in May 2026 at cycle 16 of auditing is starting to feel like vaporware. The product's lack of a live backend is increasingly notable.

The plan-selection carry-through (selecting a plan marks it in the CTA) works correctly and is a nice conversion detail.

Title transitions — "Your marketing shouldn't require a second job" → "One more thing." → "You're in." — are clean.

---

### 10. Technical / JavaScript
**Score: 8.5 / 10**

All JavaScript verified as structurally sound:
- Scroll-linked hero wordmark transform: clean rAF usage
- How It Works scroll-driven step reveal: correct step boundary math, dot state updates properly
- Horizontal features scroll: translateX calculated correctly
- Demo flows: async/await with proper typing indicator, no leaked state
- Billing toggle: prices and period text update correctly, pill shows/hides
- FAQ accordion: correctly handles "close others before opening new" pattern
- Modal: opens/closes, Escape key bound, body scroll lock applied
- Count-up animation: IntersectionObserver with correct unobserve to prevent double-fire
- Compare row animation: staggered delays, one-shot
- Plan selection carry-through: hidden input, reflected in confirmation

No broken interactive elements found. The prefersReducedMotion check is thorough and the fallback layout is correctly structured. rAF usage in scroll handlers is correct throughout.

---

### 11. Design Distinctiveness
**Score: 7.2 / 10**

The warm dark palette with lime accent is not standard AI product. Geist + Geist Mono is the right font pairing. The design is distinctive compared to consumer apps but less distinctive compared to developer tooling sites (Vercel, Linear, Railway) which use nearly identical dark palettes with lime/green accents and monospace fonts.

The product is for pizza shop owners and plumbers, not developers. The aesthetic may inadvertently signal "technical tool for technical people." This tension has been present throughout the audit history and has not been resolved.

The horizontal feature scroll and scroll-linked wordmark intro are two genuinely memorable moments. The remaining sections (compare, proof, pricing, FAQ) are conventional in structure.

---

## Top 3 Priorities

1. **Fix the hero gate.** The value proposition is invisible until the user scrolls 60% through the hero stage. Add a visible sub-headline or one-line pitch visible on first load, below the wordmark before the scroll animation begins. This is the single highest-risk conversion problem on the page.

2. **Fix the stats citations.** "According to industry research on small business marketing" is not credible. Either cite the actual source (NFIB Small Business Survey, Clutch SMB Marketing Report, Hootsuite Global State of Digital report) or remove the attribution entirely. Vague sourcing reads as a red flag to careful visitors.

3. **Add one visual artefact per feature card.** The horizontal feature section has zero product imagery. Each of the four cards should carry at least one SMS bubble or output snippet. Feature 4 (Monday report) practically writes itself — show the actual text message.

---

## What the Subtraction Pass Got Right

- Removing the typewriter from the hero headline: correct. The scroll animation is enough motion in the entry sequence.
- Trimming features from 6 to 4: the page breathes better and the remaining four are the right four.
- Removing film grain, scroll glow, glassmorphism: exactly right. These were gratuitous and pulled against the brand.
- Trust line and SMS reassurance additions: both net positive for conversion credibility.

---

## Score Rationale

**7.5** — holds rather than recovering to 7.6 because:
- The hero gating problem has not been addressed across multiple cycles
- Citations remain vague despite being flagged repeatedly
- Feature cards remain visually empty of product evidence
- The product is still a waitlist with no live demo backend

Does not drop below 7.5 because:
- JavaScript is exceptionally clean for a single-file landing page
- Interactive demo is genuinely impressive and differentiating
- FAQ is unusually honest and complete
- Comparison table concession is a rare piece of landing page maturity
- Visual clutter is now at an appropriate level

A real small business owner visiting this page would understand the pitch, trust the copy more than most AI tool pages, and likely join the waitlist if actively shopping. They would not be confused. But the first three seconds — the wordmark alone on a dark screen — create an unnecessary exit risk that has gone unfixed for too many cycles.
