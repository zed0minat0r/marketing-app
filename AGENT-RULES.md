# Agent Rules — Text-First AI Marketing Agent (working name TBD)

## Product Vision
A text-first AI marketing agent for small businesses. No app to download, no dashboard to learn, no login. Business owners manage their entire marketing via text message. "A marketing team in your texts."

## What We're Building
Phase 1: A stunning landing page that explains the product and has a "Sign up with your phone number" CTA. Must include an interactive demo showing a text conversation flow.
Phase 2: SMS backend (Twilio + Claude API + social media APIs) — future.

## Critical Rules
1. Your VERY FIRST action must be a tool call. Do NOT generate ANY text before your first tool call.
2. Always commit and push after making changes.
3. After pushing, text the user via iMessage (chat_id: `any;-;+14847162152`) with a summary of what you did.
4. Always include the live link: https://zed0minat0r.github.io/marketing-app/
5. SIMPLICITY IS KING — Do NOT pile on animations, effects, or decorative elements.
6. This must NOT look AI-generated. Break Claude's default patterns. No teal/green, no rounded cards, no Nunito/Inter. Be bold, unique, distinctive. Reference the best SaaS landing pages (Linear, Vercel, Stripe, Arc) for inspiration.
7. Spark: CAN add impressive features, but if you add something, REPLACE or REMOVE something else. No piling on.
8. Nigel: Score strictly from the perspective of a small business owner visiting this landing page for the first time.

## Repo Info
- Repo: /tmp/marketing-app
- Branch: main
- Remote: origin (GitHub)
- Live: https://zed0minat0r.github.io/marketing-app/

## Agent Team
- **Builder** — implements features, fixes bugs
- **Spark** — CAN add impressive features, but must REPLACE or REMOVE something when adding. No piling on.
- **Nigel** — strict auditor with decimal scoring
- **QA** — browser testing at 375px mobile
- **Pixel** — mobile alignment, tap targets, font sizes, overflow
- **Refiner** — implements top audit recommendations
- **Razor** — dead code cleanup, consolidation
- **Scout** — web research on competitors and best practices
