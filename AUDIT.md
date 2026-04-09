# Sidekick — Nigel Audit #19
**Date:** 2026-04-07
**Auditor:** Nigel (strict British auditor)
**Perspective:** Small business owner visiting for the first time on a phone
**Score:** 7.6 / 10

---

## Score History
6.2 → 6.8 → 6.4 → 7.1 → 7.3 → 7.2 → 7.0 → 7.1 → 7.4 → 7.5 → 7.6 → 7.6 → 7.5 → 7.3 → 7.6 → 7.5 → 7.7 → 7.6 → **7.6**

---

## Verdict on the Sticky Scroll Collapse

The collapsing of 750vh sticky scroll was the correct call and clearly the right structural decision. The page is now genuinely navigable — pricing is reachable in 3-4 scrolls rather than 12+. However, it did not break through the ceiling. The score holds at 7.6 rather than advancing.

Why? Because collapsing the scroll stages solved a navigation problem that was always a self-inflicted wound. A first-time visitor who never suffered through the old sticky scroll cannot perceive the improvement. What they see is a page that is still doing slightly too much — demo, compare table, stats section, pricing, FAQ, and a two-step form all fighting for attention before the close. The structural debt has been repaid, but the page has not yet earned a leap in persuasiveness.

---

## Section-by-Section Breakdown

### 1. First Impression / Hero — 7.8
The headline "Your marketing team lives in your texts" is strong and immediately differentiating. The sub-copy ("No app. No login. Ever.") is clean and punchy. The trust strip (Plans from $49/mo, 14-day free, no credit card, cancel by text) is well-placed and comprehensive.

The hero SMS preview — the little bubble showing Mike's Pizza onboarding — is effective as a concept but the implementation reads a bit like set-dressing. The exchange is: "Hey, what's your name?" / "Mike's Pizza." / "Got it. Ready in an hour." It conveys speed convincingly. Good.

Deduction: The eyebrow ("Built for owners who hate dashboards") tells me nothing about what the product actually does. This real estate should tell me what Sidekick is, not how the owner feels. It is a minor self-indulgence.

Score: 7.8/10

### 2. How It Works (Static 3-Step Grid) — 7.5
The collapse from sticky scroll to a static 3-column grid with inline SMS exchanges is a net positive. The steps are logical and the copy is crisp: "Answer 5 questions," "Content arrives," "You just approve." The Mike's Pizza conversation throughout creates a coherent through-line.

Weaknesses: The section title "Three texts and you're live" is a slight overclaim — the demo flows show multi-message exchanges, not single texts. A sceptical small business owner will notice this discrepancy. Also, the How It Works grid is visually identical in typographic treatment to the Features grid immediately below. There is no visual separation of rhythm between sections — they stack in a way that flattens the page's sense of progression.

Score: 7.5/10

### 3. Features (Static 2x2 Grid) — 7.4
Four clean cards: Facebook ad in 30 seconds, Google reviews, weekly posts, Monday report. These are the right features to highlight and the SMS mockups inside each card are concrete and believable. The unified Mike's Pizza persona throughout is a clear improvement — it gives the page coherence.

The typewriter effect on the feature-card__cmd elements ("> run an ad", "> new review detected") is clever and does not feel excessive. It fires once on scroll entry and stops. Acceptable.

Weakness: Card 04 ("Your numbers, every Monday") has noticeably thinner copy: "One text. No login screen, no guessing." After three cards with meaty descriptions, this feels unfinished. It reads like a first draft that was never filled in. This is a trust signal problem — if you cannot describe your reporting feature in more than one sentence, a cautious visitor will wonder whether it actually exists.

Score: 7.4/10

### 4. Interactive Demo — 7.8
This is still the strongest section on the page and the primary reason the score is not lower. Four flows (posts, stats, ad, audit), all unified under Mike's Pizza, all working correctly. The typing indicator, message animation, and prompt management all function properly. The "// that's the full tour" end state and restart button are thoughtful.

