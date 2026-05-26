# Meta App Review — Sidekick

Copy-paste materials for the App Review submission at
**developers.facebook.com → My Apps → Sidekick → App Review → Permissions and Features**.

Submit all 5 Advanced permissions in a single batch — Meta reviews them together
when they share a demo recording, which shortens turnaround.

---

## App-level context (for the "App Details" section)

**What does your app do?**
Sidekick is an SMS-based marketing assistant for small business owners (painters,
electricians, restaurants, salons, small retail). Users text in updates about
their business — "just finished a kitchen", "new Friday special is $3 slices" — and
Sidekick drafts on-brand social posts, publishes them to the user's connected
Facebook Page and Instagram Business account, and tracks how each one performed.
Everything is conversational over SMS — there is no customer-facing dashboard.
The Facebook integration is what enables the publishing and analytics steps.

**How does Facebook Login work in your app?**
A user starts onboarding by texting our number. After a few setup questions
(business name, type, tone), Sidekick texts them a one-time URL that launches
the standard Facebook Login dialog. After granting permissions, the user is
redirected back and receives an SMS confirmation. From then on, Sidekick uses
the granted tokens to read, publish, and measure on their behalf — initiated by
their SMS commands ("write a post about our weekend hours", "how did Friday's
post do?").

---

## Per-permission use-case statements

For each scope below, paste the **"How will your app use this permission?"** and
**"Tell us how a person using your app will see this permission in action"**
sections into the corresponding Meta form.

---

### 1. `pages_show_list` (usually approved automatically — Standard tier)

**How will your app use this permission?**
After a user completes Facebook Login, Sidekick calls `GET /me/accounts` once
to discover which Facebook Pages they administer. We list those Pages back to
the user via SMS so they can confirm which Page they want Sidekick to manage.
We persist the chosen Page's ID and display name to scope subsequent
publishing and analytics calls to that single Page.

**User flow**
1. User texts "Connect Facebook" (or completes onboarding step 4).
2. User taps the OAuth link and authorizes Sidekick.
3. Sidekick fetches their Page list with `pages_show_list`.
4. Sidekick texts back: "Connected to Mike's Pizza Page (and IG: @mikespizza)."

---

### 2. `pages_read_engagement` (Advanced — review required)

**How will your app use this permission?**
Sidekick uses this scope to read post-level engagement metrics for posts that
Sidekick itself published on the user's behalf. The user requests these
metrics via SMS commands like "how did my last post do?" or as part of the
auto-sent weekly summary text every Monday morning. We read `insights/edges`
(reactions, comments, shares, impressions, reach) for each Page post and
return a short summary in SMS form. We never read metrics for posts the user
created outside of Sidekick.

**User flow**
1. User texts "how did last Friday's post do?"
2. Sidekick calls `GET /{page-post-id}/insights` with `pages_read_engagement`.
3. Sidekick texts a summary: "Friday's pizza special — 1,247 impressions, 47
   reactions, 8 comments, 12 shares. Up 34% vs last week."

---

### 3. `pages_manage_posts` (Advanced — review required)

**How will your app use this permission?**
This is the core publishing scope. After a user drafts a post via SMS and
approves it by texting "YES", Sidekick publishes the post to their Facebook
Page using `POST /{page-id}/feed` (or `/photos` when a photo from their
library is attached). Every publish is initiated by an explicit user
approval — Sidekick never publishes unattended unless the user has explicitly
opted into "Autopilot" mode (a separate per-user setting). The user can also
schedule a post for a future time, and Sidekick uses the same scope to publish
at the scheduled moment.

**User flow**
1. User texts "write a post about Friday slices being $3 tonight".
2. Sidekick texts back a draft.
3. User replies "YES" to approve.
4. Sidekick publishes via `POST /{page-id}/feed` and texts a link to the live
   post: "Published to Facebook: https://facebook.com/..."

---

### 4. `instagram_basic` (Standard, but often grouped with Advanced batch)

**How will your app use this permission?**
After Facebook OAuth, Sidekick uses `pages_show_list` to find Pages, then
reads each Page's `instagram_business_account` edge with `instagram_basic` to
identify any connected Instagram Business or Creator account. We persist the
IG account ID and username so subsequent SMS commands can target Instagram
alongside Facebook.

**User flow**
Same OAuth flow as #1. After connect, Sidekick confirms over SMS: "Connected:
Mike's Pizza FB Page + @mikespizza on Instagram."

---

### 5. `instagram_content_publish` (Advanced — review required)

**How will your app use this permission?**
The Instagram counterpart to `pages_manage_posts`. When the user approves a
draft via SMS, Sidekick publishes the content natively to their Instagram
Business account using the standard two-step container flow: `POST
/{ig-user-id}/media` to create a container with the image (from the user's
own photo library — they MMS photos to our number to stock the library), then
`POST /{ig-user-id}/media_publish` to publish it. Captions are tuned to IG
format (longer-form, hashtag-friendly) vs the Facebook version of the same
post. Same explicit-approval model as Facebook publishing — no silent
posting unless the user has opted into Autopilot.

**User flow**
1. User texts a photo of their finished kitchen + "first post about this
   one".
2. Sidekick saves the photo to the user's library, drafts an Instagram
   caption, texts the draft.
3. User replies "YES" to approve.
4. Sidekick publishes to IG via the two-step container API. Texts back the
   live link.

---

### 6. `instagram_manage_insights` (Advanced — review required)

**How will your app use this permission?**
Parallel to `pages_read_engagement` but for the user's Instagram posts that
Sidekick published. Same on-demand "how did this do?" SMS and the auto-sent
Monday weekly summary include IG-specific metrics: impressions, reach, saves,
profile visits. Sidekick calls `GET /{ig-media-id}/insights` for each post we
published. We never read metrics for posts the user created outside Sidekick.

**User flow**
1. User texts "what did my IG posts do this week?" (or it lands automatically
   in the weekly Monday summary).
2. Sidekick aggregates per-post insights via `instagram_manage_insights`.
3. Sidekick texts a summary: "This week on IG — 3 posts, 4,820 impressions,
   312 saves, +23 followers. Top post: Friday slice special (1,250 reach)."

---

### 7. `business_management` (Advanced — review required)

**How will your app use this permission?**
Required because many of our target users (small business owners) connect via
Pages owned by a Meta Business Account rather than their personal account. We
use this scope strictly to enumerate the user's business assets at OAuth time
so we can correctly find the Page and Instagram Business account that should
be linked to the Sidekick account. No business-level configuration is changed
by Sidekick — read-only enumeration on connect, then never used again.

**User flow**
Invisible to the user — happens during the OAuth callback. Without this
scope, business-owned Pages return zero results from `me/accounts`. With it,
Sidekick can find and confirm the user's actual Page.

---

## Demo screen recording — shot list

Meta requires a single video that demonstrates every requested permission.
**Length: 2-3 minutes max.** Quality matters more than length — show each
permission being used clearly, and narrate what's happening.

**Setup before recording:**
- Add your personal Facebook account as a Tester (Roles → Testers → invite).
- Make sure you have at least one Facebook Page you admin, with a connected
  Instagram Business account.
- Have a phone ready that can text the Sidekick number.
- Have a screen recorder running on both your phone (for the SMS view) and
  your laptop (for the OAuth flow + Facebook posts appearing).

**Shot 1 — onboarding flow (0:00-0:30)**
- Phone screen: text "hi" to the Sidekick number.
- Show the back-and-forth: business name → business type → tone.
- After tone, Sidekick texts a Facebook OAuth link.
- *Narration*: "A small business owner — let's call her Mike at Mike's Pizza —
  onboards entirely over SMS. After three quick questions, Sidekick sends a
  link to connect her Facebook Page and Instagram together."

**Shot 2 — OAuth grant (0:30-1:00)**
- Tap the OAuth link in iMessage.
- Show Facebook Login dialog clearly. Pause on the permission grant screen —
  Meta wants to see the dialog showing the permissions being requested.
- Approve.
- See the success page + SMS confirmation arrive on the phone.
- *Narration*: "Standard Facebook Login. Mike grants Sidekick access to
  publish, read engagement, and manage her business — all the scopes shown.
  After approving, she's redirected back and gets a confirmation text."

**Shot 3 — photo library + post drafting (1:00-1:45)**
- Phone screen: Sidekick texts "Now send 3-5 photos of your work."
- Mike texts in a photo of a pizza.
- Sidekick confirms.
- Mike texts: "first post — let everyone know we have $3 slices tonight."
- Sidekick texts back a draft caption.
- *Narration*: "Mike sends photos to the same SMS thread to stock her photo
  library — they're stored and tagged automatically. Then she asks Sidekick
  to write a post. Sidekick drafts the caption in Mike's voice."

**Shot 4 — approval + publishing (`pages_manage_posts` + `instagram_content_publish`) (1:45-2:15)**
- Mike replies "YES" to approve.
- Sidekick texts "Publishing now."
- Cut to laptop: show the post appearing on the actual Facebook Page.
- Cut to phone: show the post appearing on Instagram.
- Phone: Sidekick texts back the live post links.
- *Narration*: "Mike approves with a single YES, and Sidekick publishes
  natively to both Facebook and Instagram using `pages_manage_posts` and
  `instagram_content_publish`. The published links come right back via SMS."

**Shot 5 — analytics (`pages_read_engagement` + `instagram_manage_insights`) (2:15-2:45)**
- Mike texts: "how did Friday's post do?"
- Sidekick texts back the metrics summary (FB + IG numbers).
- *Narration*: "Anytime Mike wants to know how a post performed, she just
  asks. Sidekick reads engagement insights from both platforms and texts back
  a plain-language summary."

**Shot 6 — wrap (2:45-3:00)**
- Show Mike's actual Facebook Page in the browser with the post visible, and
  the Instagram post visible side-by-side.
- *Narration*: "Every permission Sidekick requests serves one of these flows —
  publishing posts the user explicitly approved over SMS, and reading
  engagement so the user can know what's working. There are no other surfaces
  in the product, no dashboard, no batch operations. It's just SMS."

---

## Required Meta App Dashboard URLs

In addition to the OAuth redirect URI, Meta App Review requires these two
URLs in **Settings → Basic**:

| Field | Value |
|-------|-------|
| Data Deletion Request URL | `https://sidekik.com/api/oauth/meta/data-deletion` |
| Privacy Policy URL | `https://sidekik.com/#privacy` |
| Terms of Service URL | `https://sidekik.com/#terms` |
| App Domains | `sidekik.com` |

The data-deletion endpoint is wired up in
`lib/oauth-handlers/meta-data-deletion.js`. It verifies Meta's signed_request
against `META_APP_SECRET`, marks any Facebook/Instagram social_accounts rows
for the matched FB user_id as inactive, and returns the
`{ url, confirmation_code }` JSON that Meta expects. Without this URL in the
dashboard, App Review will be rejected.

---

## Submission tips

1. **Submit all permissions in one batch.** Each one points to a different
   timestamp in the same demo video. Meta processes batched submissions faster
   than 7 separate ones.

2. **Business verification first.** None of the Advanced permissions can be
   approved without business verification (`Settings → Basic → verify
   business`). Plan ~1 week for that step alone.

3. **Test with your own account first.** Confirm the full OAuth + post +
   read flow works end-to-end while in Development mode (you'll need to be
   added as a Tester) before recording the demo video. The video should be a
   real working flow, not mocked.

4. **Don't mention "AI" or "automated posting" in your justifications.** Meta
   has historically been skittish about "AI automation" framing. Always frame
   as "user-initiated, user-approved" — which is true for Sidekick's
   non-Autopilot default mode. (For Autopilot users, mention that opt-in
   is explicit and revocable at any time.)

5. **If a permission is rejected**, the rejection email will tell you which
   part of the use case Meta thinks doesn't fit. Adjust the writeup and
   resubmit — most apps need 1-2 review rounds.

---

## After approval

Once all 5 Advanced permissions are approved:

1. Flip the app to **Live mode** in App Settings.
2. The OAuth flow then works for any user, not just Testers.
3. Bump the Graph API version in code from `v19.0` to `v21.0` (5 files —
   each oauth-handler in `lib/oauth-handlers/`). Confirmed with Matt before
   shipping.
4. Remove the development-mode banner from `/connected` page if any exists.
