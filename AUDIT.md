# Nigel's Audit — TextMarketer Landing Page
**Date:** 2026-04-07
**Auditor:** Nigel (strict British auditor, real user perspective)
**Score History:** 6.2 → 6.8 → 6.4 → **7.1**

---

## Overall Score: 7.1 / 10

This is a genuine step up. The site no longer looks like a template exploded onto a page. It has a point of view, a clear colour palette, and copy that mostly earns its words. A real small business owner visiting this for the first time would stay long enough to scroll. That puts it above average. It does not yet close the sale reliably — there are trust gaps, flow interruptions, and at least one structural flaw that suppresses conversion. Details below.

---

## Section Scores

### 1. Visual Identity & Design Language — 7.5
Dark background, acid-yellow accent, Space Grotesk/Space Mono pairing. This is confident and distinctive. It avoids the default Claude palette (teal/green, rounded cards, Inter). The monospaced `//` label convention is a nice detail. The border-based grid for features is clean and uncommon. The `--bg:#141210` near-black with warm undertones feels intentional.

**What works:**
- Colour palette is singular and memorable. Yellow on near-black reads with force.
- Typography pairing is appropriate — developer-adjacent but not alienating for business owners.
- No gratuitous gradients, no confetti, no particle systems.
- Feature grid (border-only, no card backgrounds) is visually mature.

**What doesn't:**
- The nav logo "TextMarketer" with a yellow "Marketer" is slightly awkward — the dot-pattern speech bubble SVG reads small at 18px and loses meaning.
- The `// most popular` plan label feels a touch too developer-coded for the target audience (small business owner in Phoenix, not a SaaS buyer).
- The `--surface2` colour used in phone/chat headers is barely distinguishable from `--surface` at a glance. Lacks contrast hierarchy.

---

### 2. Hero Section — 7.0
"Your marketing team lives in your texts" — good. Direct. The word "texts" in accent yellow is the right emphasis. The CTA row (Join waitlist + See it live) is clean and the trust line underneath ("14-day free trial · No credit card · Cancel anytime by text") does real work.

**What works:**
- Headline is specific and memorable. Not "AI-powered marketing for your business."
- Two CTAs are logically ordered and sensibly labelled.
- Trust signals are immediately below the primary CTA, not buried.
- The animated hero chat preview (cycling through three real use-case sequences) is genuinely good — it shows, not tells.

**What doesn't:**
- There is no sub-headline or descriptor before the CTA row. The jump from headline to two buttons is slightly abrupt. A single sentence of context ("No app. No dashboard. No login. Just text.") exists in the meta description but not on screen above the fold.
- The hero live-preview widget is at the very bottom of the hero section — on a mid-size laptop, visitors may not see it without scrolling. It should sit alongside the headline, not beneath it.
- Hero padding (140px top) is generous on desktop but may feel like dead space before the fold on 1280px screens.

---

### 3. Interactive Demo — 7.3
The click-to-play demo is the standout feature of this page. Four pre-canned flows (posts, stats, ad, audit) each deliver realistic, specific output. The "audit my website" flow showing a 6.2/10 score with actual line-item issues is the best example — it demonstrates the product's voice without sounding like a brochure.

**What works:**
- The copy in the demo flows is specific: business names ("Joe's Coffee"), real numbers ("1,247 impressions"), real decisions ("Reply 1, 2, or 3 to launch").
- Typing indicator animates properly before each response — the pacing feels real.
- "Try another" reset is accessible and expected behaviour.
- Touch targets on prompt buttons are adequate (44px min-height implemented).

**What doesn't:**
- The demo is completely static. A small business owner who tries all four flows quickly realises there's no real intelligence — it will always say "Joe's Coffee." This is fine for a landing page, but the section header "Try it right now" is slightly misleading. "See how it works" would be more honest and less likely to undermine trust when the user notices it's scripted.
- After completing a demo flow, the phone widget has no visual feedback that you've "done" something — there's just a back arrow. The conversion opportunity at this moment (a small "Ready to try it for real?" nudge) is missed entirely.
- The phone frame is borderless on mobile (border-radius collapses to 16px) — acceptable but slightly less polished.

---

### 4. How It Works (3 Steps) — 6.8
Three clear steps: text your number, AI does the work, you just approve. The copy here is honest and specific ("Answer 5 quick texts about your business").

**What works:**
- The YES/EDIT/SKIP mechanic is explained plainly — this is the core user behaviour and it's right to surface it early.
- Business-type specificity ("a florist gets warm and seasonal, a plumber gets direct and local") in Step 2 is effective social proof through analogy.

**What doesn't:**
- "Up and running in under an hour" in the section title conflicts slightly with "Your first week of posts lands in your phone within the hour" from the FAQ. These should align precisely.
- Step 1 says "Sign up with just your phone number" but the actual CTA form collects an email address, not a phone number. This is a meaningful inconsistency that will confuse a skeptical visitor. If it's a waitlist (email), say that. If signup is via phone, the form should be a phone input.
- The step numbering (01, 02, 03) is fine but the monospace badge feels slightly decorative vs. functional.

