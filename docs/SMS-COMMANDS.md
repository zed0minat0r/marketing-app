# Sidekick SMS Command Guide

Text Sidekick at your Twilio number to manage your social media marketing. No app required.

---

## Quick Reference

| What you want to do | Example text |
|---------------------|--------------|
| Write a post | "Write a post about our weekend sale" |
| Schedule a post | "Schedule a post about happy hour for Friday at 5pm" |
| Connect Instagram | "Connect Instagram" |
| Connect Facebook | "Connect Facebook" |
| Connect Twitter / X | "Connect Twitter" |
| See your upcoming posts | "What do I have coming up?" |
| Cancel a scheduled post | "CANCEL 2" |
| Check your stats | "How did my posts do this week?" |
| Delete all your data | "Delete my data" |
| Get help | "Help" |

---

## Commands in Detail

### Write a Post

Ask Sidekick to draft a post in plain English. Be as specific or vague as you like.

**Examples:**
- "Write a post about our new lunch menu"
- "I need an Instagram caption for our summer sale — make it casual and fun"
- "Draft a Facebook post announcing we are hiring"

Sidekick will draft a post matching your configured tone and ask for approval before posting anything.

**Approval options** (reply with one of these after seeing a draft):

| Reply | What it does |
|-------|--------------|
| `YES` | Post it now to all connected platforms |
| `EDIT` | Ask Sidekick to revise the draft |
| `EDIT 1 make it shorter` | Structured edit with specific instruction |
| `LATER` | Tell Sidekick when to schedule it |
| `SKIP` | Cancel the draft |

**Example conversation:**

```
You:      Write a post about our Friday night specials
Sidekick: How about this:

          Friday nights just got better! Join us this Friday for
          our famous ribeye special + half-price apps all night.
          Book your table now! #FridayNight #FoodieLife #Specials

          Reply YES to post, EDIT to change, LATER to schedule,
          or SKIP to cancel.

You:      YES
Sidekick: Got it! Your post is queued for publishing to Instagram
          & Facebook. I will let you know when it is live.
```

---

### Schedule a Post

Ask Sidekick to write and schedule a post for a specific day and time.

**Examples:**
- "Schedule a post about our weekend brunch for Saturday at 10am"
- "Post something about our Monday deals tomorrow morning"
- "Schedule a reminder about our holiday hours for Dec 23rd at noon"

**Example conversation:**

```
You:      Schedule a post for Sunday at 11am reminding people we
          are open for brunch
Sidekick: Here is a draft for Sunday 11am:

          Sunday brunch is ON! Come enjoy mimosas & our full brunch
          menu today until 3pm. Walk-ins welcome! #SundayBrunch
          #BrunchVibes

          Reply YES to schedule for Sun 11am, EDIT to change, or
          SKIP to cancel.

You:      YES
Sidekick: Scheduled for Sunday, Apr 12 at 11:00am! I will post it
          automatically and let you know when it goes live.
```

---

### Connect Social Platforms

Link your social accounts so Sidekick can publish on your behalf.

**Commands:**
- "Connect Instagram"
- "Connect Facebook"
- "Connect Twitter"

Sidekick will send you a one-time secure link. Open it in your browser to authorize Sidekick. The link expires in 15 minutes.

**Example conversation:**

```
You:      Connect Instagram
Sidekick: Here is your secure Instagram connection link (expires in
          15 minutes):

          https://sidekick.app/api/oauth/meta/start?token=abc123

          Open this link to connect your account.

You:      [opens link, authorizes in browser]
Sidekick: Instagram connected! I can now post to @yourbusiness
          automatically.
```

---

### Check Your Schedule

See what posts are coming up.

**Commands:**
- "What do I have coming up?"
- "Show my schedule"
- "LIST"

Sidekick shows up to 5 upcoming posts with time, platform, and a preview.

**Example:**

```
You:      What do I have coming up?
Sidekick: Upcoming posts:
          1. Fri Apr 10, 5:00pm - Friday nights just got better!... (instagram, facebook)
          2. Sun Apr 12, 11:00am - Sunday brunch is ON!... (instagram)

          Reply CANCEL 1 to remove.
```

---

### Cancel a Post

Remove a scheduled post before it goes live.

**Command:** `CANCEL [number]`

Use the number from your schedule list.

**Example:**

```
You:      CANCEL 1
Sidekick: Post canceled. 1 post remaining.
```

---

### Check Your Stats

Ask Sidekick how your recent content is performing.

**Examples:**
- "How did my posts do this week?"
- "What are my stats?"
- "Which post got the most likes?"

Sidekick pulls engagement data from your connected platforms and gives you a plain-English summary.

You also receive an automatic weekly summary every Monday with reach, engagement, and your top post.

**Example:**

```
You:      How did my posts do this week?
Sidekick: This week: 4 posts, 1,240 total reach, 87 engagements.
          Your best post was the Friday ribeye special — 42 likes.
          Reach is up 18% vs last week. Keep it up!
```

---

### Delete Your Data

Permanently delete your account and all associated data.

**Command:** "Delete my data"

This is irreversible. All your posts, conversation history, and connected accounts are removed immediately.

**Example:**

```
You:      Delete my data
Sidekick: Your account and all data have been permanently deleted.
          You can restart anytime by texting us again.
```

---

### Help

Get a reminder of what Sidekick can do.

**Commands:**
- "Help"
- "What can you do?"

---

## Plan Limits

| Plan | Monthly AI Generations | Price |
|------|----------------------|-------|
| Starter | 50 | $49/mo |
| Growth | 200 | $99/mo |
| Pro | Unlimited | $199/mo |

Each draft, revision, analytics summary, or AI response counts as one generation. Reply `UPGRADE` when prompted to increase your limit.

---

## Tips

- **Be specific.** "Write a post about our 20% off sale this Saturday only" gives better results than "Write a sale post."
- **Tell Sidekick your tone.** If you want a different style, text "Update my tone to bold" or just describe what you want: "Make it more casual."
- **Post timing.** If you say "Friday at 5pm," Sidekick uses Eastern Time by default. If you are in a different timezone, include it: "Friday at 5pm PT."
- **Multi-platform.** By default Sidekick posts to all connected platforms. You can specify: "Post this to Twitter only."
