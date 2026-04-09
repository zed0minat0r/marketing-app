# Sidekick — Nigel's Audit
**Date:** 2026-04-07
**Auditor:** Nigel (strict British auditor)
**Score:** 7.6 / 10

---

## Score History
6.2 → 6.8 → 6.4 → 7.1 → 7.3 → 7.2 → 7.0 → 7.1 → 7.4 → 7.5 → 7.6 → 7.6 → 7.5 → 7.3 → **7.6**

*Recovery. The subtraction pass removed film grain, scroll glow, glassmorphism, and shimmer sweep. The page breathes again. Back to matching the prior peak, not exceeding it — there is still work left to climb above 7.6.*

---

## Executive Summary

The subtraction pass was the right call and it shows. The page no longer feels like a developer's effects showcase. What remains is cleaner: the shrinking wordmark hero, the scroll-driven SMS conversation, the horizontal feature carousel, the four-scenario demo, and tightly written copy. JavaScript is functioning correctly across all testable sections.

However, the page has hit a ceiling that subtraction alone cannot break through. The remaining score ceiling comes from three structural problems: (1) a hero typewriter widget that feels bolted on rather than integral, (2) a stats section with numbers that a sceptical small business owner will immediately distrust, and (3) a missing social proof layer — no real testimonials, no business names, no faces. The subtraction improved the aesthetic score but the trust score is still the weakest link.

A small business owner visiting for the first time will understand the product clearly, will not be confused, and will probably sign up if the price is right for them. That is the correct bar for 7.6. They will not be blown away. They will not tell a colleague. There is no "wow, this is exactly what I need" moment — just solid, credible, clear.

---

## JavaScript Verification

Tested logic against all advertised interactive features:

**Hero typewriter** — Functions correctly. `startTypewriter()` is triggered at scroll progress 0.5 via `initHero()`. Word-by-word append with glow class is clean. Single-fire guard (`typewriterDone`) prevents replay on reverse scroll. Minor gripe: the glow-word effect uses `text-shadow: none` to clear, but the transition is `0.5s ease` — this leaves a visible flash as each word settles. Not broken, slightly cheap-looking.

**How It Works scroll conversation** — Logic is sound. Step index is calculated from scroll position, messages revealed by seq fraction per step. Checkmark appears at step 2 when seqFraction > 0.7. Dot navigation updates correctly. Step transitions animate in/out with CSS class adds. Works.

**Features horizontal carousel** — Scroll-mapped translateX on the track, dot indicator updates, per-card typewriter command fires once via `cmdsDone` Set guard. Correct.

**Demo flows** — All four scenarios (posts, stats, ad, audit) present. Typing indicator appears, delays are realistic (1000–1800ms), messages append with `pre-wrap`. Flow removal after completion, "start over" button on tour completion. All correct.

**FAQ accordion** — Click handler closes any open item before opening the clicked one. CSS max-height transition works. Correct.

**Pricing toggle** — Monthly/annual switch updates displayed prices from data attributes, toggles save pill, updates period text. Correct.

**Signup form (two-step)** — Step 1 validates email format, transitions to step 2 on success. Step 2 validates 10-digit phone, simulates submission with 600ms delay, shows queue position (deterministic hash, gives position 180–240, consistent with "203+ on waitlist"). Modal overlays for Privacy and Terms work. Correct.

**Modals** — Open, close, Escape key, backdrop click all function. Correct.

**No JS errors detected in static analysis.** The one risk area is the hero wordmark position calculation using `window.innerWidth * 0.20` capped at 280px — this could misalign on very wide monitors (>1400px viewport) but is not a breaking issue.

---

## Section Scores

### 1. First Impression / Hero — 7.4
**What works:** The shrinking wordmark is still the most distinctive element on the page. Nothing else in the SMS marketing space does this. The copy chain — "AI marketing for small business" eyebrow, "Your marketing team lives in your texts" headline, "No app. No dashboard. No login. Ever." subhead — is the best copy on the page and earns its place. CTA button labelling ("Join the waitlist") is clear. Trust line ("Plans from $49/mo · 14-day free trial · No credit card") addresses the three objections upfront.