---

### 5. Features Grid — 7.0
Six features in a 2-column border grid. Each has a small SVG icon, a specific title, and a short description. The writing here is the best on the page — concrete, benefit-led, and specific.

**What works:**
- "Every Google review answered" — this is a strong hook for any brick-and-mortar business.
- "Your numbers, every Monday" with the verbatim example text is excellent copy.
- "It spots problems before you do" with the proactive engagement-drop example shows the product behaving intelligently without overselling it.
- Feature icons are spare and appropriate (18px, stroke-based). Not distracting.

**What doesn't:**
- Icon for "3 posts per platform" (a mobile phone frame) doesn't cleanly communicate "social posting."
- The "Six things off your plate" section title is slightly generic — the number is a reach.
- Feature 3 ("Know what's wrong with your site") mixes the website audit into a social/review-focused feature set without clear explanation of how these connect. The small business owner may wonder why a marketing texting service audits websites.

---

### 6. Comparison Table — 6.5
The table compares TextMarketer against SimpleTexting, Klaviyo, and Attentive. This is a credibility risk as much as a credibility builder.

**What works:**
- The entry price row is the most useful — Attentive at "$2,000+/qtr" makes $49/month look extremely accessible.
- Admitting the competitors have "advanced email analytics" that TextMarketer lacks is a confidence move that earns trust.
- The source citation at the bottom ("Capterra, G2..." — April 2026) is a nice, unusual detail.

**What doesn't:**
- SimpleTexting and Klaviyo are not true competitors for this product. SimpleTexting is a bulk SMS tool; Klaviyo is an email platform. A small business owner who has heard of these would know they're not comparable. Comparing against Hootsuite, Buffer, or a social media manager (person) would be more credible.
- The entire "no dashboard required" row being marked X for all competitors is an oversimplification that a moderately informed user would question.
- The table is horizontally scrollable on mobile (min-width: 460px). This is handled, but a small business owner on mobile will likely not discover the scroll — they'll see a truncated table and move on.

---

### 7. Social Proof — 6.2
Three testimonials from "Maria T.", "Dave K.", and "Renee B." with business names and cities. A note states these are from a "closed beta, Q4 2025–Q1 2026."

**What works:**
- The specificity of businesses (Bloom & Co. Florals, Kowalski Plumbing, Studio 44 Salon) across diverse industries builds the "works for any business" case.
- Renee's quote about replacing a social media manager is the most commercially potent.
- The "Names and businesses shared with permission" disclaimer is handled correctly.

**What doesn't:**
- These testimonials feel fabricated. They are too clean, too varied, and too perfectly on-message. Dave's quote ("I didn't even read the instructions") reads like a copywriter's dream of a testimonial, not a real plumber's words. Maria's quote is grammatically flawless — an unusual trait for a small business owner texting a note of thanks.
- There are no photos, no social media handles, no verifiable references. A 2026 visitor who has seen a thousand AI-generated testimonials will flag these immediately.
- "What we heard in beta" as a section title is weak — it admits these are pre-launch impressions, which undermines the credibility of the proof.
- No logo strip, no "as seen in," no press mentions. The social proof section is doing less work than it should for a conversion-critical section.

---

### 8. Pricing — 7.2
Three tiers ($49/$99/$199/mo, with annual 20% discount). Monthly/annual toggle works correctly. The "// most popular" featured plan label is clear. Feature lists are specific and scannable.

**What works:**
- Pricing is shown clearly with no "contact us for pricing" evasion.
- The annual toggle with immediate price update is good UX.
- Plan descriptions target specific customer types ("1–2 social accounts," "you want consistent posting, paid ads...").
- "Less than your cheapest employee" section title earns its place.

**What doesn't:**
- $49/month for 100 AI generations ("~4 posts/wk + reviews") seems low at first but the generation cap explanation in the FAQ is buried. A visitor who reads "100 AI generations/mo" on the pricing card will not understand what that means without clicking into FAQ.
- All three "Get Started" buttons scroll to the waitlist form — this is consistent, but slightly odd for a Pro tier at $199/month. That tier implies a real buyer; sending them to a waitlist feels like a dead end.
- The Pro plan at "$199/mo" includes "website audit + copy fixes" — this implies the product actually edits your website. That's a significant claim that is not substantiated elsewhere on the page.

---

### 9. FAQ — 7.5
Seven questions, all directly relevant, all with specific answers. The accordion interaction works. This is the most trustworthy section on the page.

**What works:**
- "Cancel by text CANCEL" is a strong, on-brand answer.
- The "autopilot mode" mention in FAQ is the only place this feature is described — it's a compelling feature that deserves above-the-fold treatment.
- The generation explanation ("editing a post you already approved does not count") is useful precision.
- Questions are real questions, not softballs.

**What doesn't:**
- "Twitter/X support coming in Q3 2026" is a specific commitment. If this page stays live and Q3 2026 passes without that feature, it becomes a liability.
- The "5 quick questions about your business" onboarding flow is mentioned in FAQ but not shown anywhere in the demo or how-it-works section. This friction point deserves visibility — showing it would reduce signup anxiety, not increase it.

