# Sidekick — Nigel's Audit
**Date:** 2026-04-07
**Auditor:** Nigel (strict British auditor)
**Score:** 7.3 / 10

---

## Score History
6.2 → 6.8 → 6.4 → 7.1 → 7.3 → 7.2 → 7.0 → 7.1 → 7.4 → 7.5 → 7.6 → 7.6 → 7.5 → **7.3**

*Regression this cycle. The new visual layer added complexity without adding clarity. Net result: slightly worse than the previous 7.5 peak.*

---

## Executive Summary

The page is technically ambitious. The scroll-linked hero wordmark shrink, the three-step How It Works SMS conversation, the horizontal feature carousel, the four-scenario demo — these all work correctly from a JavaScript standpoint. The copy remains the strongest asset on the page. Pricing is clear. FAQ is thorough.

However, the new visual direction — hero typewriter, glassmorphism on the how-it-works messages, shimmer sweep, glow-on-every-word, scroll glow, film grain, dot grid pulse — has crossed a threshold. It no longer reads "premium and considered." It reads "a developer who discovered effects and used all of them." A small business owner visiting for the first time will feel the page is showing off at their expense rather than earning their trust. The shimmer sweep in particular looks like a loading artifact. The glassmorphism on the how-it-works messages adds visual noise on a phone mockup that is already trying to convey a simple SMS conversation.

The site has plateaued in the 7.3–7.6 range because each cycle adds effects that push polish up temporarily, then the aggregate clutter pulls the score back down. The pattern is consistent.

---

## Section Scores

### 1. First Impression / Hero — 6.8
**What works:** The shrinking wordmark scroll effect is genuinely distinctive. No other SMS marketing tool does this. Copy — "Your marketing team lives in your texts" — is sharp and direct. The eyebrow, headline, subhead, and CTA button are all clean.

**What does not work:**
- The typewriter box appears after you have already scrolled 60% through the hero stage. By the time it triggers, most visitors have already formed their opinion of the page. Worse, the text it types ("Hey Mike, here are 3 posts for this week. Reply YES to schedule all, or EDIT to change one.") is a good demo message — but it belongs in the How It Works section, not as a mysterious floating terminal below the CTA buttons.
- The shimmer sweep after the typewriter finishes looks like a CSS glitch, not a feature. The gradient background-clip breaks the text fill colour and the 2-second animation is disorienting.
- The dot grid background pulses at 4s intervals. Combined with the film grain overlay and the scroll glow moving behind everything, there are three simultaneous ambient animations competing for attention before the visitor has read a single word.
- The typewriter label reads "sidekick > weekly brief" but the typed message is not a weekly brief — it is a post scheduling confirmation. Inconsistent framing.

**Priority fix:** Remove the shimmer sweep entirely. Reconsider whether the typewriter box adds value at all, or whether the hero should end cleanly after the trust line.

---

### 2. How It Works — 7.5
**What works:** The scroll-driven three-step SMS conversation is the best section on the page. The step text transitions cleanly. The dot progress indicators on the right are well-judged. The conversation content ("Mike's Pizza / Wood-fired pizza / Both please") is specific and believable. The checkmark appearing at step three is satisfying.

**What does not work:**
- The glassmorphism applied to incoming messages adds backdrop-filter blur and a lime border glow on-reveal. But the phone mockup sits on a solid dark background — there is nothing behind the messages to blur. The effect renders as a faintly lighter surface with an unwanted green border on every received message. It makes the conversation look like a cryptocurrency UI, not an SMS.
- The translateZ(8px) pop on glass messages is imperceptible; the perspective context is set on the messages container, not a 3D canvas, so this does nothing visible and wastes GPU compositing budget.
- On mobile the phone shrinks to 260px width and the messages at 0.82rem become cramped. The glassmorphism is disabled on mobile under 480px (good) but the border still renders.

**Priority fix:** Remove glassmorphism from how-it-works messages. Use the existing plain message styling. The conversation content is strong enough — it does not need decoration.

---

### 3. Features Carousel — 7.2
**What works:** Six features. Horizontal scroll tied to vertical scroll position. The typewriter command appearing on each card is clever and on-brand. Progress dots at the bottom are functional. Copy on each card is concrete and benefit-led.