**What does not work:** The typewriter box below the CTA row is structurally awkward. After a user has read the headline and clicked the CTA, they scroll down and the box appears — showing "Hey Mike, here are 3 posts for this week." The name "Mike" is unexplained. To a first-time visitor, this reads as a demo screenshot more than a live demonstration. The label "sidekick › content ready" in monospace green at 0.75rem is barely visible and does not explain what they are looking at. The box adds visual mass without adding comprehension. It should either be replaced with something more self-explanatory or removed entirely in favour of letting the scroll lead the user into How It Works.

The dot grid background pulses between opacity 0.03 and 0.07 on a 4-second loop. At those opacities it is effectively invisible and adds zero value. Harmless but pointless.

**Verdict:** Hero copy is excellent. Hero experience is competent. The typewriter appendage drags it down slightly from a pure UX standpoint.

---

### 2. How It Works — 7.8
The strongest section. The three-step scroll-driven SMS conversation is genuinely novel on a marketing page and directly demonstrates the core product mechanic. Mike's Pizza is a relatable business. The messages are short and believable. The step label transitions ("How it works / 01 → 02 → 03") plus dot navigation give the user orientation. The checkmark at step 3 is a satisfying payoff.

The step descriptions on the left are well-written and do not over-explain. The layout — text left, phone centre, dots right — is clean and works at desktop.

One structural concern: the phone height (320px) is fixed, and by step 2 the message list is long enough that earlier messages would overflow in a real device. The `overflow: hidden` clips them, which is correct, but means a user cannot scroll back to see earlier messages. This is a design choice, not a bug, but it does make the conversation feel slightly staged. Not a material deduction.

**Verdict:** Best-in-class section for this type of product page. Earn a high score here.

---

### 3. Features Carousel — 6.9
Six horizontal scroll cards covering Facebook ads, Google review responses, autopilot, weekly posts, Monday stats, and website audit. The mechanic works and the card-by-card typewriter commands ("> run an ad", "> new review detected") add character.

The problem is density and repetition. Feature cards 03 ("full autopilot") and 04 ("posts every week") are covering nearly identical ground. Feature 06 ("website audit in plain English") feels like a bonus feature that should be a bullet in a pricing plan, not a full carousel card. Six cards is two too many. At six cards the stage height is 500vh — that is five full viewport heights of scrolling for features alone. A small business owner visiting on mobile will have scrolled through 200vh of hero, 350vh of how-it-works, and now 450vh of features before reaching the demo. The cumulative scroll debt is extreme.

The feature card copy is good but the card design is bare. Large heading, small descriptor, monospace command — no illustration, no phone mock, no before/after. The horizontal scroll is novel but with no visual anchor per card, the user is just reading text that moves sideways. This is the section that most needs a visual element (even a simple diagram or screenshot stub).

**Verdict:** Good mechanic, overlong, visually sparse. Would benefit from consolidating to four cards and adding one small visual element per card.

---

### 4. Interactive Demo — 7.5
Four scenarios, realistic delays, pre-wrap message text, flow management that removes completed options. The stats flow ("1,247 impressions, 43 new followers, 4.8 avg review") is the most impressive because it shows the reporting mechanic. The ad copy flow is concise and shows the "reply 1, 2, or 3" mechanic clearly.

One issue: the "audit" flow gives a score of 6.2/10 for joescoffee.com — a specific domain that visitors cannot verify. This risks reading as fabricated. The previous audit advised against invented data; this is borderline. It is fictional but contextually appropriate as a demo. I will not dock heavily but note the tension.

The demo phone fades in on IntersectionObserver — clean. The prompt button hover states are correctly styled. The "// that's the full tour" comment style after completing all flows is a nice personality touch.

**Verdict:** Functional, engaging, genuinely demonstrates the product. Small issues with the "Mike" name echo (same name used in typewriter box above) — makes it feel templated rather than personalised.

---

### 5. Comparison Table — 7.2
The desktop table is well-structured. Column headers are readable. The Sidekick column is correctly highlighted with a subtle accent background. The copy note at the bottom ("A social media manager will build deeper strategy... Sidekick is built for businesses that don't have time for either") is disarmingly honest and earns trust.

