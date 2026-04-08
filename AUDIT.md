# AUDIT — TextMarketer Landing Page
**Auditor:** Nigel  
**Date:** 2026-04-07  
**Score:** 6.4 / 10  
**Previous Score:** 6.8  
**Live URL:** https://zed0minat0r.github.io/marketing-app/

---

## Score Rationale

The score drops from 6.8 to 6.4. The bones are solid — the concept is clear, the copy is the strongest part of this page, and the interactive demo is a genuine differentiator. But the page has become a competent execution of a familiar template rather than a distinctive product. It reads as "a dark SaaS landing page" rather than as TextMarketer specifically. The visual identity is not yet ownable. Real small business owners — a florist, a plumber, a salon owner — need to feel immediately that this was made for them. This page feels built for a YC founder audience, not for Maria who runs a flower shop in Phoenix.

---

## Section Scores

| Section | Score | Notes |
|---|---|---|
| Hero | 6.5 | Good headline. Static preview is decorative, not functional. |
| Demo | 7.8 | Strongest section. Genuinely useful, interactive, believable. |
| How It Works | 7.2 | Clear and honest. Step copy is specific and good. |
| Features Grid | 5.8 | Generic grid. Icons say nothing. Titles are category names, not benefits. |
| Comparison Table | 6.0 | Reads as self-serving. Every competitor gets all X's. Suspicious. |
| Social Proof | 6.2 | Good instinct. Copy is plausible. But "Closed beta participant" without names/photos kills credibility. |
| Pricing | 6.8 | Clean. Pricing context ("Less than your cheapest employee") is good framing. Generation limits feel arbitrary. |
| FAQ | 7.5 | Honest, specific, well-written. Best FAQ on any page in this category. |
| Final CTA | 6.0 | Functional but hollow. The form just pretends to submit — no real action occurs. |
| Visual Identity | 5.5 | Dark + orange + mono font = 100 other SaaS pages. Not distinctive. |

---

## What Works

**Copy quality is above average.** The hero headline "Your marketing team lives in your texts" is clean and specific. Step 3's "Reply YES to post. Reply EDIT to change it. Reply SKIP to move on." is excellent product communication — concrete, immediate, and believable. The FAQ answers are unusually honest.

**The interactive demo earns its keep.** The four chat flows (posts, stats, ad, audit) are realistic, specific enough to be convincing, and the typing-dot animation adds enough texture without being overdone. This is the page's strongest section and should be higher up or more prominent.

**The concept is genuinely differentiated.** "No app, no dashboard, no login" is a real claim, not a marketing platitude. The comparison table's premise — every competitor still needs a dashboard — is valid and potentially persuasive.

**Pricing framing is smart.** "Less than your cheapest employee" anchors expectations correctly for a small business owner who's used to thinking in salary terms, not SaaS subscription terms.

---

## What Doesn't Work

### 1. Visual identity is anonymous
Orange on dark is not distinctive. JetBrains Mono + DM Sans is technically fine but completely generic for a 2026 SaaS page. There is nothing visual here that says "TextMarketer" rather than "a landing page made by Claude." The page could be for a dev tool, a CRM, a payroll app, or a marketing product — you cannot tell from the aesthetics alone. The rules specifically prohibit looking AI-generated. This page looks AI-generated.

### 2. The hero preview widget does nothing
The static chat preview above the fold is decorative. It shows a single exchange — "Good morning! Here are Monday's 3 posts for Bloom & Co." — but does not react, animate, or demonstrate anything. It takes up 200px of prime real estate to be a screenshot. Either animate it or remove it and let the demo section do the work.

### 3. Social proof is not credible
Three quotes attributed to "Florist, Phoenix AZ", "Plumber, Chicago IL", and "Salon owner, Atlanta GA" — no names, no photos, no business names, no social links. The disclaimer "Paraphrased from beta conversations" makes this feel legally cautious rather than proud. A real small business owner will read this and wonder why there are no real names. The quotes themselves are believable — the attribution is what collapses them.

### 4. The comparison table is too self-serving
Every single competitor gets all five X's including "No hidden fees." Klaviyo and SimpleTexting both have transparent monthly pricing — claiming they have hidden fees is a stretch and damages credibility. A smarter move would be to give competitors honest checks where they deserve them (e.g., Klaviyo has analytics) and differentiate only where TextMarketer genuinely wins.

