# Feature Spec — Logo Redesign via Text (MMS)

**Goal:** A user texts their existing logo to Sidekick; we return 2–3 reworked/cleaned-up logo options they can approve — all over SMS, no app.

**Why it's a strong selling point:** it's a visible, "wow" transformation of something the business already owns, and it slots into the customization story (their brand, their voice, their look).

---

## Honest capability note
Claude (Anthropic) models generate **text, not images**. So Claude's role is the *art director / analyst*, and a separate **image-generation/editing model** does the pixels. Don't promise "Claude redesigns your logo" literally — the pipeline is Claude-directed, image-model-rendered.

---

## Pipeline (per redesign request)

1. **Intake (already built).** User texts the logo as MMS → existing `lib/photo-intake.js` / `photo-tagger.js` accept and store it (Supabase Storage). Detect "this is a logo" via a new intent (`REDESIGN_LOGO`) or a photo-caption keyword ("redesign my logo", "clean up my logo").
2. **Analyze (Claude, vision).** Send the image to Claude with a vision prompt → structured JSON art-direction brief: detected colors (hex), typography style, icon/wordmark description, issues (low-res, dated, cluttered), and 2–3 distinct redesign directions (e.g. "modern minimal", "bold retro", "clean wordmark"). Reuse the user's `voice_notes` / brand context so directions fit their vibe.
3. **Render (image model).** For each direction, call an image-generation/editing API with a prompt built from Claude's brief. Options to evaluate:
   - Logo/vector-oriented model or a general diffusion API with strong text/typography handling.
   - Image-**edit** mode (feed the original + instruction) for "clean up / modernize" vs full regeneration for "reimagine".
   - Constraint: logos need legible text + transparent background + crisp edges → prefer a model with typography competence + SVG/transparent-PNG output; otherwise post-process (background removal, upscale).
4. **Deliver.** Text back 2–3 rendered options as MMS with "Reply 1, 2, or 3 to keep — or EDIT to tweak." Store options; on approval, save to their brand kit (future: watermark generated posts with it).

---

## New pieces to build
- **Intent:** `REDESIGN_LOGO` in `lib/intent.js` + dispatch in `api/sms/inbound.js`.
- **Vision brief:** a `generateLogoBrief(user, imageUrl)` in `lib/claude.js` (vision message → JSON art direction).
- **Image adapter:** `lib/image-gen.js` wrapping the chosen image API (keep provider swappable behind one interface).
- **MMS out:** reuse the outbound MMS path used for photo posts to attach rendered options.
- **Schema:** `logo_redesigns` table (user_id, source_image, options[], chosen, status) or reuse the photo/asset tables.
- **Cost guardrail:** image gen is $-per-render — gate behind plan/quota (extend `lib/cost-guardrails.js`), cap options at 3, and count a redesign against a monthly allowance.

## Phasing
- **v1 (MVP):** logo in → Claude brief → one image model → 2 options back → approve. Manual quality bar.
- **v2:** "EDIT" loop (tweak a chosen option), transparent-PNG + upscale post-processing, save to brand kit.
- **v3:** auto-apply the approved logo as a watermark on generated image posts.

## Open decisions (need Matt's input)
- Which image model/API (budget + typography quality + edit-vs-generate). This is the gating choice.
- Pricing: bundle a few redesigns/month per plan, or paid add-on?