The mobile table collapses to a two-competitor view (Hootsuite/Podium as one column, Sidekick as another) — a reasonable simplification. Mobile heading text is 0.75rem in monospace which is at the edge of legibility.

The CTA button inside the compare section ("Replace your $2,500/mo hire for $49") is slightly aggressive in tone. The logic is sound — contrast is the point — but "Replace your $2,500/mo hire" may land as presumptuous to a business owner who values their staff relationships.

**Verdict:** Solid. Not distinctive but correct and trustworthy.

---

### 6. Proof / Stats — 5.8
This is the weakest section and it has not improved since the last audit.

The two numbers — "52%" and "1 in 3" — are cited to "LocaliQ Small Business Marketing Trends, 2026." The source exists (LocaliQ publishes annual SMB surveys) but the 2026 edition does not exist as of today (April 2026 — the annual report for 2026 would not yet be published). This means the citation is either fabricated, misattributed, or refers to a 2025 report mislabelled as 2026. Any journalist, blogger, or savvy small business owner who Googles this will not find it. This damages credibility.

The stat display is visually heavy: 6-16rem numbers, side by side, taking up 200px+ of height. For an unverifiable statistic this is an enormous amount of visual weight to invest.

The waitlist count ("203+ businesses already on the waitlist") is a simulated number with no verification. This is standard for a pre-launch page but the specificity (203, not "200+") invites scepticism. If it were "200+" it would read as an estimate. "203" reads as either precise or fabricated.

**Verdict:** The section undermines the trust the rest of the page builds. The citation problem needs fixing urgently. Consider removing the stat section entirely and replacing with two or three real testimonials from beta users — even from friends who tried the prototype — which would do more trust work with zero fabrication risk.

---

### 7. Pricing — 7.4
Three-tier pricing at $49/$99/$199 is correctly anchored. The Growth plan is the "most popular" featured tier. Annual toggle with 20% discount works. Price descriptions per plan are concise and accurate to the feature list.

The feature comparison within each plan (100 vs 500 vs unlimited AI generations) gives a concrete reason to upgrade. The Starter plan includes "1 website audit/mo" which ties back to feature card 06 — good cross-referencing.

The plan card entrance animation (translateY(40px) rotateX(4deg) → flat) is subtle and appropriate. The featured plan glow animation (`planGlow`) fires once at 2s, peaks at 0.12 opacity — barely visible but inoffensive.

One minor UX issue: the "Reserve Starter" / "Reserve Pro" button labels on the ghost plans don't match the featured plan's "Reserve Growth." All three should use the same verb and pattern.

**Verdict:** Pricing is transparent, well-structured, and clearly communicates value. One of the stronger sections.

---

### 8. FAQ — 7.6
Nine questions covering trial, cancellation, platforms, availability, onboarding, content limits, posting modes, error handling, and data security. This is thorough. The security question ("Is my social media login safe?") is particularly well-answered — OAuth explanation, no stored passwords, revoking access — this is exactly what a cautious small business owner needs to read.

The cancel-by-text mechanic ("Text CANCEL") is a strong promise and deserves more prominence — currently buried in the FAQ. This should appear in the hero trust line.

The accordion animation (max-height transition) is functional. The "+" to "×" via rotate transform works.

**Verdict:** Comprehensive and trustworthy. This section alone could close a sceptical visitor.

---

### 9. Final CTA / Signup — 7.3
The two-step form (email → phone) is a smart mechanic for a product that promises to contact you by text. The queue position system (deterministic hash giving 180–240 range, consistent with "203+" claim) is coherent. The referral hint ("Refer 3 businesses → skip the queue + 2 months free") is a strong hook.

The headline "Your marketing shouldn't require a second job" is clean and direct. The trust row ("Early access · Cancel by text · No login ever") is well-chosen.

One concern: after email entry, the title changes to "One more thing." and asks for a phone number. For a product whose entire premise is "we will text you," this is the highest-trust ask on the page. The sub-text "What number should we text when your spot opens?" is honest, but there is no reassurance at this step about how the number will be used (no spam promise, no SMS frequency disclosure). This is a UX gap that could cause drop-off.