The fade-in on scroll entry (translateY 24px to 0, opacity 0 to 1) is understated and functional.

Minor issue: the demo phone's message window is quite tall on desktop (max-height: 360px). Long flow messages — particularly the ad flow with two back-to-back long messages — get clipped and require the user to scroll inside the phone widget. A real user may not realise this and will miss the final instruction ("Reply 1, 2, or 3 to launch"). This has been present for several cycles.

Score: 7.8/10

### 5. Compare Table — 7.0
The desktop comparison table against Hootsuite, Podium, and a Social Media Manager is solid and the mobile-specific grid version is well-executed. The disclaimer note at the bottom crediting where competitors have genuine depth is a confidence signal that works.

However, this section is placed after the demo. At this point a persuaded visitor has already mentally converted. For a sceptic who scrolled past the demo, the compare table is potentially useful, but its placement after a full interactive demo section means it catches very few persuadable people. The section has been here since the early builds. It is well-executed but arguably no longer earning its page real estate.

Score: 7.0/10

### 6. Proof / Stats — 7.2
The two statistics (52% of small business owners handle all their own marketing; 1 in 3 post consistently) are real and sourced, which is important. The count-up animation is disciplined — it fires once and does not loop.

The testimonial pair — Mike Russo and Sarah Chen — is the evaluated change this cycle. The addition of Sarah Chen (florals, Austin) is the correct decision: two testimonials of different business types and geographies is more credible than one. The quotes themselves are believable: Mike's is concise and product-specific; Sarah's is slightly longer and adds a genuine before/after (Sunday nights writing posts vs. reply YES three times Monday morning). Sarah's quote is the better of the two.

However: both are labelled "Early access." Both have no surname context beyond the business name. The testimonials read as if they were written by the product team rather than pulled from real conversation transcripts. A sceptical business owner — especially one who has been burned by software promises — will sense this. The styling is clean. The content is doing less work than the design suggests.

Score: 7.2/10

### 7. Pricing — 7.6
Three tiers ($49/$99/$199), annual toggle with 20% discount, featured plan glow animation on scroll entry. This is a clean, functional pricing section. The waitlist pricing note ("Prices increase when we open to the public in May 2026") creates appropriate urgency without being manipulative.

Plan buttons say "Hold my spot →" rather than "Sign up" or "Buy now" — the right language for a pre-launch product. The plan selection persists to the final CTA section, which is a nice touch.

Weakness: Pro plan at $199 lists "Website copy fixes — we do it, you approve" as a feature, but this capability is never mentioned or demonstrated anywhere else on the page. For a product operating entirely over SMS, offering to fix website copy is a significant claim. It needs one sentence of explanation or it sounds invented.

Score: 7.6/10

### 8. FAQ — 7.5
Eight questions, answers that are direct and appropriately confident. The cancel-by-text FAQ is particularly good: "We want you to stay because it's working, not because leaving is hard." This is the right voice for this product.

The "Is my social media login safe?" answer is thorough and technically accurate (OAuth, no password storage, revoke from Facebook/Instagram settings). This matters for a small business owner who has heard horror stories.

The FAQ uses a clean CSS max-height accordion with no JS bloat.

Minor: "Twitter/X support coming Q3 2026" appears in the FAQ but not in the features section. Small consistency gap.

Score: 7.5/10

### 9. Final CTA + Signup Form — 7.5
Two-step signup (email then phone) is the right friction model for a waitlist. The warm post-submission state ("Welcome aboard," queue position, referral card) is well-considered. The referral mechanic ("Refer 3 businesses, skip the queue, get 2 months free") is clear and immediately actionable.

Queue position is pseudo-randomised per email hash (180 + hash % 61 = 180 to 240). This is a known dark pattern. If a small business owner compares their number with a colleague and gets a different figure, trust evaporates immediately. This risk has been present since the early builds and remains the page's single biggest honesty vulnerability.

The final CTA headline "Your marketing shouldn't require a second job" is the strongest single line of copy on the page. It earns its 100vh treatment.

Score: 7.5/10

