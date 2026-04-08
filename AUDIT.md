# Nigel's Audit — TextMarketer Landing Page
**Date:** 2026-04-07
**Auditor:** Nigel (strict British auditor, small business owner perspective)
**Score:** 7.4 / 10

---

## Score History
6.2 → 6.8 → 6.4 → 7.1 → 7.3 → 7.2 → 7.0 → 7.1 → **7.4**

---

## Overall Verdict

This is a genuinely well-structured landing page. The core proposition — "manage your entire marketing by text" — is stated clearly, early, and repeated with discipline. The hero split layout with the live animated phone conversation is the single strongest element on the page. The copy has improved substantially from earlier versions; it now reads like someone who understands small business owners, not like a GPT summary of a SaaS playbook.

The page earns a 7.4 because it has broken several of Claude's default patterns, the design has a distinctive identity (warm dark palette, Space Grotesk/Mono pairing, acid yellow accent), and the interactive demo is genuinely useful. It drops points for three persistent structural problems: the social proof section is still fabricated and feels fabricated, the pricing section has an unresolved tension between "waitlist" framing and "buy now" pricing cards, and the hero phone widget loops forever with no pause — a form of animation noise that actually undermines credibility on repeat viewing.

---

## Section-by-Section Breakdown

### 1. Navigation — 8.0
Clean, minimal, fixed. Logo uses monospace with the accent colour on the brand name — distinctive without being gimmicky. Single CTA in the nav ("Join waitlist") is correct; no menu clutter. The `scrolled` border-bottom on scroll is a tasteful touch. Nothing to change here.

### 2. Hero — 7.5
**What works:**
- The stat bar ("SMS read 98% of the time / Email: 22%") is a smart piece of credibility placed before the headline. It earns the headline rather than just asserting it.
- "Your marketing team lives in your texts" is a genuine improvement over earlier versions. Compact, concrete, memorable.
- The split layout with the phone widget on the right is correct — the demo IS the product. Showing it in the hero is the right call.
- Trust line beneath the CTAs ("14-day free trial · No credit card · Cancel anytime by text") is appropriately modest.

**What does not work:**
- The hero phone auto-plays a loop on a 4-second restart. After the second or third loop, it becomes noise. A busy small business owner who pauses on the page does not want to watch the same script replay. One pass, then freeze on the final state — or loop much more slowly (30-second gap between replays).
- The description paragraph ("No app. No dashboard. No login. Ever. TextMarketer is an AI...") is slightly long. The first two sentences are gold. The third ("Sign up and your first week of posts arrives within the hour") should move to the "How it works" section — it is a promise, not a description.
- The ghost "See how it works" CTA button below the primary CTA is good, but its border colour blends almost completely into the dark background on lower-brightness screens. Needs slightly higher contrast on the border.

### 3. Demo Section — 8.0
**What works:**
- Four scenario flows (posts, stats, ad, audit) cover the product's actual value propositions.
- The typing indicator before each AI response is correct behaviour — it communicates latency honestly.
- After completing a flow, the prompt buttons update to exclude the flow just run. This is a thoughtful UX detail.
- Content of the flows is specific ("Joe's Coffee", real post copy, real ad targeting language). Specificity is credibility.

**What does not work:**
- After running all four flows, there are no more prompt buttons and no reset. A visitor who is engaged enough to try all four scenarios hits a dead end. There should be a "Start over" button.
- The section heading "See exactly how it works" duplicates the ghost CTA from the hero. Fine, but the sub-copy ("Pick a scenario to walk through a real conversation") is a bit dry. Something like "Your thumb is the only dashboard you need" would maintain the product voice.

### 4. How It Works — 7.5
Three-step grid is appropriately simple. The numbered labels (monospace, bordered, uppercase) are a design choice that works. Step copy is specific and actionable — "Answer 5 questions," "Reply YES to post," "Reply EDIT to change it." This section lands well.

One weakness: Step 2 ("AI does the work") describes content generation with two examples (florist, plumber). This is the right instinct but the paragraph ends slightly abruptly. The transition from "does the work" to "you just approve" would benefit from one line acknowledging the approval loop — currently the section reads as if Steps 2 and 3 are discontinuous.

