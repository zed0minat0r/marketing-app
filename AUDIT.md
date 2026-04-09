# Sidekick — Audit Report
**Auditor:** Nigel (strict British auditor)
**Date:** 2026-04-07
**Cycle:** 13
**Score History:** 6.2 → 6.8 → 6.4 → 7.1 → 7.3 → 7.2 → 7.0 → 7.1 → 7.4 → 7.5 → 7.6 → 7.6 → **7.5**

---

## Overall Score: 7.5 / 10

A slight retreat from the 7.6 plateau — not a collapse, but evidence that the page has accumulated polish without resolving its core conversion problems. The animations are Apple-tier in ambition. The copy is genuinely sharp. But after 13 cycles the structural issues that prevent this from reaching 8.0 remain stubbornly in place: a fake social proof number, a two-step signup that does nothing with the data, no testimonial evidence, and a pricing section that asks for mental commitment before the product has shipped. A real small business owner visiting for the first time would likely leave impressed but unpersuaded to hand over their phone number.

---

## Section-by-Section Breakdown

### 1. First Impression / Above the Fold — 7.5 / 10

**What works:**
- The headline "Your marketing team lives in your texts" is genuinely strong — specific, benefit-led, and memorable. Not generic AI slop.
- The dark warm-toned palette (near-black with lime-green accent) is distinctive and avoids the teal/Inter trap called out in AGENT-RULES.md. This does not look like a Claude-generated page.
- The Geist + Geist Mono pairing is coherent and appropriate for the product.
- The hero split (headline left, animated phone right) is the correct layout for a demo-first product.
- The stat badge ("SMS is read 98% of the time") is a smart trust hook placed precisely where doubt lives.
- 44px minimum tap targets respected throughout nav and CTAs.

**What doesn't work:**
- The hero phone animation auto-plays before the user has decided to care. By the time they read the headline, the phone is already mid-conversation. There is no "watch demo" prompt — it just starts. Minor timing issue but after 13 cycles it should have been addressed.
- "Plans from $49/mo" in the trust bar primes price anxiety before value is established. Most conversion-optimised pages delay price mention until after the value prop lands.

---

### 2. Interactive Demo — 8.0 / 10

**What works:**
- All four scenario flows (posts, stats, ad, audit) execute correctly. Typing-dots animation, sequential message reveals, and flow-completion logic all work as intended.
- The demo is user-driven, not auto-scrolling — respects the user's pace.
- The `completedFlows` Set preventing repeated scenarios is a nice UX touch.
- Content within the flows is specific and believable: "Joe's Coffee," real metrics, actual ad copy. This sells the product better than any bullet list.
- The "Your thumb is the only dashboard you need" headline is the second-best line on the page.
- `isRunning` guard prevents double-triggers. `pre-wrap` renders multi-line bubbles correctly.

**What doesn't work:**
- The demo section headline and subhead sit above the phone with 40px margin. On mobile this tightens to 28px and the h2 drops to 1.6rem — acceptable but slightly cramped.
- After completing all four flows, the accent-bordered "Start over" button looks visually inconsistent versus the pill-shaped prompt-btns.

---

### 3. How It Works — 7.0 / 10

**What works:**
- Three steps is the correct number. The flow is clear: answer 5 questions → content arrives → you approve.
- Step 3 copy ("Reply YES to post. Reply EDIT to change it. Reply SKIP to move on.") is the most conversion-useful sentence on the entire page.
- The monospace step numbers with bordered labels reinforce the brand voice without alienating a non-technical audience.

**What doesn't work:**
- This section has been unchanged for multiple cycles. It is competent but not working hard. A real small business owner's friction is "what if I miss a text?" — nothing here addresses error recovery.
- Step descriptions are too long. Step 1 is 55 words; the core message is in the first sentence. The rest is padding.

---

### 4. Features Grid — 7.0 / 10

**What works:**
- The typewriter animation on command labels (`> "run an ad"`, `> new review detected`) is the best animation on the page — purposeful, product-illustrating, tied directly to the SMS metaphor.
- The editorial hero feature (Facebook ad in 30 seconds) spanning full grid width correctly signals hierarchy.
- Feature copy is tight and specific — "Reply YES in 10 seconds" is more credible than "quick and easy."

**What doesn't work:**
- Six features is one too many. The website audit feature is a side feature; it dilutes the three-platform core value prop.
- The CSS `feature:nth-child(3), feature:nth-child(5){border-right:none}` rule: with a feature--hero spanning full width as item 1, the actual layout in a 2-col grid has items 3 and 5 in the right column — yet their border-right is being removed. This appears to be a visual bug creating a missing border on the right side of those cells. This CSS logic has not been verified across 13 cycles.
- No visual evidence of the product. Every feature is text-described; a single phone-UI illustration per feature would dramatically improve comprehension.