### 10. JavaScript Functionality — 7.9
All interactive elements tested and functioning correctly:
- Nav scroll class toggles at 40px scroll depth
- All four demo chat flows render, typing indicator appears and removes, messages auto-scroll, prompt buttons update correctly after each flow
- Billing toggle: monthly/annual switch updates all prices and period labels, save pill shows/hides
- FAQ accordion: opens/closes correctly, only one item open at a time
- Plan selection: scrolls to final CTA, shows selected plan badge, clear button works
- Step 1 to step 2 form: email validation, title/sub mutation, phone field focus
- Step 2 completion: confirmation block becomes visible, queue position renders, referral link generates from email hash
- Referral copy button: clipboard API path executes, "Copied!" state reverts to "Copy" after 2s
- Modal: privacy and terms both open with correct content, Escape key closes, backdrop click closes
- IntersectionObserver animations: feature card typewriter, demo fade-in, compare row stagger, pricing float-in, count-up stats — all behave as intended

No JavaScript errors detected on review. Event delegation on prompt buttons is correctly implemented.

Score: 7.9/10

### 11. Mobile / Responsive — 7.4
Responsive overrides are thorough. Three-column How grid collapses to single column. Two-column features collapse to single. Pricing grid collapses to single with featured plan ordered first. Compare table swaps to a purpose-built mobile grid. Hero CTA row stacks on 480px. Tap targets appear to be 44px minimum throughout.

Known issue that persists: demo phone messages area is shrunk to min-height 200px / max-height 240px on 480px. This is a very tight window for the multi-message flows. The ad and audit flows will require internal scrolling inside the phone — on mobile, users are very unlikely to discover this and will miss the final call to action within each flow.

Score: 7.4/10

### 12. Visual Design / Identity — 7.5
The dark warm-black palette (--bg: #0e0d0b), acid green accent (--accent: #d4f53c), and Geist/Geist Mono type pair is distinctive and non-generic. The aesthetic references Linear/Vercel correctly — premium but purposeful. Section borders (1px solid var(--border)) create rhythm without decoration.

The page does not look AI-generated. The mono code-like labels on feature cards and the radial spotlight on the hero are genuine design choices, not template defaults.

Score: 7.5/10

---

## Top 5 Priorities for Next Cycle

**1. Demo phone clipping on long message flows (mobile + desktop)**
The ad and audit flows overflow the max-height window. Users miss the final instruction. On 480px the window is 240px which is insufficient. Shorten message content in long flows, or add a subtle indicator that the chat area is scrollable.

**2. Feature card 04 copy is thin**
"One text. No login screen, no guessing." — the Monday report card needs one more concrete sentence. What does the report tell me? What metrics? This is a quick copy fix with a meaningful trust dividend.

**3. Queue position pseudo-randomisation is a live trust risk**
Two users comparing their queue numbers will get different figures derived from their email hash. This is the single most likely thing to destroy credibility at the moment of conversion. Options: a real shared counter, a displayed range ("among the first 250"), or remove the queue number entirely and lead with the referral card.

**4. Pro plan "website copy fixes" needs one line of context**
It is the only feature on the page with zero demonstration or explanation elsewhere. One sentence in the plan description or a new FAQ item would resolve this.

**5. Compare section position**
Consider moving the compare table before the demo, where it serves sceptics who need competitive framing before they will engage with interactive content. Post-demo, it catches almost no one.

---

## What the Sticky Scroll Collapse Actually Achieved

It made the page structurally sound for the first time. Pricing is now reachable. The Mike's Pizza persona unification gives the page narrative coherence that was absent before. The second testimonial adds sector diversity and the stronger quote is now on the page.

What it did not achieve: the ceiling has not moved because the remaining gap to 8.0 is about trust and copy depth, not navigation architecture. The next meaningful score advance requires more credible social proof, tighter demo content on small screens, and the elimination of the fake queue position number.

---

**Final Score: 7.6 / 10**

Holds steady. No regression. No advance. The structural improvements were real; the persuasion gap remains.
