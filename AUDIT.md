# TextMarketer Landing Page Audit
**Auditor:** Nigel  
**Date:** 2026-04-07  
**File audited:** index.html  
**Score history:** 6.2 → 6.8 → 6.4 → 7.1 → 7.3 → **7.2**

---

## Overall Score: 7.2 / 10

Slight regression from 7.3. The page is well-structured and the copy is genuinely strong, but several trust and friction issues have not been addressed across multiple audit cycles. A first-time small business owner would be impressed enough to read it, but still hesitant to commit. The core concept is compelling; the execution has a handful of gaps that are actively costing conversions.

---

## Section Scores

### 1. Hero — 7.5 / 10

**Strengths:**
- Split layout with live SMS animation on the right is immediately differentiating. Visitors understand the product in under five seconds.
- "Your marketing team lives in your texts" is sharp and specific.
- Stat badge (SMS 98% vs email 22%) is a smart credibility device placed before the headline.
- Trust line below CTA ("14-day free trial · No credit card · Cancel anytime by text") is where it belongs.

**Weaknesses:**
- Hero animation loops automatically and cannot be paused by keyboard or touch on mobile. Hover-pause works on desktop only. Mobile visitors get interrupted mid-sentence.
- "Your first week of posts arrives within the hour" is a strong claim in how-it-works but absent from the hero, the most-read viewport.
- Nav background colour (`rgba(8,9,15,0.88)`) does not match the page background variable (`--bg:#141210`). Minor visual inconsistency.

---

### 2. Interactive Demo — 7.8 / 10

**Strengths:**
- Four distinct scenario buttons cover the core use cases precisely.
- Typing animation with realistic delays makes the demo feel like a real conversation.
- Pre-wrap on message text renders multi-line messages cleanly.

**Weaknesses:**
- "Try another" reset button appears inside the scroll area and may be off-screen on small phones. No auto-scroll to the reset.
- The phone container has no max-height constraint on mobile once messages accumulate — grows and pushes content down.
- Prompt buttons disappear entirely when a flow starts. A business owner may not realise the reset exists.

---

### 3. How It Works — 7.0 / 10

**Strengths:**
- Three-step structure is clean and believable.
- Specific details ("5 short questions," "within 60 seconds," "first week of posts within the hour") are more convincing than vague generalisations.

**Weaknesses:**
- "Up and running in under an hour" headline conflicts slightly with "within the hour" in the step copy. Pick one phrasing and use it everywhere.
- Step 03 (the YES/EDIT/SKIP mechanic) is the product's most distinctive feature but gets identical visual weight to the others.
- "How it works" section label is redundant alongside the h2. Trim.

---

### 4. Features Grid — 6.8 / 10

**Strengths:**
- Six features, all specific and outcome-oriented.
- Grid border treatment (shared lines, no outer radius) gives a serious editorial feel.

**Weaknesses:**
- "Six things off your plate" is weak as a headline. The "What you get" label above already sets the context.
- "Warm and seasonal for a florist, direct and local for a plumber" appears verbatim in both How It Works and the feature description. Repeated language signals thin content.
- "Autopilot mode" listed as a feature is not mentioned or priced in the pricing section. Raises unanswered questions.

---

### 5. Competitor Comparison — 7.3 / 10

**Strengths:**
- Specific competitor names and prices are far more credible than anonymous "alternatives."
- Source footnote with date is professional. "We give credit where it's due" is a nice human touch.

**Weaknesses:**
- "Social Media Manager" column is ambiguous — human hire or software? A business owner comparing costs could be confused.
- On mobile (375px), horizontal scroll is required to see the TextMarketer column. The 40px fade-edge indicator is too subtle to communicate scrollability. This is the most damaging mobile layout bug on the page.
- No CTA below the comparison table. Highest-intent moment on the page (just learned they could replace a $2,500/mo hire for $49) with no conversion prompt below it.

---

### 6. Social Proof — 6.5 / 10

**Strengths:**
- Three quotes cover three distinct business types — salon, florist, plumber. Smart demographic spread.
- Casual, unpolished writing voice reads authentically.
- Initials-only avatars are an honest alternative to stock photos.

