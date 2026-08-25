# Meta App Review packet - Sidekick by Mo (App ID 26890596557296121)

Prepared 2026-08-25, ahead of Matt's beta-user-#1 walkthrough. The walkthrough IS the demo
recording. File the review within days of recording it.

## Pre-submission checklist

- [ ] Business Verification in Meta Business Manager (Settings > Business Info > Start
      Verification): legal name "Pennsylvania Technology Solutions LLC", business address,
      EIN letter (CP 575) as the document. Same packet Twilio got. Do this FIRST - review
      of business apps stalls without it.
- [ ] App settings complete: privacy policy URL, data deletion callback URL
      (https://marketing-app-navy.vercel.app/data-deletion-status.html), app icon 1024px,
      category (Business), contact email mmodica3@gmail.com.
- [ ] Webhooks subscribed (Page feed + Instagram comments) - needed to demo comment replies.
- [ ] Record the demo video (shot list below) BEFORE filling the forms.
- [ ] DECISION NEEDED: drop `business_management` from META_SCOPES before submitting?
      We list pages via /me/accounts, which `pages_show_list` covers. business_management
      triggers the strictest review track and we may not use anything it gates. Verify
      token-refresh + page listing still work for a tester account without it, then remove.

## Permissions and paste-ready justifications

Text below is written for the "Tell us how you'll use this permission" box. No em dashes
anywhere (house rule for outward-facing text).

### pages_show_list
> Sidekick is an SMS assistant that posts to a small business's own Facebook Page at the
> owner's request. After the owner logs in with Facebook, we call /me/accounts once to show
> the owner a list of their Pages so they can pick which Page Sidekick should manage. We
> store only the chosen Page's id and access token.

### pages_read_engagement
> Once a week Sidekick sends the business owner a text message summarizing how their own
> Page posts performed (reach, reactions, comments). We read engagement metrics for posts
> our app itself published on the owner's chosen Page. Data is shown only to that owner.

### pages_manage_posts
> The core feature: the owner texts Sidekick something like "post about our Friday
> special", approves the draft by replying YES, and Sidekick publishes the approved post to
> the owner's own Page via the Pages API. Every publish is explicitly approved by the owner
> by text message first. Nothing is posted without a YES.

### pages_manage_engagement
> When someone comments on a post Sidekick published on the owner's Page, Sidekick drafts a
> reply and texts it to the owner. If the owner replies YES, Sidekick posts that reply as
> the Page. Every reply is owner-approved before it is posted, and reply volume is capped
> per day.

### instagram_basic
> After the owner connects their Facebook Page, we read the Instagram Business account
> linked to that Page (id and username) so the owner can also publish to Instagram. We read
> only the account linked to their own Page.

### instagram_content_publish
> Same approval flow as Facebook: the owner requests a post by text, approves the draft
> with YES, and Sidekick publishes the approved image post to the owner's own Instagram
> Business account using the content publishing API.

### instagram_manage_comments
> When someone comments on a post Sidekick published to the owner's Instagram account,
> Sidekick drafts a reply, texts it to the owner for approval, and posts it only after the
> owner replies YES. Volume is capped per day.

### instagram_manage_insights
> Used for the same weekly text summary as the Facebook metrics: we read reach and
> engagement for posts our app published to the owner's own Instagram account, and report
> those numbers to that owner only.

### business_management (only if kept - see checklist)
> Used solely to enumerate the Pages and linked Instagram accounts the logged-in owner
> manages through a Business Manager, so multi-location owners can pick the right Page.
> We do not read or modify any other Business Manager assets.

## Demo video shot list (one continuous screen recording, ~4 minutes)

Record the phone screen (Messages app) and a browser side by side, or cut between them.
Narrate or caption each step with the permission it demonstrates.

1. Text "connect facebook" to Sidekick. Tap the link, complete the Facebook login dialog,
   show the permissions screen, tap Allow, show the success page. [login + pages_show_list]
2. Show the Page picker / confirmation text listing the connected Page and IG account.
   [pages_show_list, instagram_basic]
3. Text "post about our Friday pizza special with a photo". Show the draft arriving, reply
   YES, then open facebook.com and instagram.com and show the live posts.
   [pages_manage_posts, instagram_content_publish]
4. From a second account, comment on the new post. Show Sidekick texting the drafted
   reply, reply YES, show the reply live under the comment.
   [pages_manage_engagement, instagram_manage_comments, webhooks]
5. Show the weekly summary text with the metrics. If the real Monday job hasn't run, use
   the admin trigger to fire it during the recording.
   [pages_read_engagement, instagram_manage_insights]

## Known rejection traps

- Video shows the feature but not the PERMISSION: reviewers want to see the API result
  (the live post, the live reply), not just our UI. Shot list above ends every step on the
  Facebook/Instagram surface for this reason.
- Reviewer cannot reproduce: they log in with their own test user. Our flow needs an SMS
  number, which reviewers cannot text. Provide detailed reviewer instructions + the demo
  video, and state that SMS is the product surface; this is common for SMS-first apps and
  accepted when the video is complete.
- Privacy policy missing the data-deletion path: ours has it, double check the URL resolves
  on the live site at submission time.
- business_management requested but not demonstrated: strongest argument for dropping it.

## After approval

- Switch the app from Development to Live mode.
- Retire the tester-list requirement from onboarding docs.
- Migrate the Twilio opt-in evidence URL to sidekick.penntechsolutions.com if not already
  done (only after Twilio verification is approved).
