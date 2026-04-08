# TextMarketer Landing Page Audit
**Auditor:** Nigel (strict British auditor)
**Date:** 2026-04-07
**Score:** 7.1 / 10

---

## Score History
6.2 → 6.8 → 6.4 → 7.1 → 7.3 → 7.2 → 7.0 → **7.1**

A modest recovery from the 7.0 slide. The fundamentals are genuinely sound. The product concept is clearly communicated and the copy has sharpened. However several chronic issues remain unfixed and are now actively limiting progress past the 7-point ceiling.

---

## Section Scores

### 1. First Impression / Hero — 7.2 / 10

**What works:**
- The stat badge ("SMS is read 98% of the time") is the smartest element on the page. It pre-empts the biggest objection before the user has even formed it.
- "Your marketing team lives in your texts" is punchy, accurate, and not generic. The em-highlight on "texts" earns its keep.
- The description paragraph is unusually honest: "No app. No dashboard. No login. Ever." Four declarative sentences. Good.
- Trust micro-copy below the CTA is well-placed and comprehensive.

**What doesn't work:**
- The hero is single-column with no visual on the right side. The layout declares a grid (`hero__split` with `grid-template-columns:1fr`) but there is no right element. This reads as a design that never got finished. A product this novel needs a visual anchor. The demo is buried below the fold.
- "Join the waitlist" is a cold CTA. There is no urgency mechanism, no counter, no evidence of scarcity beyond vague copy in the final CTA.
- The ghost button "See how it works" competes for priority. On mobile both stack vertically, but the visual weight is unbalanced — the ghost button almost equals the primary at a glance.

---

### 2. Interactive Demo — 7.8 / 10

**What works:**
- This is the strongest section on the page. The four flows (posts, stats, ad, audit) are grounded in realistic, specific content. "Joe's Coffee" as the example business gives it a real feel.
- The typing indicator adds just enough pacing. Delay times are proportionate.
- The "Try another" reset button is simple and works.
- 44px minimum touch targets on prompt buttons are correctly implemented.

**What doesn't work:**
- After completing a flow, the prompt buttons disappear entirely and only a reset appears. A user who finishes "Write this week's posts" and wants to immediately try "Create a Facebook ad" must reset first. Unnecessary friction.
- The demo has no framing headline visible when a user scrolls directly to this section; "See exactly how it works" is the section header but not always visible.
- The phone mock is competent but generic — nothing distinguishes it visually from a dozen other SMS product demos.

---

### 3. How It Works — 6.8 / 10

**What works:**
- Three steps is the right number. The monospace numbering (01, 02, 03) is visually clean.
- Step 03 copy ("Reply YES to post. Reply EDIT to change it. Reply SKIP to move on.") is the clearest explanation of the core mechanic on the entire page. This sentence should appear earlier.

**What doesn't work:**
- Step 01 is too long. Listing all five questions reads like a requirements document. The charm is lost.
- Three cards floating beside each other do not communicate sequence. No visual flow indicator, no arrow, no connecting line.
- The section title "Up and running in under an hour" is good but it sits above the steps without any visual connection to them.

---

### 4. Features Grid — 6.5 / 10

**What works:**
- The 2x3 grid with border intersections avoids the card-heavy look the rules explicitly prohibit.
- "A Facebook ad in 30 seconds" and "Every Google review answered" are concrete, specific headlines.
- Descriptions are tight — none over-explain.

**What doesn't work:**
- Six capabilities with no visual hierarchy between them. No indication of which are most used, most valued, or most differentiating.
- "Your numbers, every Monday" is a weak title. Sounds like a newsletter. The description ("One text. No log-in, no dashboard, no guessing.") is better than the headline.
- No iconography or visual of any kind. Pure text grid. Defensible if the copy earns it; it currently does not fully earn it.

---

### 5. Comparison Table — 7.5 / 10

**What works:**
- The pricing comparison ($2,500–$4k vs $49–199) is genuinely powerful and directly addresses the small business owner's primary concern.
- The in-section CTA ("Replace your $2,500/mo hire for $49") is the most commercially sharp copy on the page.
- Mobile-specific comparison table is a thoughtful implementation — two separate layouts rather than a broken horizontal scroll.
- Attribution footnote is trust-building and rare.

**What doesn't work:**
- The mobile version simplifies competitors to "Others," losing the named specificity (Hootsuite, Podium) that makes the desktop table compelling. This is a meaningful downgrade on mobile, where most users will land.
- "vs. the alternatives" section label is vague. Something like "vs. Hootsuite, Podium, and hiring someone" would be more compelling.

---

### 6. Social Proof — 6.6 / 10

**What works:**
- Testimonials formatted as SMS threads is on-brand and consistent.
- Dave K. (Kowalski Plumbing): "i don't do social media. my wife set this up" followed by "it just... runs" is the most credible testimonial on the page.
- Maria T.'s "thats it. thats the whole thing" is also strong.

**What doesn't work:**
- "From the waitlist" as the section label signals the product is not live, which erodes confidence precisely when you need to build it. If these are real customer testimonials, they should not be labeled as waitlist responses.
- All three threads end with "YES" from the user. The sameness is noticeable. One thread with a different dynamic would feel more authentic.
- Renee B.'s testimonial is confusing without context on who "she" is.
- "Names and businesses shared with permission" is buried in very small muted text. If these are real, present that disclosure more confidently.

---

### 7. Pricing — 7.3 / 10

**What works:**
- The monospace plan names (`// starter`, `// growth`, `// pro`) are consistent with the design language.
- Annual toggle with the "Save 20%" pill is well-implemented and correctly hides/shows.
- Each plan has a human description of the ideal customer, not just feature lists. Rare and helpful.