### 5. The signup form is a facade
Submitting a phone number produces a fake "Done — we just texted you" message after an 800ms setTimeout. A small business owner who tries this and never receives a text will never return. This is the single highest-risk element on the page. Either connect it to a real backend, or replace the form with a Waitlist/Notify flow that is honest about early access status.

### 6. The "// pro" plan at $199/mo includes "Website building & fixes"
This is a significant promise — implementing website changes via text. It's listed as a feature bullet but is almost impossible to deliver reliably and is not explained anywhere in the FAQ. A skeptical user will catch this and wonder what else is oversold.

### 7. Features grid uses category names, not benefits
"Social Media Posts", "Ad Copy & Strategy", "Website Audit" — these are category labels, not reasons to care. Every competitor could claim the same headings. The step copy is specific ("A florist gets warm and seasonal, a plumber gets direct and local") but the features grid loses that specificity entirely.

### 8. 80+ businesses in closed beta — unverifiable and small
The final CTA trust line reads "80+ businesses in closed beta." For a product claiming to post to "1,200 locals" and claiming 1,247 impressions per week per user — 80 beta users is not a confidence-building number. Either remove the count or replace with a more impressive signal if it exists.

---

## Prioritised Recommendations

### Priority 1 — Fix the signup form immediately
Connect to a real backend (Twilio for SMS, or at minimum a Mailchimp/Airtable waitlist). The current fake submission is a trust bomb. Every person who enters their number and receives nothing is permanently lost. If the backend isn't ready, change the CTA to "Join the waitlist" and confirm by email. Do not simulate success you cannot deliver.

### Priority 2 — Rebuild social proof with real attribution
Get at least one beta user to go on record with their first name, business name, and photo. Even "Sarah, Bloom Florals, Phoenix AZ" with a real Instagram handle is infinitely more credible than "Florist, Phoenix AZ." Consider replacing one quote card with a screenshot of an actual text conversation with a real beta user (with permission). That would be worth more than all three current quotes combined.

### Priority 3 — Give the page a visual identity that no other product has
This means making a deliberate creative choice: a typeface that is unusual, a colour that is not dark-plus-orange, a layout grid that does not follow the standard SaaS template (hero, demo, features, compare, testimonials, pricing, FAQ, CTA). Study what Lemon Squeezy, Rows, or Linear actually look like — not just their feature set. The goal is a page that looks like a product, not a template.

### Priority 4 — Replace the static hero preview with animation or remove it
The Bloom & Co. preview at the top is inert. If it cannot be animated to simulate a live conversation, remove it and move the CTAs closer to the headline. The interactive demo further down the page is doing the job already — the hero doesn't need a redundant decorative element.

### Priority 5 — Audit the comparison table for honesty
Remove or soften the "No hidden fees" row for competitors with public transparent pricing. Add one row where a competitor genuinely wins (e.g., "Years in market" or "API access") and acknowledge it. This makes the table more credible and the wins feel harder-earned.

### Priority 6 — Rewrite features grid to use outcome-first copy
Replace "Social Media Posts" with "3 posts per platform, approved by you, published automatically." Replace "Ad Copy & Strategy" with "Facebook and Google ads in 30 seconds, from a text." Stop naming categories — describe what changes in the business owner's week.

---

## Minor Issues

- The `compare__note` cites sources as "Capterra, G2, Emitrr, EmailToolTester — April 2026" for pricing data. This is fine but the font is 0.72rem and nearly invisible. No user will read it.
- Footer email `hello@textmarketer.io` will 404 or bounce — either remove or set up email forwarding before launch.
- The `// starter`, `// growth`, `// pro` naming with comment-syntax is clever but may confuse non-technical users who are the primary audience. A florist in Phoenix does not parse `//` as "label."
- "Cancel by text" is a strong differentiator — it should appear in the hero or high in the page, not buried in the final-CTA trust line.

---

## Summary

The page is competent and the product concept is strong. Copy quality is higher than average. The demo is genuinely impressive. But the visual identity is anonymous, the social proof lacks credibility, and the signup form is fraudulent in effect if not in intent. Fix the backend first, then the credibility layer, then the visual distinctiveness. With those three things addressed, this page could credibly reach 7.5+.
