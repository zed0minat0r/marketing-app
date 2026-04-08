# Sidekick Landing Page — Audit Report
**Auditor:** Nigel  
**Date:** 2026-04-07  
**Score:** 7.6 / 10  
**Score History:** 6.2 → 6.8 → 6.4 → 7.1 → 7.3 → 7.2 → 7.0 → 7.1 → 7.4 → 7.5 → **7.6**

---

## Overall Verdict

A genuinely competent landing page for an early-stage product. The concept is strong, the copy is specific, and the page has personality. This cycle fixed the JS crash (confirmed: no syntax errors, all interactive elements functional) and tightened the mobile compare table. The score edges up from 7.5 to 7.6, but it is not yet a page that compels immediate sign-up from a sceptical small business owner. The core weakness is trust: no testimonials, no logos, no social proof beyond statistics. A plumber or florist visiting this page will wonder whether anyone else has tried it.

---

## JavaScript Audit — PASS

Last cycle had a critical JS crash. This cycle: **all clear**.

- Syntax check: PASS (Node.js validation)
- Hero auto-play conversation: logic intact, plays on load, freezes on final state, replay button appears correctly
- Interactive demo flows (posts, stats, ad, audit): all four flows present and structurally sound, isRunning guard prevents double-execution
- FAQ accordion: proper open/close toggle with only one item open at a time
- Pricing toggle (monthly/annual): switches prices and period text, shows/hides "Save 20%" pill
- Plan selection: passes plan name to final CTA, shows indicator, clears correctly
- Two-step signup form: step 1 (email) -> step 2 (phone) -> confirmation with queue position
- Modal (Privacy, Terms): open/close via overlay click and Escape key
- Nav scroll border: fires on scroll with passive listener

No crashes. No console.log debris. No infinite loops. Full marks on JS.

---

## Section Scores

### 1. Hero — 7.5/10

**What works:**
- Split layout (copy left, animated phone right) is smart and immediately shows what the product does
- "Your marketing team lives in your texts" is a clear, punchy headline
- The animated phone conversation auto-plays and demonstrates the value proposition without the user doing anything
- "No app. No dashboard. No login. Ever." — excellent frictionless promise
- Stat bar ("SMS is read 98% of the time") adds credibility before the hero even loads
- Replay button appears after animation ends — thoughtful UX

**What does not work:**
- Hero animation starts at 600ms delay — an impatient user might scroll before it fires
- Trust line ("14-day free trial · No credit card · Cancel anytime by text") is buried below the CTA buttons in small grey text. This is conversion-critical information and deserves more visual weight.
- No visible social proof in the hero (no "Join 500+ businesses" or similar)

### 2. Interactive Demo — 8.0/10

**What works:**
- Four flows (posts, stats, ad, audit) cover the product's core use cases
- The incremental unlock pattern (completed flows disappear, "that's the full tour" appears) is genuinely clever
- Copy inside the flows is specific: "Joe's Coffee," real numbers, real commands (YES, EDIT, SKIP)
- Typing indicator (animated dots) sells the conversational feel
- "Start over" button with accent border is a tidy touch

**What does not work:**
- Demo sub-copy "Pick a scenario and walk through a real conversation" is flat — it tells rather than teases
- On slow connections, the 400ms inter-message delay feels slightly choppy

### 3. How It Works — 7.0/10

**What works:**
- Three steps are clear and scannable
- Step descriptions are genuinely specific (5 questions, first posts in an hour, YES/EDIT/SKIP commands)
- Step 02 copy ("a florist gets warm and seasonal, a plumber gets direct and local") is strong differentiation

**What does not work:**
- The three-step grid is visually flat. No connecting element, no visual treatment differentiating the steps from plain paragraphs. A first-time visitor scanning quickly might miss the numbered progression.
- "Up and running in under an hour" undersells the ongoing zero-effort value, which is the actual promise.

### 4. Features Grid — 7.0/10

**What works:**
- Command-prefix labels (> "run an ad") are distinctive and reinforce the text-first concept
- Six features cover the main use cases without being exhaustive
- 2-column grid with shared borders looks structured and professional

**What does not work:**
- Feature titles are functional but not exciting — scope for sharper copywriting
- "Website audit in plain English" feels like a product stretch for a florist or plumber who came for social media help. Could confuse.
- The inline size note "(1/mo on Starter, 5/mo on Growth)" inside the feature card is clutter. Limits belong in pricing, not in the value proposition.

### 5. Comparison Table — 7.5/10

**What works:**
- Desktop table is well-structured, accessible (role="table"), and makes Sidekick look like the obvious winner
- Mobile table renders correctly
- CTA at the bottom ("Replace your $2,500/mo hire for $49") is the most visceral CTA on the page

**What does not work:**
- BRAND INCONSISTENCY: The mobile compare table column header still reads "TextMkt" — the old brand name. The desktop table correctly says "Sidekick." This is a live bug visible to every mobile visitor. Embarrassing for a page asking people to trust you with their business.
- The disclaimer note is at 60% opacity. Hiding sources undermines the credibility they are meant to provide.

### 6. Social Proof / Stats Section — 6.5/10

**What works:**
- Large typographic numbers (52%, 1 in 3, 98%) are visually impactful
- Sources are cited — good
- The closing line "Sidekick is built for the 52%" ties stats back to product