---

### 10. Final CTA & Signup Form — 6.3
"Join the waitlist. Be first in line." Form collects email address.

**What works:**
- Trust signals above the form are compact and well-chosen ("Early access · Cancel by text · No login ever").
- Privacy/Terms links open in a modal — no navigation away from the page.
- Error state on email input (red border) is functional.
- Success state removes the form and shows confirmation — clean.

**What doesn't:**
- The CTA form collects email, but the product is delivered via text message. There is no phone number field anywhere on the page. A prospective customer will reasonably wonder: "How will you text me if I only gave you my email?" This is the most significant trust gap on the page.
- "We'll email you when your spot is ready. We'll text you to get started." — but if you've only given an email, when do you give your phone number? The onboarding story has a missing chapter.
- "Join the waitlist" is a lower-commitment CTA than "Start your free trial." If there is a real 14-day free trial with no credit card, lead with that — not the waitlist framing.
- The footer email (hello@textmarketer.io) does not resolve if clicked — it will just open a mail client to a domain that presumably doesn't exist yet. Fine for an early landing page, but noteworthy.

---

### 11. Performance & Technical — 7.8
Single-file HTML, minimal dependencies (two Google Fonts, no JS frameworks). CSS is compact. Scroll events are passive. Animation is CSS-driven where possible.

**What works:**
- No third-party analytics, trackers, or cookie banners.
- The entire page is one file with no asset requests beyond fonts. Fast.
- Responsive breakpoints exist at 768px and 480px. Mobile layout is largely functional.
- ARIA roles on table, live region on hero preview.
- Tap targets meet 44px minimum across interactive elements.

**What doesn't:**
- The hero live-preview runs a perpetual async loop (`runSequence()` calling itself via `await sleep(4200)`). There is no `IntersectionObserver` to pause this when off-screen. On a low-powered phone with a long session, this burns battery and resources needlessly.
- The font stack loads Space Grotesk and Space Mono from Google Fonts with `display=swap`. No `font-display: optional` fallback strategy.

---

## Prioritised Recommendations

### Priority 1 — Fix the phone-number gap (critical conversion killer)
The product is delivered by text. The signup form only collects email. A visitor who has read the page carefully will notice this and lose trust. Either collect phone number in the form (preferred, on-brand), or add a clear explanation that says "We'll ask for your phone number when your spot opens." The current ambiguity is the single biggest blocker to conversion.

### Priority 2 — Replace or remove the testimonials as written
These read as AI-generated. On a page about an AI product, that is especially damaging. Options: (a) remove them entirely and replace with a "Launching Q2 2026 — be first" message, (b) use raw, unpolished quotes with visible social media screenshots, or (c) be transparent: "We haven't launched yet — but here's the reaction we got from our 20-person beta." Honesty here builds more trust than polished fabrication.

### Priority 3 — Fix the "Sign up with your phone number" vs email-form contradiction
Step 1 of How It Works says "Sign up with just your phone number." The actual CTA form takes an email. These must match. This is not a cosmetic inconsistency — it tells the user the page was not carefully thought through, which undermines confidence in the product.

### Priority 4 — Surface "autopilot mode" above the fold or in features
"Autopilot mode" (mentioned once in FAQ) is one of the most compelling differentiators on the page. A user who doesn't read the FAQ will never see it. It should appear in the features grid or How It Works.

### Priority 5 — Move the hero live-preview widget up
The animated chat widget is the most convincing element on the page. It is currently below the CTA buttons. It should be alongside the headline — the way Linear shows product screenshots inline with the hero. Visitors who bounce quickly will never see it.

### Priority 6 — Replace comparison table competitors
SimpleTexting and Klaviyo are not competitors a small business owner would recognise as alternatives to a text-based marketing agent. Replace with Hootsuite, a freelance social media manager (average cost), or Buffer. The comparison only works if the visitor would have actually considered those alternatives.

### Priority 7 — Address the Pro plan claim about website edits
"Website audit + copy fixes" at the Pro tier implies the product edits your website. This is a large claim not backed by any other section. Either remove it or explain how it works — even one sentence in the FAQ.

---

## What Is Working Well (Do Not Break)
- The interactive demo flows. Specific, realistic, well-paced. This is the best element on the page.
- The features grid copy. Every feature description earns its words.
- The FAQ. Honest, complete, and appropriately specific.
- The colour palette and typographic system. Distinctive without being alienating.
- The pricing section. Clear, scannable, fairly framed.

---

## Score History
| Version | Score | Notes |
|---------|-------|-------|
| v1      | 6.2   | Initial build, generic feel, weak copy |
| v2      | 6.8   | Interactive demo added, visual improvement |
| v3      | 6.4   | Regression — clutter or copy degraded |
| v4      | **7.1** | Strong copy, good demo, distinctive design; held back by phone/email contradiction, weak social proof, comparison table mismatch |