**Weaknesses:**
- "47 businesses in closed beta" is the section label. 47 is not reassuring for a product asking $49–$199/mo. The waitlist number (217) is far more impressive — lead with that.
- "Q4 2025" in the disclaimer is now five months ago. Feels stale.
- No quantified outcomes (revenue, time saved, followers gained) in the Renee or Maria quotes. Anecdotal only. A sceptical business owner wants numbers.

---

### 7. Pricing — 7.5 / 10

**Strengths:**
- "Less than your cheapest employee" anchors correctly against the comparison section.
- Annual/monthly toggle with live price update works well.
- Feature lists are specific and differentiated between tiers.

**Weaknesses:**
- "AI generations" as a unit is not intuitive. 100 vs 500 means nothing to a small business owner. The parenthetical examples help but are buried in muted small text.
- Pro at $199/mo includes "Website audit + copy fixes" — what "copy fixes" means is unexplained. Raises more questions than it answers at that price point.
- The "Save 20%" pill displays even when Monthly is active, which reads as a minor bug.

---

### 8. FAQ — 7.0 / 10

**Strengths:**
- Seven questions address genuine objections in priority order.
- "Text CANCEL at any time" is a strong trust move and correctly handled in the FAQ.
- Accordion implementation is clean; touch targets correct.

**Weaknesses:**
- "Common questions" is not a headline. Should be reframed: "Everything you'd Google before signing up."
- Twitter/X coming Q3 2026 caveat signals incompleteness to businesses with that audience.
- No FAQ item on what happens if the AI posts something wrong or off-brand — one of the top objections for this product. The approved-content flow is covered but not the error/recovery story.

---

### 9. Final CTA and Signup Form — 7.0 / 10

**Strengths:**
- Two-step form (email then phone) reduces initial commitment friction correctly.
- "217 businesses already on the list" counter above the form creates urgency.
- State transition ("One more thing.") is smooth and well-written.

**Weaknesses:**
- "Join the waitlist. Be first in line." is the weakest headline on the page and it is in the most important position. The product's core promise should be the last thing a visitor reads before submitting.
- "Opening access in waves" is vague and could feel like a stall tactic.
- The 217 counter is static HTML. Returns visitors will see the same number and lose trust.

---

### 10. Visual Design and Typography — 7.8 / 10

**Strengths:**
- Space Grotesk + Space Mono pairing is distinctive. Not Inter. Not Nunito. Rules followed.
- Dark warm-brown background with acid yellow-green accent is high contrast and memorable.
- Border-collapse grid on features is a mature design choice.

**Weaknesses:**
- Nav background colour mismatch is a polish gap.
- No visual differentiation between comparison and social proof sections. They bleed together on scroll.
- At 375px, hero stat badge goes full-width and left-aligns in a centred layout — creates awkward reading rhythm.

---

## Top Priorities (in order)

1. **Mobile comparison table is invisible to most users.** The TextMarketer column requires right-scroll that most visitors will never discover. Add a scroll affordance (arrow indicator, swipe label) or restructure for mobile. This is actively costing conversions on the primary device.

2. **Social proof headcount undermines credibility.** "47 businesses in closed beta" reads as small. Replace with "217 businesses on the waitlist" or reframe entirely. Update the Q4 2025 date reference.

3. **Add a CTA immediately below the comparison table.** The moment a business owner sees they can replace a $2,500/mo hire for $49 is the highest-intent moment on the page. No conversion prompt exists there. Add one.

4. **Final CTA headline is the weakest copy on the page.** It should be the strongest. Rewrite to distill the core promise into the last line a visitor reads before entering their email.

5. **"Save 20%" pill should only appear on the Annual toggle.** Showing it on Monthly reads as a display bug and erodes attention to detail.

---

## What Is Working Well

- The core concept is differentiated and the page communicates it quickly. A business owner understands the product within the first viewport.
- Copy quality is above average throughout. Conversational testimonials, footnoted comparison sources, specific how-it-works steps — all stronger than the category norm.
- Interactive demo is the page's standout feature. It earns its real estate and genuinely sells the product.
- Typography and colour system are distinctive. The page does not look AI-generated.
- Two-step signup form is correctly structured.

---

*Audit by Nigel — strict scoring from a small business owner's first visit.*
