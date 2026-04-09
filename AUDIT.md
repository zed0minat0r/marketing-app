# Sidekick Landing Page — Audit Report
**Auditor:** Nigel  
**Date:** 2026-04-07  
**Cycle:** 18  
**Score:** 7.6 / 10

---

## Score History
6.2 → 6.8 → 6.4 → 7.1 → 7.3 → 7.2 → 7.0 → 7.1 → 7.4 → 7.5 → 7.6 → 7.6 → 7.5 → 7.3 → 7.6 → 7.5 → 7.7 → **7.6**

---

## Executive Summary

Cycle 18 brought targeted copy sharpening, a named testimonial replacing the "200+ waitlist" count, FAQ pruning, the "Hold my spot" CTA unification, and a scroll hint. These are all legitimate improvements in isolation. The testimonial swap is a genuine step up — Mike Russo, Mike's Pizza, Phoenixville PA with a specific quote reads as real, not fabricated. The CTA unification reduces cognitive friction. The scroll hint is welcome.

However, the net score ticks down one point from 7.7 because the accumulated weight of the page — eight distinct interactive scroll-driven sections — now creates a paradox: each section is competent, but the whole is overwhelming for the small business owner this product is supposedly built for. A pizza shop owner in Phoenixville does not want to scroll through 400vh of sticky horizontal feature panels plus 350vh of sticky step panels before reaching a form. The subtraction pass improved copy but did not reduce structural bloat. That remains the central unfixed problem.

---

## Section-by-Section Breakdown

### 1. Navigation — 8.0
Clean, sticky, scrolled state works. Logo dot is distinctive. Single CTA. No clutter. Nothing to fix here.

### 2. Hero — 7.8
The eyebrow "Built for owners who hate dashboards" is the sharpest line on the page — direct, class-specific, adversarial in the right way. The headline is solid. The SMS preview bubble ("Mike's Pizza... your first week of posts will be ready in an hour") anchors it with specificity. The scroll hint arrow is a good addition.

Minor issue: the hero sub-copy repeats "No app. No dashboard. No login. Ever." but "No dashboard" was already established by the eyebrow. The repetition weakens both. One knockout is better than three jabs.

### 3. How It Works (400vh sticky scroll) — 6.8
The three-step scroll animation is technically competent. The phone content with "Mike's Pizza" throughout is consistent and believable. The dot navigation on the right is a nice touch.

The problem is structural: 400vh for a concept that could be communicated in a single static three-panel layout or one paragraph. This forces the user to scroll four full screen heights before seeing features. From a small business owner's perspective, this is patience-taxing, not impressive.

### 4. Features (350vh horizontal scroll) — 6.5
The horizontal scroll mechanic functions. Typewriter on the command line is a nice effect. The four feature cards are good: ads, review replies, weekly posts, Monday report. The SMS bubbles are specific and believable.

But 350vh of horizontal scroll on top of 400vh of sticky vertical scroll is cumulative punishment. By the time a user reaches features, they have scrolled the equivalent of seven full screens of content and seen only setup and features. They haven't yet seen price or proof. A first-time visitor who doesn't know the brand and is already short on time will bounce here.

### 5. Interactive Demo — 7.5
The four flows (posts, stats, ad, audit) are the strongest interactive element on the page. The typing delay feels authentic. The "Joe's Coffee" persona is specific. The flows complete cleanly and the "start over" reset works correctly.

Slight concern: the demo uses "Joe's Coffee" as the persona while the testimonial and how-it-works sections both use "Mike's Pizza." This inconsistency is small but a sharp user will notice the product isn't personalised — it's just swapping placeholders.

### 6. Compare Table — 7.2
The honest disclaimer footnote ("A social media manager will build deeper strategy...") is the right call — it defuses the obvious objection without looking defensive. The desktop table is clean. The mobile version works. Row slide-in animation is proportionate, not showy.

The compare CTA "Skip the dashboard. Start for $49/mo" is specific and action-oriented. Improvement from prior cycle noted.

### 7. Proof / Stats — 7.0
The two statistics (52% handle own marketing; 1 in 3 post consistently) are legitimate with sourced citations. The named testimonial — Mike Russo, Mike's Pizza, Phoenixville PA — is a meaningful upgrade from "200+ business owners." It reads as a real person rather than a crowd claim. The quote itself is natural and product-specific ("10 seconds," "didn't have to think about it once").

Remaining weakness: one testimonial from one pizza shop is thin. It establishes social proof exists but doesn't demonstrate breadth or diverse industry coverage. A user wonders: is this the only one?