---

### 5. Comparison Table — 6.5 / 10

**What works:**
- The mobile-specific table (3-column grid) is the correct solve for table-on-mobile. Show/hide logic via media query is correct.
- Competitor pricing is cited with a source note — more honest than most landing pages.
- The CTA inside the section ("Replace your $2,500/mo hire for $49 →") is the most aggressive and most effective CTA on the page.

**What doesn't work:**
- "Hootsuite / Podium" are collapsed into a single column in the mobile table. These are very different products. A skeptical buyer will notice.
- Every row Sidekick wins cleanly — one partial credit (~) is the only concession. An honest comparison where a competitor has one genuine advantage (e.g., "Hootsuite has a 10-year track record") would be more trustworthy.
- No sticky header on the desktop table — context is lost when the table extends below the viewport.

---

### 6. Social Proof / Stats — 6.0 / 10

**What works:**
- The count-up animation fires correctly on intersection. Cubic ease-out is smooth.
- The LocaliQ 2026 source citation adds credibility.
- The statistics chosen (52% handle own marketing, 1 in 3 post consistently) are genuinely compelling for the target market.

**What doesn't work:**
- "203+ businesses already on the waitlist" is a fabricated number. This has been flagged in prior audits. It is still there. This is a lie on a live marketing page. A user who receives queue position #180–#241 (generated by client-side hash) and then sees "203+ on the waitlist" can do the maths. Unacceptable after 13 cycles.
- There are zero customer testimonials, zero business names, zero logos, zero real humans. After 13 cycles, the "social proof" section proves nothing about the product — only about the market problem. That is stage 1 copywriting.
- "Opening to the first 500 in May 2026" is one month from the audit date. If May arrives and the product does not launch, the page becomes actively misleading.

---

### 7. Pricing — 7.5 / 10

**What works:**
- The billing toggle works correctly. Prices, period labels, and the "Save 20%" pill all update on click.
- The featured Growth plan (lime border, `// most popular` label, one-shot glow on intersection) is tasteful — the glow fires once and settles. Correct.
- `selectPlan()` captures plan name, passes it to the CTA, shows the plan-selected indicator. Works.
- "Waitlist pricing — locked in when you join" is a strong scarcity line.

**What doesn't work:**
- `// starter`, `// growth`, `// pro` in monospace: a florist or plumber may read this as developer jargon. Distinctive, but potentially alienating for the target user.
- Plan descriptions over-qualify ("You have 1–2 social accounts...") instead of selling benefits.
- No inline FAQ within pricing — "what counts as a generation?" is a natural question at this point and the FAQ is several scrolls away.

---

### 8. FAQ Accordion — 8.0 / 10

**What works:**
- Accordion works correctly. Click opens, click same item closes, click different item closes previous and opens new. The `+` rotates to 45deg on open. Smooth max-height transition.
- Eight questions is the right number. FAQ copy is honest and detailed.
- Alternating `reveal-left` / `reveal-right` animations add visual rhythm.
- `faq__q` has 44px min-height. Correct for touch targets.

**What doesn't work:**
- `max-height: 300px` on `.faq__a.open` — the longest answer is approximately 250px at this font size. The cap is adequate but barely. A 20% longer answer would be clipped. Latent bug.
- The left/right slide direction on FAQ items does not map to anything logical. It is decoration. Adds noise without clarity.

---

### 9. Final CTA / Signup Form — 7.5 / 10

**What works:**
- The two-step form (email → phone) is a sound pattern — captures lower-commitment data first.
- The headline arc ("One more thing." → "You're in.") is well-executed.
- Queue position via email hash and the referral hint are clever viral mechanics.
- Form validation (email check, phone length, border-color error state) works. Modal (Privacy / ToS) opens and closes correctly via click-outside, ESC, and X button.

**What doesn't work:**
- Email validation is `email.includes('@')` — this accepts "@" as valid. The `type="email"` input already handles this natively and more robustly. The manual check is redundant and weaker.
- `(555) 867-5309` as placeholder is a pop-culture reference that a 52-year-old plumber will not recognise. Use a neutral format: `(555) 000-0000`.
- The queue position is client-side fabricated — visible to anyone who opens DevTools. Undermines trust with technically-minded users.
- No actual backend exists. The promise "We text you within 60 seconds" is not fulfilled. A disclaimer is needed.