**What does not work:**
- On mobile (768px and below) the features stage is set to 450vh of vertical scroll for six full-width horizontal cards. That is a lot of committed scroll distance on a small screen. A user on a phone will scroll for what feels like a very long time through features they cannot read at a glance.
- No visual affordance that the section is horizontally scrollable. The progress dots at the bottom are the only hint, and they are very small.
- The feature card text is left-aligned in a full-viewport-width card. On large displays it feels slightly orphaned without a visual counterpart (the hero and demo sections pair text with a phone mockup — the features section is just text on a dark background).

---

### 4. Interactive Demo — 8.0
**What works:** This is the best-executed section. Four flows (posts, stats, ad, audit), each with typing indicator, realistic delays, multi-line pre-wrap content, progressive prompt removal, "that's the full tour" completion state, and a reset button. The content is specific (Joe's Coffee, Phoenixville, real numbers). The phone animation fade-in on scroll is smooth. The demo phone glow wrapper adds a subtle lime border and drop shadow without overdoing it.

**What does not work:**
- The phone reflection effect uses `background: inherit` on the pseudo-element, which inherits from a transparent background — the reflection renders as nothing on most browsers. It is dead CSS.
- The avatar initials "TM" do not correspond to any named business in the demo flows (which refer to "Joe's Coffee"). Minor but breaks immersion.

---

### 5. Comparison Table — 7.4
**What works:** Desktop table is well-structured. Mobile grid alternative shows good defensive thinking. The competitor price ranges are specific and sourced. The CTA ("Replace your $2,500/mo hire for $49") is direct and punchy. Row slide-in animation on scroll is restrained.

**What does not work:**
- The comparison only has Sidekick winning every single row. There is no honest acknowledgement of any limitation. A sceptical small business owner will find this unconvincing. A single honest "partial" or a row where Sidekick admits a limitation would increase credibility.
- "Podium" is primarily a reputation management platform, not a social media marketing tool. Comparing it directly to Sidekick's social posting features is not quite apples-to-apples and a sharp visitor will notice.

---

### 6. Proof / Stats Section — 7.6
**What works:** The two statistics (52% handle their own marketing, 1 in 3 post consistently) are well-chosen and directly relevant. Giant stat numbers are impactful. Count-up animation is tasteful. The waitlist number (203+) adds social proof. Source attribution adds credibility.

**What does not work:**
- The stat section has no CTA. After presenting two compelling statistics, the page simply moves on. This is a missed conversion moment.
- "203+ businesses already on the waitlist" is referenced three times across the page. It starts to feel like padding rather than proof.
- The queue position JavaScript assigns positions 180–240 based on an email hash. This contradicts the stated 203+ waitlist count. Two people comparing positions will notice the simulation.

---

### 7. Pricing — 7.8
**What works:** Monthly/annual toggle works correctly. Prices update, billing period label updates, save pill appears and disappears correctly. Plan selection flows smoothly into the sign-up form. "Waitlist pricing locked in" adds urgency. Featured plan glow animation on scroll entry is subtle and well-timed. Plan descriptions are well-differentiated.

**What does not work:**
- The glassmorphism on pricing cards (backdrop-filter: blur(8px)) is unnecessary — the cards sit on a solid background, so the blur has nothing to act on. Wasted CSS and a compositor layer.
- The "// starter", "// growth", "// pro" naming in monospace with double slashes is an aesthetic choice that will confuse non-technical users. A small business owner may not parse these as plan name labels.
- The featured plan's "Most popular" badge is clipped by `overflow: hidden` on the pricing grid. The badge is visually cut on the top edge. This is a layout bug.

---

### 8. FAQ — 7.9
**What works:** Eight questions. All of them are real objections. The answers are direct, specific, and sometimes disarmingly honest ("We want you to stay because it's working — not because leaving is hard"). Accordion animation is smooth. "Text CANCEL" as the cancellation method is the most on-brand possible implementation.

**What does not work:**
- No question addresses data security or what happens to the business's social media credentials. This is a common concern for a product asking to post on behalf of a business.
- The section header "Before you join / Straight answers." is slightly abrupt. A brief transitional sentence would help.

---

### 9. Sign-Up Form / Final CTA — 7.5
**What works:** Two-step form (email then phone) is well-conceived for a product that is fundamentally SMS-based. Step transition and copy change ("One more thing.") are smooth. Queue position display is engaging. Referral hint is a good growth mechanic.

**What does not work:**
- Queue position is a hash of the email address, always landing between 180 and 240. If two people compare positions, the simulation is transparent.
- The final CTA section is 100vh on desktop. On a 1440px display, the headline floats in a great deal of empty space. Either reduce to padding-based height or use the space more deliberately.
- The radial gradient behind the final CTA (rgba(212,245,60,0.06)) is invisible against the dark background. Remove it.

---

### 10. Performance / Technical — 7.0
**What works:** All JavaScript works correctly. prefersMotion check is implemented and respected throughout. IntersectionObserver is used appropriately. Event listeners are passive. Reduced motion fallback is comprehensive and well-thought-out.

**What does not work:**
- Three simultaneous ambient animations on initial page load: dot grid pulse, film grain (static but composited), scroll glow update. On low-end Android devices this will cause jank.
- backdrop-filter: blur() is applied in four places (hero typewriter, how-it-works messages, pricing cards, nav). Each forces a compositor layer. On mid-range mobile this is measurable.
- The hero wordmark animation recalculates fontSize, left, and top on every scroll frame via direct style manipulation. This causes layout thrashing. Only transform and opacity should be touched per frame.
- The body::before film grain SVG is at opacity: 0.03 on a dark background. It is functionally invisible. It adds a compositor layer for no perceptible visual benefit.
- The scrollGlow element updates its background CSS property on every scroll event, which forces a repaint rather than a composite-only operation.

---

### 11. Copy and Messaging — 8.2
**What works:** This remains the strongest asset. "No app. No dashboard. No login. Ever." — the final "Ever" lands well. "Go make some pizza" in the how-it-works demo is memorable. "Your thumb is the only dashboard you need" is a strong section headline. FAQ answers feel human and disarming. Pricing headline "Less than your cheapest employee" is direct and sharp.

**What does not work:**
- The typewriter message in the hero says "Hey Mike" — the how-it-works section is also about Mike's Pizza. If a visitor reads both carefully they may notice the page is narrating a single fictional business from two different angles, which undermines the sense of a general platform.
- The "203+ businesses" proof claim appears three times across the page. It weakens rather than reinforces on repetition.

---

## Prioritised Recommendations

### Priority 1 — Remove the shimmer sweep animation from the typewriter
The shimmer sweep after the typewriter finishes looks like a rendering error. The background-clip gradient overrides the text fill colour for two seconds and reads as broken. Remove `textEl.classList.add('shimmer-active')` and the associated CSS. The typewriter effect is sufficient on its own.

### Priority 2 — Strip glassmorphism from how-it-works messages
The backdrop-filter blur on `.how-msg-glass` renders on a solid background, producing an unwanted lime border on SMS bubbles. Revert to the plain dark surface message style. The conversation content is compelling without decoration.

### Priority 3 — Fix the featured plan badge clipping bug
`.pricing__grid` has `overflow: hidden` which clips the "Most popular" badge. Remove `overflow: hidden` from the grid or add `overflow: visible` — then use `border-radius` on individual plan cards instead.

### Priority 4 — Reduce ambient animation compositor load
Remove `body::before` film grain entirely (invisible at 0.03 opacity). Remove or flatten `#scrollGlow` (updates `background` on every scroll event). The dot grid pulse can remain but at a fixed lower opacity. Net result: two fewer compositor layers and no scroll-repaints on the fixed overlay.

### Priority 5 — Add a CTA to the proof/stats section
After the two statistics, place a single line CTA — "Join 203+ businesses waiting for early access" with an arrow to the sign-up form. Do not let the most persuasive section on the page end without a conversion prompt.

---

## What Is Working (Keep These)
- Scroll-driven shrinking wordmark hero — distinctive and genuinely on-brand
- Three-step how-it-works SMS conversation — the best single section on the page
- Four-flow interactive demo — fully functional, specific content, good UX
- FAQ content — honest, thorough, on-brand voice
- Pricing copy and toggle behaviour — technically correct and clearly presented
- Mobile responsive breakpoints — well-considered and defensive
- The overall copy voice — warm, direct, un-corporate

---

## Closing Assessment

Sidekick has a strong concept, working JavaScript, and better copy than most funded SaaS landing pages I review. The drift from 7.5 back to 7.3 is not a crisis — it is a direct consequence of the "add effects, score rises briefly, then falls" pattern that has repeated across multiple cycles. The shimmer, the glassmorphism, the grain, the four concurrent blur layers — each seemed like a small addition but combined they cross the threshold from polished to cluttered.

The next productive move is subtraction, not addition. Priorities 1 through 3 above require removing fewer than 30 lines of CSS and 2 lines of JavaScript. No new features needed. That work alone would likely return the score to 7.7 or above without writing a single line of new feature code.