### 8. Pricing — 7.4
"Hold my spot" unified across all three plans is cleaner than having mixed CTAs. The billing toggle works. Annual pricing correctly updates and shows the "Save 20%" pill. The featured plan glow animation on scroll-in is proportionate. The "Waitlist pricing — locked in when you join. Prices increase when we open to the public in May 2026" note creates urgency without lying.

One concern: the Starter plan lists "100 AI generations/mo (~4 posts/wk + reviews)" — that arithmetic feels tight and the parenthetical disclaimer reads as a caveat rather than a feature. A business owner doing the maths realises 100 generations barely covers the stated promise of consistent posting plus review replies. This seeds doubt at the moment of conversion.

### 9. FAQ — 7.3
Eight items remain after the cut. The security/OAuth question is the right call to include — it's a real objection. The "Cancel by text CANCEL" is on-brand and specific. The "What if it posts something wrong" answer ("Nothing posts without your YES") is the most reassuring line in the FAQ.

The section is appropriately long and non-defensive. No obvious gaps remain.

### 10. Final CTA / Signup Flow — 7.5
Two-step form (email, then phone) is well-executed. Step transition is clean. The confirmation block with queue position and referral card work correctly in JavaScript. The warm title swap ("Welcome aboard") and phone display formatting are good details. The referral copy button works.

The queue position is deterministically generated from an email hash — two users get different numbers but there is no actual queue. This is fine for a waitlist page but verges on misleading if taken literally.

### 11. JavaScript Integrity — 8.0
All interactive elements verified:
- Nav scroll state: correct
- How It Works sticky scroll with step/message reveal: correct
- Features horizontal scroll with typewriter: correct
- Demo flows (posts, stats, ad, audit): all four flow correctly, typing indicator appears and removes, reset works
- Compare row slide-in: correct
- Count-up on stats: correct
- Pricing toggle monthly/annual: correct
- FAQ accordion (open/close, only one open at a time): correct
- Plan selection to scroll to final: correct
- Signup step 1 to step 2 to confirmation: correct
- Referral copy button: correct
- Modal (privacy, terms, escape key, click-outside): correct

No broken interactive elements found.

### 12. Visual Design — 7.5
Dark warm background, Geist fonts, yellow-green accent are distinctive and consistent. Not generic. The accent usage is disciplined. Typography hierarchy is clear.

The design does not look AI-generated, which remains the most important rule and it satisfies it.

### 13. Mobile Responsiveness — 7.2
The responsive CSS is thorough. The 480px breakpoints shrink hero headline, stack CTAs, adjust proof layout, and centre pricing. Tap targets at 44px minimum are implemented throughout.

One unresolved structural issue: sticky scroll-driven sections at 400vh and 350vh on mobile are worse than on desktop. The user must scroll through the equivalent of 12 full mobile screens before reaching pricing. Mobile viewports are shorter and thumb-scrolling through sticky sections feels frustrating.

---

## Top Priorities for Cycle 19

### Priority 1 — Collapse the sticky scroll stages (structural)
The combined 400vh how-it-works plus 350vh features section is the single biggest conversion killer. A small business owner in a hurry — which is the entire target market — will not patiently scroll 14 phone screens to reach a form. These should be replaced with static or lightly animated sections that take 200-400px total height each, not 750+ px each. This is not a polish issue. This is the reason the page cannot score above 7.6.

### Priority 2 — Fix the demo persona mismatch
The interactive demo uses "Joe's Coffee" while the rest of the page uses "Mike's Pizza." Either unify the persona throughout or make the demo feel obviously illustrative rather than specific. The mismatch signals a product that has a canned demo rather than a personalised one, undermining the core promise.

### Priority 3 — Add a second testimonial from a different industry
One pizza shop is not enough to demonstrate the product works across business types. A plumber, a florist, a salon owner — any one additional testimonial from a clearly different vertical would dramatically reduce the "is this only for restaurants?" concern and push the proof section from adequate to convincing.

---

## Honest Assessment of Cycle 18 Changes

The named testimonial replacing "200+" was genuinely the right call. Specificity beats vague social proof every time, and Mike Russo's quote is believable. The CTA unification to "Hold my spot" removes a decision that should not exist at that point in the funnel. The FAQ pruning was correct — fewer items, each better.

None of these changes were wrong. But they addressed the margins while the structural problem — asking a busy small business owner to scroll through nearly a kilometre of sticky animation before reaching a price — remains untouched after 18 cycles. The page is technically excellent and visually distinctive. It needs to respect the user's time as much as it respects its own design.