### 5. Features Grid — 7.0
Six features in a 2x3 bordered grid. The structure is correct — it mirrors the product's actual feature set without padding it with meaningless extras. The copy for each feature is specific and command-oriented ("Text 'run an ad.' Get 3 variations... Reply the number you like. Done.").

**What does not work:**
- The grid uses `border-bottom:none` on the last two items (CSS rule `feature:nth-last-child(-n+2)`), which means the grid has an open bottom edge. On dark backgrounds this creates a floating quality that looks unfinished. Add a bottom border on the container or close the grid properly.
- "Website audit in plain English" as a feature implies the product can audit any website. But looking at the FAQ, this is limited (1/month on Starter). The feature description does not mention this limitation at all. A small business owner who signs up expecting unlimited audits will be annoyed.

### 6. Comparison Table — 7.5
The desktop table (4-column comparison with Social Media Manager, Hootsuite, Podium, TextMarketer) is well-executed. The mobile version (3-column: Hootsuite/Podium combined, TextMarketer) is a reasonable collapse, and the CSS hiding/showing is done correctly.

**What works:**
- The source citation at the bottom ("Sources: Hootsuite pricing page, Podium.com, Indeed salary data — April 2026") is a genuinely good credibility move. Most landing pages make up comparison data. Citing sources is honest and differentiating.
- The CTA inside the compare section ("Replace your $2,500/mo hire for $49") is aggressive in the right way — it quantifies the comparison into a single concrete swap.

**What does not work:**
- "Partial" checkmarks (greyed-out checks for competitors) are slightly misleading. A greyed check implies partial capability, but for "Posts written in your voice" a Social Media Manager clearly does this better than a SaaS tool. Using a tilde character (~) in the mobile view but a greyed check in the desktop view creates inconsistency.

### 7. Social Proof — 5.5
This is the weakest section. Three fabricated text thread testimonials from "Renee B. (Studio 44 Salon, Atlanta)," "Maria T. (Bloom & Co. Florals, Phoenix)," and "Dave K. (Kowalski Plumbing, Chicago)." The copy reads like AI-generated testimonials — which it is. The problem is not the format (fake text bubbles are fine as a UI device); the problem is that small business owners will recognise the "relatable everyman" diversity of the three personas as template thinking.

"Names and businesses shared with permission" is a legal disclaimer that implies these are real — but the product is in pre-launch (no customers yet). This note is either misleading or describes internal beta testers who sound suspiciously articulate.

At 5.5 this section actively hurts the page. It would be better to:
- Replace with 3 honest "scenarios" framed as hypotheticals ("Here's how a salon owner would use TextMarketer")
- Or remove it entirely and let the demo section do the social proof work
- Or clearly label them as "early access testers" with extremely specific outcomes and real names only if available

### 8. Pricing — 7.5
**What works:**
- Three-tier with Starter/Growth/Pro is standard but the copy for each plan description is excellent. "You have 1-2 social accounts and want to post consistently without thinking about it" — that is a real customer speaking. This kind of second-person plan description is what separates competent landing pages from generic ones.
- Annual toggle that shows "Save 20%" pill only when annual is selected is correct UX.
- The `// comment syntax` plan names (monospace) match the site's design language.

**What does not work:**
- The page is framed as a waitlist ("Join the waitlist," "Opening in May 2026"), yet the pricing section has "Get Started" buttons that scroll to the signup form. This creates a cognitive dissonance. A small business owner asks: "Can I actually sign up now, or am I just joining a list?" The pricing cards need a clear "Waitlist pricing — locked in when you join" framing, or the CTAs need to say "Reserve this plan" instead of "Get Started."
- The Pro plan description ("You run multiple locations, manage marketing for clients") suggests agency use. But the product's identity is specifically built around the solo-operator small business owner. Pivoting to agencies in the Pro tier creates a brand identity crack that observant visitors will notice.

### 9. FAQ — 8.0
Eight questions with direct, confident answers. "Text CANCEL at any time" answers the cancellation fear directly. "Nothing posts without your YES" answers the trust concern. The format (accordion, clean, no icons) is correct. The copy does not dodge any question.

