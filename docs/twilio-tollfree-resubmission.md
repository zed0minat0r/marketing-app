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
| EIN | on file (do not publish - this repo is public) |
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
1. ✅ EIN on file (2026-08-24)
2. ✅ Business contact email + phone confirmed
3. ✅ Volume tier confirmed (1,000/mo)
4. ✅ Live site verified 2026-08-24: entity name + opt-in checkbox present at the opt-in URL
5. ✅ `optin-proof.png` regenerated 2026-08-24 from the live site (in docs/)

---

## REJECTION HISTORY AND THE FIELD SHAPE THAT ACTUALLY WORKS

Three rejections. **Two of them were caused by the fix for the previous one**, so read this before
editing any field.

| # | date | reason | what it really was |
|---|---|---|---|
| 1 | 2026-06-04 | 30445 business not verified, 30513 opt-in | sole proprietor, no EIN; opt-in "proof" was just the homepage URL |
| 2 | 2026-08-24 | 30527 / 1112 registration number missing or invalid | recorded at the time as a "snapshot race" from splitting the POST. **That diagnosis was wrong** - see #3 |
| 3 | 2026-08-25 | DBA name must be accurately provided | reviewer saw Sidekick branding against a bare LLC name |
| 4 | 2026-08-26 | 1112 registration number missing or invalid | **caused by the fix for #3**: "DBA Sidekick" was appended to BusinessName, which broke the character-for-character match against the IRS record for the EIN |

### The correct shape - do not deviate

```
BusinessName                 = Pennsylvania Technology Solutions LLC     <- EXACT CP-575 name. Never append anything.
DoingBusinessAs              = Sidekick                                  <- the DBA goes HERE, in its own field
BusinessRegistrationNumber   = 424671570                                 <- EIN, 9 digits, NO hyphen
BusinessRegistrationAuthority= EIN
BusinessRegistrationCountry  = US
BusinessType                 = PRIVATE_PROFIT
```
The registration fields are required as a set for any BusinessType other than SOLE_PROPRIETOR.
Send the whole record in **ONE POST** - review can begin within two minutes of a save.

### Twilio's own listed causes of 1112 (from the 30527 error doc)
1. legal name does not exactly match the name on the registration record
2. registration number invalid for the authority/region
3. a trade name/DBA submitted as the primary business name instead of using `DoingBusinessAs`
4. **the EIN was recently issued and is not yet verifiable - a new EIN can take up to two weeks to
   pass IRS TIN matching**

Causes 1 and 3 were ours and are fixed. **Cause 4 is not fixable by editing** - this EIN was issued
2026-08-24. If a correctly-formed submission is rejected again for 1112, the answer is to WAIT, not
to start rewriting fields that are already right.

### Evidence corrected 2026-08-26
The opt-in proof screenshot led with "A PRODUCT OF PENN TECH SOLUTIONS" - a third name, matching
neither the IRS record nor the DBA - because the final-CTA block on the live page said so. Both the
final-CTA line and the nav byline now carry the full legal name, and `optin-proof.png` was recaptured
from the corrected page (verified live, byte-identical to the repo copy). The old shot also showed a
"Start free trial" button that the honesty sweep had already replaced.

---

**SUBMITTED 2026-08-24 via API** (verification SID HH782bef18c1f78a90f72916ed6c6cf58a,
status back to PENDING_REVIEW). What was fixed vs the June submission: business name was
"Matthew Modica" as SOLE_PROPRIETOR → now Pennsylvania Technology Solutions LLC as
PRIVATE_PROFIT with the EIN in the dedicated registration fields (US/EIN); the
"opt-in image" was just the homepage URL → now a real screenshot of the consent step at
https://zed0minat0r.github.io/marketing-app/docs/optin-proof.png; contact phone corrected to
(267) 416-5810; entity/EIN details and the full opt-in workflow are also in
AdditionalInformation. Status notifications go to mmodica3@gmail.com.