**What doesn't work:**
- "Less than your cheapest employee" is a good section title but the comparison is never made concrete here. The comparison table does it; the pricing section should reinforce it with a single anchor stat.
- Starter plan's ghost "Get Started" button looks like a secondary action compared to the featured plan. This may suppress conversion on the entry tier.
- The Pro plan's "Website copy fixes — we do it, you approve" is vague. What does "we do it" mean technically for a text-based product? Raises more questions than it answers.
- No money-back guarantee or satisfaction commitment anywhere. The 14-day free trial is mentioned but a clear refund policy would reduce perceived risk at the point of commitment.

---

### 8. FAQ — 7.4 / 10

**What works:**
- Seven questions at the right depth.
- The cancellation answer ("We want you to stay because it's working — not because leaving is hard") is the most human-sounding copy in the FAQ.
- FAQ accordion with min-height touch targets is correctly implemented.
- Twitter/X planned Q3 2026 is a good trust signal.

**What doesn't work:**
- "Questions we get a lot" is a slightly childish heading. Minor but worth noting.
- No FAQ entry addressing the most obvious trust concern: is this product live and when does the waitlist open? For a pre-launch product, the FAQ should address this directly.
- "Edits on content we already sent don't count against your limit" is buried in one FAQ answer. This deserves more prominent placement.

---

### 9. Final CTA / Signup Form — 6.8 / 10

**What works:**
- Two-step form (email then phone) reduces abandonment. Smart product design.
- Step transition copy ("One more thing. / What number should we text when your spot opens?") is smooth.
- Success message is appropriately minimal.

**What doesn't work:**
- "Spots filling. We open in waves." appears twice — once as the dot indicator above the form and once in the section trust bar. Sloppy duplication.
- After joining the waitlist, users receive no expected timeline. "We'll text you the moment your spot opens" — when? The ambiguity reduces excitement rather than building anticipation.
- Final CTA headline "Stop doing marketing. Start texting back." is the weakest headline on the page. "Texting back" implies responding to received texts, not initiating marketing. The paradox confuses rather than compels.
- No social sharing mechanism. A waitlist product should give joiners a way to share or track their position — this drives organic growth and increases perceived scarcity.

---

### 10. Design and Technical Quality — 7.0 / 10

**What works:**
- The warm near-black palette combined with the chartreuse accent (#d4f53c) is genuinely distinctive. Does not look AI-generated.
- Space Grotesk + Space Mono is a considered pairing. Monospace elements feel intentional.
- No gratuitous scroll animations. The `msgIn` keyframe is the only animation during normal browsing. This is exactly right per the rules.
- Border-intersection features grid is elegant.
- Responsive breakpoints at 768px and 480px are handled competently.

**What doesn't work:**
- The hero is visually incomplete on desktop. A single column of text with no image, graphic, or phone mock reads as an unfinished layout.
- No `<meta property="og:image">` or open graph preview tags in the head. When this URL is shared on social media it renders as a blank card, wasting every inbound link.
- Footer uses `hello@textmarketer.io` and privacy uses `privacy@textmarketer.io` — two different addresses. Fine technically, but implies operational maturity a waitlist product does not yet have.

---

## Chronic Issues (Flagged in Multiple Prior Audits, Still Unresolved)

1. **Hero has no visual.** Every prior audit has flagged this. The single-column hero with no right-side element looks unfinished on desktop. The demo phone mock should be promoted into the hero.
2. **"From the waitlist" proof label undermines credibility.** Testimonials framed as waitlist responses signal the product is not live. Relabel them.
3. **No timeline commitment post-signup.** After joining the waitlist, users receive no indication of when they will hear back. A launch estimate reduces abandonment anxiety.

---

## Top 5 Prioritised Recommendations

**1. Move the demo phone mock into the hero (Priority: High)**
Place the interactive phone on the right side of the hero text on desktop, above the fold on mobile. This solves the "unfinished layout" problem, provides an immediate visual hook, and removes the need for users to scroll before understanding the product. This single change would likely push the score to 7.5+.

**2. Fix the final CTA headline (Priority: High)**
Replace "Stop doing marketing. Start texting back." Replace candidates: "Your marketing is one text away." or "Marketing handled. While you run your business." The current headline ends the page on a weak note.

**3. Add a launch timeline to the post-signup success state (Priority: Medium)**
After completing the two-step form, tell users roughly when they can expect to hear from the product. Even "We're opening access to the first 500 businesses in May 2026" is better than open-ended silence. This improves waitlist completion quality.

**4. Rename the social proof section (Priority: Medium)**
Change "From the waitlist" to something that does not advertise the product is not live. Candidates: "What business owners told us" or "Early access conversations." Also vary the testimonial endings — not all three should close on "YES."

**5. Add open graph / social preview meta tags (Priority: Low-to-Medium)**
When someone shares this URL, the preview card should show the product name, tagline, and an image. Currently it renders blank. This is a five-minute technical fix that improves every inbound link.

---

## Overall Verdict

This page has cleared a genuine quality threshold. The copy is sharper than most competitor landing pages for AI tools. The design is distinctive. The interactive demo is the standout element and shows real care.

But it has hovered around 7.0 for three consecutive audits. The reason is not polish — it is structural. The hero has no visual. The proof section undermines itself with its own label. The CTA close is weak. These are not cosmetic problems; they are conversion mechanics. Until they are addressed, this page will continue to inform visitors competently without compelling them decisively.

**Score: 7.1 / 10**
