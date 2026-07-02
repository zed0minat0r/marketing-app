# Twilio Toll-Free Verification — Resubmission Packet

Prepared 2026-07-02. Paste-ready for the Twilio Console toll-free verification form.
Original submission REJECTED 2026-06-04 — reasons **30445** (business could not be verified) and **30513** (opt-in consent). Both addressed below.

---

## 1. Business Information

| Field | Value |
|---|---|
| Legal business name | **Pennsylvania Technology Solutions LLC** *(exact PA state record — do NOT use "Penn Tech Solutions")* |
| Business type | Limited Liability Company (LLC) |
| Business industry | Professional / Technology services (marketing software) |
| Business registration ID type | USA: Employer Identification Number (EIN) |
| EIN | ⏳ **PENDING — Matt retrieving from IRS CP-575 tonight** |
| Business registration state | Pennsylvania (Entity/File # 0015198406, filed 2026-02-08) |
| Business website | https://zed0minat0r.github.io/marketing-app/ |
| Business address | 576 Bridge St, Phoenixville, PA 19460-3343, USA |
| Business regions of operation | USA & Canada |

### Authorized business contact
| Field | Value |
|---|---|
| First / Last name | Matthew Modica |
| Email | mmodica3@gmail.com ✅ confirmed |
| Phone | (267) 416-5810 ✅ confirmed |

**Notification email (status updates):** mmodica3@gmail.com

---

## 2. Number
- Toll-free number under verification: **+1 855 613 0627**

---

## 3. Use Case

**Use case category:** Mixed — Account Notifications + Conversational/Marketing

**Use case summary:**
> Sidekick (a product of Pennsylvania Technology Solutions LLC) is a text-first marketing assistant for small-business owners. A customer opts in on our website, then texts our number directly from their own phone to generate marketing content — social posts, ad copy, images, review replies. We reply with the generated content for their approval. We also send account, onboarding, and early-access/waitlist notifications. All traffic is US small-business owners who explicitly opted in via the web form. One shared toll-free number serves the whole product; routing is by the sender's phone number.

---

## 4. Opt-In (addresses reject reason 30513)

**Opt-in type:** Web form (online sign-up)

**Opt-in URL:** https://zed0minat0r.github.io/marketing-app/ (final CTA / sign-up section)

**Opt-in workflow:**
> User enters their email, then their phone number, then must actively check an **unchecked** SMS consent checkbox before the form will submit. Submission is blocked until the box is checked. Privacy Policy and Terms of Service are linked directly beside the checkbox.

**Exact consent language shown at opt-in (on the checkbox):**
> "I agree to receive recurring SMS messages from Sidekick about my account, onboarding, and waitlist updates. Msg frequency varies. Msg & data rates may apply. Reply STOP to opt out, HELP for help."

**Opt-in evidence:** screenshot `optin-proof.png` (signup form showing the unchecked checkbox + consent language + Privacy/Terms links).

---

## 5. Sample Messages (each includes opt-out language)

1. **Onboarding/account:**
   > "Welcome to Sidekick! Text your business name to get started. Msg & data rates may apply. Msg frequency varies. Reply STOP to opt out, HELP for help."

2. **Product / conversational reply:**
   > "Here's your weekend-sale Facebook post: '☀️ Summer blowout — 20% off all services this Sat & Sun! Book now.' Reply POST to publish or EDIT to tweak. Reply STOP to opt out."

3. **Waitlist / early-access:**
   > "Your Sidekick early-access spot is open! Text START to activate your account. Reply STOP to opt out, HELP for help."

---

## 6. Volume
- **Estimated monthly message volume:** 1,000 / month ✅ confirmed (lowest tier for pre-launch; raise later as usage grows).

---

## 7. Opt-out / HELP handling
- STOP / STOPALL / UNSUBSCRIBE / CANCEL / END / QUIT → immediate opt-out + confirmation (handled by carrier + app).
- HELP / INFO → returns help text with business name + support contact.
- All production messages include "Reply STOP to opt out, HELP for help."

---

## Remaining before submit
1. ⏳ **EIN** (Matt — tonight)
2. ❓ Confirm business contact email + phone
3. ❓ Confirm estimated monthly volume tier
4. Push corrected site live so the reviewer sees the entity name + opt-in checkbox at the live URL
5. Attach `optin-proof.png` as opt-in evidence