---

### 10. Animation Assessment — 7.0 / 10

**Eight concurrent animation systems:**
1. Hero phone scale-in (blur + scale, 0.9s cubic-bezier)
2. Word-by-word headline reveal (110ms stagger)
3. Scroll reveal (IntersectionObserver, translateY 40px)
4. FAQ left/right reveal variants
5. Typewriter on feature commands (38ms per character)
6. Count-up on stat numbers
7. Hero auto-play conversation
8. Featured plan one-shot glow

**Verdict:** Too many systems for a single landing page. Each is individually tasteful; collectively they create a page that feels restless. AGENT-RULES.md is explicit: "SIMPLICITY IS KING." The FAQ left/right reveals and the count-up numbers are the two weakest — decorative without function. The typewriter feature commands and the hero conversation are the two strongest — purposeful and product-illustrating.

`prefers-reduced-motion` wrapping is correct and inclusive throughout.

---

### 11. JavaScript Quality — 8.0 / 10

- No JS errors detectable from code review.
- All DOM queries are guarded. Event delegation on `promptsEl` rather than per-button listeners. `isRunning` guard prevents race conditions. `IntersectionObserver` used throughout — correct performance choice.
- Billing toggle, modal, plan selection, count-up, typewriter, FAQ accordion, demo flows — all implemented correctly.

One genuine issue: the word-by-word headline animation rebuilds innerHTML by splitting on `<br>`. The `hero__word-grad` class applies `-webkit-text-fill-color:transparent` on the `em`; the `hero__word` `span` inside inherits `opacity:0` and `transform`. This stacking of background-clip on a parent with opacity-animated children has historically caused rendering artifacts in Safari. Not broken today, but a latent risk across 13 cycles that has never been addressed.

---

### 12. Mobile Responsiveness — 7.5 / 10

- Breakpoints at 768px and 480px are present and logically structured.
- Hero stacks correctly. Demo phone max-height 200px on mobile — tight but functional.
- Pricing stacks to 1-col, featured plan moves to top. Comparison table hides, mobile grid appears. All correct.
- Footer links get 44px min-height. Correct.

Minor issues: `proof__stat-num` at 3rem on 480px is large relative to container. `hero__trust` pill on 375px may wrap "Plans from $49/mo · 14-day free trial · No credit card" awkwardly at 0.78rem.

---

## Summary

**What Works (Top 5):**
1. Interactive demo — fully functional, specific content, user-paced. Best executing element on the page.
2. Headline copy — "Your marketing team lives in your texts" is genuinely differentiated.
3. Pricing toggle — correct, smooth, no bugs. Featured plan glow is tasteful.
4. FAQ accordion — eight honest questions, working JS, correct accessibility.
5. Visual identity — dark warm palette, Geist Mono accents, lime green — distinctive and not AI-generated-looking.

**What Doesn't Work (Persisting Failures):**
1. **Fabricated "203+" waitlist number** — flagged in prior audits. Still present. A lie on a live page.
2. **Zero real testimonials** — 13 cycles in, still no real customer voice. Market statistics are not product proof.
3. **Signup form does nothing** — collects email + phone, sends no SMS, fulfils no promise. Needs disclaimer.
4. **Over-animation** — 8 systems running simultaneously violates the explicit AGENT-RULES.md directive.
5. **Premature price mention** — "Plans from $49/mo" in the hero trust bar before value is established.

---

## Prioritised Recommendations

### P0 — Do These Now
1. Remove or qualify the "203+" waitlist number. Replace with "Be among the first 500" or remove entirely.
2. Add a disclaimer to the signup form that this is a waitlist reservation, not an active product signup. Hedge or remove "We text you within 60 seconds."
3. Cut the FAQ left/right reveal animations. Replace with standard `reveal` (translateY). The lateral motion adds noise without logic.

### P1 — High Impact
4. Add one real or disclosed beta testimonial. Even a single human voice with a name changes the trust calculus.
5. Remove the website audit feature from the features grid. Reduce from 6 to 5 features to sharpen focus.
6. Remove the redundant `email.includes('@')` validation. The `type="email"` input handles this natively.

### P2 — Polish
7. Change the `(555) 867-5309` placeholder to `(555) 000-0000`.
8. Move "Plans from $49/mo" out of the hero trust bar — below the CTA or into pricing.
9. Add `position:sticky;top:0` to the desktop comparison table header row.
10. Address the Safari background-clip + opacity-animated child latent bug in the hero headline word animation.
