# CLAUDE.md — mealmate-pilot

## What this project is

MealMate is a two-sided marketplace for restaurant discounts in Dallas. Diners browse offers, claim one, eat at the restaurant, pay in-app, and see the discount applied. The restaurant pays nothing — the diner pays a small platform fee on top of the discounted total.

This repo is the real product build: one Next.js 16 monorepo with three role-gated sections (`/app` for diners, `/dashboard` for merchants, `/admin` for ops), shared auth, shared database.

## Read BRIEF.md first

`BRIEF.md` at the root of this repo is the source of truth for stack, schema, build phases, and conventions. Read it before doing anything else in this codebase. If anything in this CLAUDE.md conflicts with BRIEF.md, BRIEF.md wins.

## Phase discipline

We build in phases. Each phase has explicit acceptance criteria in BRIEF.md. **Don't move to the next phase without checking in with Jeremy first.** When you think a phase is done:

1. Run through the acceptance criteria yourself
2. Report what was built, what was skipped (with reasons), what's broken
3. Wait for Jeremy to verify before touching the next phase

## Coding principles

- **Clear over clever.** Idiomatic code, well-known libraries.
- **Comment generously.** Future-Jeremy and future-Claude need to read this.
- **Test as we go.** After every meaningful function, write a test if reasonable.
- **Don't skip steps.** If something is hard or ambiguous, stop and explain.
- **Commit early and often.** Small commits, clear messages.
- **Code that compiles is not code that works.** Verify behavior.

## When to ask vs guess

**Ask Jeremy when:**
- A product decision isn't covered in BRIEF.md
- Two reasonable architectural paths exist and the brief doesn't pick one
- Canon details are unclear (names, geography, metrics)
- A dependency, library, or API integration would change the stack

**Don't ask when:**
- It's a routine implementation detail covered by the stack
- It's about how to do a thing, not what to do

## Visual / UX reference

Three static HTML prototypes live at:
- Consumer: `https://mealmate-jet.vercel.app` — visual reference for `/app` (diner section).
- Merchant: `https://mealmate-merchant.vercel.app` — visual reference for `/dashboard`.
- Admin: `https://mealmate-admin.vercel.app` — visual reference for `/admin`.

Use these for copy, layout, and UX flow. Don't try to port their HTML — they're vanilla static HTML and the real build is React/Next.js. The prototypes capture intent; we're rebuilding intent properly.

## Canon

These details thread through all three apps. Don't drift.

- **Geography:** Dallas, primarily Bishop Arts
- **Hero restaurant:** Lucia (Italian, 408 N Bishop Ave, Bishop Arts)
- **Hero owner:** Dario Morelli
- **Hero diner:** Ava L.
- **Hero ops user:** Jordan Kim (ops@mealmate.co)
- **Hero offer:** 25% off dinner at Lucia

Use these when seeding the database for development.

## How to run locally

(Once Phase 0 is done.)

```
npm install
npm run dev
```

App runs at `localhost:3000`. Set `.env.local` from `.env.example` first.

## How to deploy

Push to `main`. Vercel auto-deploys in ~60 seconds.

## What never goes in this repo

- `.env*` files
- Secrets of any kind (API keys, service role keys, Stripe secrets)
- `SUPABASE_SERVICE_ROLE_KEY` imported into any client component — it bypasses RLS, shipping it to the browser is a full database breach

## Status

Currently in Phase 0 (foundation). Goal: get the skeleton deployed with all tables in Supabase and CI green before touching auth.