One minor note: the question "Is this live? When does access open?" should be Question 1, not Question 8. This is the highest-anxiety question a first-time visitor has. Burying it last ensures many visitors scroll away before they get the context they need to trust the page.

### 10. Final CTA / Signup — 7.0
**What works:**
- Two-step form (email first, then phone) is smart — it reduces initial commitment and increases completion rate.
- The confirmation message ("We're opening access to the first 500 businesses in May 2026. We'll text you the moment your spot is ready.") is specific and appropriately low-pressure.
- Privacy/Terms links in the footer note use a proper tap-target override (min-height: 44px).

**What does not work:**
- The headline "Your marketing is one text away" is good but the sub-copy "Enter your email to hold your spot. We open access in waves." is passive and slightly corporate-sounding. "Waves" is unclear jargon. "We'll text you in May — no checking back, no logging in" would be more on-brand.
- The form step transition uses `setTimeout` of 500ms to swap from email to phone step. This feels like a bug (lag) rather than a feature. The transition should be immediate or use a proper CSS fade.

### 11. Footer — 7.5
Minimal, correct. Privacy, Terms, email contact. Copyright line repeats the tagline ("Your marketing, in your texts") — a tiny brand-consistent detail. Nothing to fix.

### 12. Design / Visual Identity — 7.5
The warm dark palette (#141210) avoids the flat-grey fatigue of most SaaS dark modes. The acid yellow (#d4f53c) accent is bold and consistent — it appears on the primary CTA, the accent logo text, the highlighted comparison column, and the outgoing message bubbles in the demo. This is disciplined use of a signature colour.

Space Grotesk (sans-serif) for body, Space Mono for labels/plan names/logos — a pairing that communicates "modern but not pretentious." Neither font is in Claude's default aesthetic repertoire (Inter, Nunito). The rule has been followed.

Animation is restrained throughout, with one exception: the hero phone auto-looping. Everything else — the `msgIn` keyframe, the typing dots, the FAQ accordion, the nav scroll border — is functional, not decorative.

---

## Prioritised Recommendations

### Priority 1 — Fix the social proof section (or remove it)
The fabricated testimonials are the single biggest credibility risk. A sceptical small business owner will recognise "Renee B. / Maria T. / Dave K." as template personas. Either source real early-access testers with specific numbers, reframe as honest hypotheticals, or cut the section and extend the demo section.

### Priority 2 — Resolve the waitlist vs. pricing-cards tension
The page says "join the waitlist" but shows three plan tiers with "Get Started" buttons. This is confusing. Either rename the CTA buttons to "Reserve this plan" and show "Waitlist pricing — locked in when you join," or remove pricing entirely until launch and replace with "Pricing starts at $49/mo — locked in at waitlist."

### Priority 3 — Stop the hero phone from looping
The auto-play hero conversation replays on a 4-second gap, which means it loops continuously while the visitor reads the page. Play once, then freeze on the final state. This removes animation noise and makes the hero feel more premium. The demo section below does the interactive work.

### Priority 4 — Move the "Is this live?" FAQ to the top
Question 8 is the highest-anxiety question on the page. Move it to Question 1 or 2. Visitors who are unsure whether this product is real will not scroll eight items deep to find out.

### Priority 5 — Fix the features grid border gap
The bottom edge of the features grid is open (no border-bottom on the container). On dark backgrounds this looks unfinished. Add a border-bottom to the `.features__grid` container or adjust the nth-child rule.

---

## What Genuinely Works
- The core product proposition is clear, specific, and consistent throughout
- The interactive demo is the strongest element on the page and earns its prominent placement
- The comparison table cites real sources — a rare and trust-building move
- The pricing copy uses second-person customer voice rather than feature lists
- The design system is coherent and distinctive — not AI-generic
- The FAQ is honest and direct
- The two-step signup form is correctly sequenced (email before phone)

---

*Nigel grades on a real-world curve. 7.0 = better than most. 8.0 = would actively choose over competitors.*