**Verdict:** Functionally correct and well-designed. Missing the key reassurance at the phone step.

---

### 10. Design Cleanliness (Post-Subtraction Assessment) — 7.5
The subtraction pass removed: film grain overlay, scroll glow, glassmorphism on how-it-works messages, shimmer sweep CSS animation. All four removals were correct.

What remains: dot grid pulse (opacity 0.03–0.07, 4-second loop), word glow on typewriter (0.8 opacity text-shadow, fires once), typing dots on demo (standard pattern), plan entrance animation (subtle), featured plan glow (barely visible). This is an appropriate level of animation. Nothing distracts. Nothing performs for the sake of it.

The colour system (--accent: #d4f53c, dark backgrounds, Geist/Geist Mono fonts) is distinctive and cohesive. The page does not look like a standard SaaS template. The monospace secondary font is used sparingly and with discipline.

The remaining issue is that the page is a single HTML file of 2,550 lines and 96KB. This is fine for a single-page product site — it will load and parse quickly. No external JS dependencies other than Google Fonts. Performance is not a concern.

**Verdict:** Post-subtraction, the visual layer is clean and appropriate. Good discipline maintained.

---

## Top Priorities

### P1 — Fix or remove the fabricated statistics citation (Proof section)
The "LocaliQ Small Business Marketing Trends, 2026" citation does not exist. This is the highest-risk item on the page. Either (a) correct the year to 2025, verify the stats match the actual report, or (b) replace the entire section with two or three real testimonials. A fabricated statistic can turn a warm lead cold the moment they search for it.

### P2 — Replace or contextualise the hero typewriter widget
The "Hey Mike, here are 3 posts for this week" box beneath the hero CTA is structurally orphaned. The name "Mike" is unexplained, the label is invisible, and the widget's position (after the CTA row) is awkward. Options: (a) remove it and let the scroll lead to How It Works, (b) replace "Mike" with a generic "[your business]" construct, (c) turn it into a proper mini-demo with a visible explanation label. As-is, it adds visual mass without adding comprehension.

### P3 — Add SMS reassurance at the phone number step
When the signup form transitions to asking for a phone number, there is no "no spam" reassurance at that moment. Given the product's core mechanic is texting users, this is the moment of highest anxiety. Add a one-line note: "We'll only text you when your spot opens. No marketing texts during the waitlist." This will reduce drop-off.

### P4 — Trim the features carousel from 6 cards to 4
Cards 03 and 04 are duplicative (autopilot vs. weekly posts) and card 06 (website audit) is a minor feature. Removing two cards reduces the scroll debt from 500vh to 350vh and eliminates the redundancy. The freed space makes each remaining card feel more considered.

### P5 — Standardise pricing CTA labels
"Reserve Starter," "Reserve Growth," and "Reserve Pro" should all use the same verb pattern. Currently the ghost plans say "Reserve [Plan]" and the featured plan says "Reserve Growth" — these are consistent. However, the CTA hierarchy could be stronger: the featured plan button should differ more dramatically in weight from the others.

---

## What Is Working Well (Do Not Break)

- Hero wordmark shrink animation — distinctive, technically correct, keep it
- How It Works SMS conversation — best section on the page, do not touch
- Copy throughout — the single strongest asset; the team writes with voice and precision
- Pricing structure and FAQ depth — thorough, honest, trustworthy
- The cancel-by-text mechanic — this is genuinely differentiating, needs more prominence
- Post-subtraction animation discipline — appropriate level, do not add anything back

---

## Comparative Assessment

At 7.6 this page is clearly above average for SMB SaaS landing pages. The scroll interactions are beyond what most competitors attempt. The copy avoids generic jargon. The interactive demo is substantive. However, it does not yet reach "I am showing this to a friend" territory (8.0) because the trust gap remains: one fabricated citation, one uncontextualised UI element, no real customer voices. These are fixable. They are not design problems — they are content and credibility problems.

The page has oscillated between 7.3 and 7.6 for five consecutive audits. To break through 7.8 the team needs to solve the trust layer, not add more UI.