**What does not work:**
- These are industry statistics, not product testimonials. There is zero social proof that Sidekick works. No beta users, no pilot businesses, no one-sentence quote.
- The stats validate the market, not the product. A sceptical business owner reads "52% handle their own marketing" and thinks: "yes, that's me, so what has Sidekick actually done for anyone?"
- Section header "The problem we're fixing" positions this as a problem statement, not a proof section.

### 7. Pricing — 7.5/10

**What works:**
- Three tiers are well-differentiated by use case, not just feature count
- Monthly/annual toggle works correctly, shows "Save 20%" pill
- "// most popular" badge on Growth is distinctive, not generic
- "Less than your cheapest employee" headline earns attention
- Waitlist price lock note is a smart urgency lever

**What does not work:**
- The "//" comment notation in plan names is clever but will confuse non-technical small business owners. A florist does not recognise code comments.
- Pro plan at $199/mo targeting "multiple locations" is a different customer than the solo business owner the hero speaks to. The product identity blurs.

### 8. FAQ — 8.0/10

**What works:**
- Eight questions cover real objections a sceptical business owner would have
- Answers are direct and specific — particularly "Text CANCEL at any time" and the YES/EDIT/SKIP mechanics
- Accordion works correctly, only one item open at a time
- "Straight answers." as the section title is confident and on-brand

**What does not work:**
- The first FAQ ("Is this live?") immediately reveals this is a pre-launch waitlist product. That is honest, but it is the first thing a reader sees — confirming the product does not exist yet. Consider ordering differently.
- "We open to the first 500 businesses in May 2026" — from April 2026 that is very close. If May passes without launch, trust evaporates.

### 9. Final CTA / Sign-Up — 7.0/10

**What works:**
- Two-step form (email then phone) reduces friction by splitting the ask
- Queue position creates a sense of scarcity
- "Refer 3 businesses → skip the queue + 2 months free" is a working referral mechanic
- Confirmation copy is warm and specific

**What does not work:**
- The queue position is seeded to a random range of 188–217. Anyone signing up twice will notice the number is never the same twice. This is a trust risk.
- "Your marketing is one text away" is the weakest headline on the page — vague and generic.
- No visual hierarchy in the final CTA section — the trust bullets, title, sub-copy, plan indicator, form, note, and confirmation all compete equally.

### 10. Design / Visual Identity — 7.5/10

**What works:**
- Dark warm theme with acid yellow accent is distinctive — not the usual teal/purple SaaS palette
- Space Grotesk + Space Mono pairing has personality and reinforces the tech-meets-utility positioning
- Minimal decoration — the page does not use hero images, gradients, or blob SVGs that scream "Claude made this"
- Consistent border-based sectioning gives a newspaper/editorial feel

**What does not work:**
- The page is almost entirely text. There is one animated phone mock and everything else is words in grids. For a product that handles visual marketing, the page itself does not demonstrate visual confidence.
- Proof/stats section and features section feel visually identical — same border, same font sizes. No visual variety across sections makes the page feel longer than it is.

### 11. Mobile Responsiveness — 7.0/10

**What works:**
- Media queries at 768px and 480px are comprehensive
- Tap targets consistently meet 44px minimum
- Single-column layouts on mobile are correct
- Hero title scales with clamp()

**What does not work:**
- "TextMkt" label in the mobile compare table is a live regression. Mobile is where most small business owners will land.
- Hero description is left-aligned on mobile while title is centre-aligned — a mismatch.
- The ghost "See how it works" button is effectively invisible on most phones (below the fold after the primary CTA button stacks).

---

## Prioritised Recommendations

### Fix Immediately

1. **"TextMkt" in mobile compare table header (line ~424)** — One-line fix. Change to "Sidekick." Brand inconsistency on the most-visited viewport is inexcusable.
2. **Add any testimonial or beta user quote** — The single biggest conversion gap. Even one quoted pilot user with "early access" framing would address the zero-social-proof problem.
3. **Rewrite the final CTA headline** — "Your marketing is one text away" is the weakest copy on the page. Replace with something specific and urgent.

### High Priority

4. **Hero trust line needs more visual weight** — Move "14-day free trial · No credit card · Cancel anytime by text" above the CTA buttons or give it a bordered treatment so it registers.
5. **FAQ ordering** — Lead with "Can I cancel anytime?" or "Is there a free trial?" not "Is this live?" which immediately undermines confidence.
6. **Queue position seeding** — Make the queue position static or remove it. The random 31-person range is noticeable on repeat visits.

### Nice to Have

7. Remove inline plan limits from feature card descriptions. Put them only in pricing.
8. Add visual variety between sections — the proof and features sections are structurally identical.
9. Consider testing the "//" plan name notation with non-technical users before launch.
10. Increase source citation opacity on compare table from 60% to 90%.

---

## Score Summary

| Section | Score |
|---|---|
| Hero | 7.5 |
| Interactive Demo | 8.0 |
| How It Works | 7.0 |
| Features Grid | 7.0 |
| Comparison Table | 7.5 |
| Social Proof / Stats | 6.5 |
| Pricing | 7.5 |
| FAQ | 8.0 |
| Final CTA / Sign-Up | 7.0 |
| Design / Visual Identity | 7.5 |
| Mobile Responsiveness | 7.0 |
| **Overall** | **7.6** |

---

*Nigel — strict British auditor. 5.0=average, 6.0=generic, 7.0=better than most, 8.0=would choose over competitors.*
