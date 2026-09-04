# Meta App Review — demo video, shot by shot

One continuous screen recording, about four minutes. Read this while you record; every line you need
to type is written out below.

**THE RULE THAT DECIDES PASS OR FAIL.** Reviewers reject videos that show the app doing something but
never show the result on Meta's own surface. It is listed in our own rejection traps as "video shows
the feature but not the PERMISSION". So every shot below ends on facebook.com or instagram.com with
the real post, the real comment, or the real reply on screen. Do not skip those tails to save time -
they are the only part the reviewer is actually assessing.

## Before you press record

- [ ] Phone screen mirrored to the Mac (QuickTime > File > New Movie Recording > select iPhone), so
      the texts and the browser are in one recording.
- [ ] Logged into facebook.com and instagram.com in a browser, on the Page you will connect.
- [ ] A SECOND account ready on your phone or another browser - you need it to leave a comment in
      shot 4. A reviewer will not accept you commenting as yourself.
- [ ] A photo in your camera roll to text in.
- [ ] Your test business already deleted from the database, so onboarding starts clean. Text RESET
      first if it does not.
- [ ] Sound on. Narrate, or add captions afterwards. Silent video with no explanation gets rejected.

## Shot 1 — sign up and connect  [pages_show_list, instagram_basic]

Say: "Sidekick has no app and no dashboard. A business owner texts a number and that is the whole
product. I am a new customer signing up now."

1. Text your Sidekick number: **hi**
2. Show the onboarding replies arriving. Answer them as they come.
3. When it asks to connect, text: **connect facebook**
4. Tap the link in the text. Show the Facebook consent screen **with the permission list visible** -
   pause here, this frame is what the reviewer is looking for.
5. Tap Allow. Show the success page, then the confirmation text naming the Page and Instagram account.

## Shot 2 — publish to Facebook and Instagram  [pages_manage_posts, instagram_content_publish]

Say: "The owner asks for a post in plain English. Nothing publishes without their explicit approval."

1. Text: **post about our Friday pizza special**
2. Show the draft arriving as a text.
3. Text: **YES**
4. Show the confirmation text.
5. **Switch to the browser. Open the Facebook Page and show the live post. Then open Instagram and
   show the live post.** Scroll so the timestamps are visible.

## Shot 3 — photo to post  [instagram_content_publish]

Say: "They can also just text a photo."

1. Text a photo with no caption.
2. Show the drafted caption arriving, reply **YES**.
3. **Show it live on Instagram.**

## Shot 4 — comment replies  [pages_manage_engagement, instagram_manage_comments, webhooks]

Say: "When a customer comments, Sidekick drafts a reply and the owner approves it by text. Every
reply is owner-approved before it posts."

1. From your SECOND account, leave a comment on the post from shot 2.
2. Show the text arriving with the drafted reply.
3. Text: **YES**
4. **Show the reply live under the comment, posted as the Page.**

## Shot 5 — the weekly report  [pages_read_engagement, instagram_manage_insights]

Say: "Once a week the owner gets their numbers by text. Nothing is shown to anyone but them."

1. Trigger the weekly summary from the admin page if Monday's job has not run.
2. Show the summary text with real reach and engagement numbers.
3. Say out loud that these are metrics for posts this app published, on the owner's own accounts.

## Shot 6 — opting out

Say: "Every message carries opt-out, and STOP works immediately."

1. Text: **STOP**
2. Show the confirmation.
3. Text: **START** to undo it, so your test account still works afterwards.

## Reviewer instructions — paste this into the submission

> Sidekick is an SMS product: the business owner's phone number IS their account, and there is no
> app or dashboard to log into. A reviewer cannot reproduce the flow by signing in, because the
> product surface is text messaging and our number only accepts messages from registered owners.
>
> The attached video shows the complete flow end to end on a real business account, including the
> Facebook consent dialog, the live posts on both platforms, a real comment and the approved reply
> beneath it, and the weekly metrics summary.
>
> Every publish and every reply is explicitly approved by the owner by replying YES to a text
> message first. Nothing is posted automatically. Reply volume is capped per day.
>
> If you require access to a test environment instead, we will add your reviewer account as a tester
> on the app and provide a phone number that is registered to a test business.

## After you record

Watch it once and check every one of these, because each is a documented rejection reason:

- [ ] The Facebook consent screen with the permission list is clearly visible in shot 1.
- [ ] Every publish is followed by the live post on facebook.com or instagram.com.
- [ ] The comment reply is shown live under the comment, not just as a text message.
- [ ] A YES approval is visible before every single publish and reply.
- [ ] Nothing on screen shows a permission you did not request. `business_management` was removed on
      2026-09-04, so it must not appear in the consent dialog. If it does, stop - the deployed build
      is stale.
