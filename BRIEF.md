# MealMate — Build Brief (Phase 0 onward)

Reconstructed from prior planning conversations. Verify against any original BRIEF.pdf you have on file before starting — if anything here conflicts with that, the original wins.

---

## Product overview

MealMate is a two-sided marketplace where independent Dallas restaurants offer time-bound, daypart-specific discounts to diners. Diners browse offers in a native iOS / Android app, claim one, eat at the restaurant, pay in-app with a linked credit card, and see the discount applied at payment. A small platform fee is added to the discounted total, paid by the diner. The restaurant pays nothing.

Three audiences, two surfaces:

- **Diner (consumer)** — browses, claims, pays. **Native iOS + Android app** (Expo / React Native). Lives in a separate repo, `mealmate-diner` (TBD).
- **Merchant** — restaurant operator creating and managing offers, monitoring redemptions, managing settlement. **Desktop-friendly web app** in this monorepo (`mealmate-pilot`) at `/dashboard`.
- **Admin (ops)** — internal MealMate team approving merchants, reviewing flagged claims, monitoring fraud signals, reconciling payments. **Web app** in this monorepo at `/admin`.

---

## Architecture decisions (immutable — don't re-litigate)

- **Two repos, one shared backend.**
  - `mealmate-pilot` — Next.js 16 web app. Two role-gated sections under the app router:
    - `/dashboard` → merchant
    - `/admin` → ops
    - `/` → marketing landing
  - `mealmate-diner` — Expo / React Native mobile app for diners. Ships to App Store + Play Store. (Separate repo — to be created when we start Phase 1.5/2.)
- **One Supabase project shared across both surfaces** (Postgres + Auth + Storage). Diner mobile app uses the Supabase JS SDK directly. Web uses `@supabase/ssr`.
- Role is determined at sign-in and enforced at row level in Postgres. **Diner sign-up only happens via the mobile app.**
- **Hosting:**
  - Web: Vercel (auto-deploy `main` of `mealmate-pilot`)
  - Mobile: Expo EAS Build → App Store + Play Store (separate pipeline)
- **Stack is fixed (below). Don't propose substitutions.**

---

## Stack

**Web (merchant + ops + marketing) — `mealmate-pilot`**
- Next.js 16 (App Router) (originally specced as Next 15; `create-next-app` shipped 16, accepted)
- TypeScript (strict mode)
- Tailwind CSS v4
- shadcn/ui for component primitives
- Lucide for icons
- Fonts: Fraunces (serif headlines), Inter (body), JetBrains Mono (eyebrows / labels)

**Mobile (diner) — `mealmate-diner` (separate repo, TBD)**
- Expo (managed workflow) / React Native
- TypeScript (strict mode)
- NativeWind for Tailwind-like styling
- expo-router for navigation
- `@supabase/supabase-js` for backend access
- Stripe React Native SDK for payments

**Backend / data (shared)**
- Next.js API routes + server actions (web side)
- Supabase (Postgres + auth + storage + real-time) — hosted, not self-hosted
- Drizzle ORM for type-safe database access (web side; mobile uses Supabase SDK)
- Zod for runtime validation

**Auth (shared Supabase Auth across web + mobile)**
- Web (merchant + admin): magic link primary, email/password fallback. No social.
- Mobile (diner): magic link via deep links, Sign in with Apple, Sign in with Google
- Three roles: `diner`, `merchant`, `admin` — enforced via row-level security (RLS) in Postgres
- **Diner sign-up exclusively through the mobile app.** A diner who hits the web has no sign-in path; the marketing landing points them to the App Store / Play Store.

**Payments**
- Stripe (simulated card-linked experience for v1)
- Real Visa/Mastercard CLO partnerships are out of scope for v1 — they require 3–12 month deals and $25K–$100K/month minimums that don't engage pre-revenue startups

---

## How the simulated card-linked flow works

For v1 design-partner pilots, MealMate uses Stripe to simulate the card-linked experience:

1. Diner adds card to MealMate (stored as a Stripe customer payment method).
2. At the restaurant, diner taps "Pay" in the MealMate app.
3. MealMate charges the card via Stripe for the discounted total + platform fee.
4. MealMate disburses payout to the restaurant separately (manual or scheduled batch).

This is not the same as Visa/MC CLO rails, but it produces identical economics and UX for the pilot. Architectural decision: build the abstraction so we can swap in real CLO rails later without touching the UI.

---

## Database schema

Eight tables. All `id` columns are `uuid default gen_random_uuid()`. All tables have `created_at` and `updated_at`. RLS enabled on every table. Foreign keys defined in the database itself, not just in Drizzle types.

### `users`
- `id` (uuid)
- `email` (text, unique)
- `role` (enum: `diner`, `merchant`, `admin`)
- `display_name` (text)
- `phone` (text, nullable)
- `stripe_customer_id` (text, nullable — only for diners)
- `trust_score` (text, nullable — A+, A, B, etc. — only meaningful for diners)
- `status` (enum: `active`, `suspended`, `deleted`)

### `restaurants`
- `id` (uuid)
- `owner_user_id` (uuid → users.id)
- `name` (text)
- `address` (text)
- `neighborhood` (text)
- `city` (text)
- `cuisine` (text)
- `mcc` (text — merchant category code for offer eligibility checks)
- `status` (enum: `pending`, `approved`, `suspended`)

### `offers`
- `id` (uuid)
- `restaurant_id` (uuid → restaurants.id)
- `title` (text)
- `description` (text)
- `discount_pct` (int, 1–99)
- `min_spend_cents` (int)
- `valid_days` (text[] — e.g., ['mon','tue','wed'])
- `valid_start_time` (time)
- `valid_end_time` (time)
- `blackout_dates` (date[])
- `max_claims_total` (int, nullable)
- `max_claims_per_diner` (int, default 1)
- `status` (enum: `draft`, `scheduled`, `live`, `ended`)
- `starts_at` (timestamptz)
- `ends_at` (timestamptz, nullable)

### `claims`
- `id` (uuid)
- `offer_id` (uuid → offers.id)
- `diner_user_id` (uuid → users.id)
- `claimed_at` (timestamptz)
- `expires_at` (timestamptz)
- `status` (enum: `claimed`, `consumed`, `expired`, `cancelled`)

### `payments`
- `id` (uuid)
- `claim_id` (uuid → claims.id)
- `card_id` (uuid → cards.id)
- `stripe_payment_intent_id` (text)
- `subtotal_cents` (int — pre-discount)
- `discount_cents` (int)
- `platform_fee_cents` (int)
- `total_cents` (int — what the diner paid)
- `payout_cents` (int — what the restaurant receives)
- `auto_approval_status` (enum: `auto_approved`, `flagged`, `rejected`, `manual_approved`)
- `flagged_reasons` (text[], nullable — which rubrics failed)
- `reviewed_by_user_id` (uuid → users.id, nullable)
- `reviewed_at` (timestamptz, nullable)

### `cards`
- `id` (uuid)
- `user_id` (uuid → users.id)
- `stripe_payment_method_id` (text)
- `last4` (text)
- `brand` (text)
- `exp_month` (int)
- `exp_year` (int)
- `is_default` (boolean)
- `status` (enum: `active`, `expired`, `removed`)

### `audit_log` (immutable)
- `id` (uuid)
- `actor_user_id` (uuid → users.id, nullable for system events)
- `actor_role` (enum: `diner`, `merchant`, `admin`, `system`)
- `action` (text — e.g., `offer.created`, `payment.succeeded`, `merchant.suspended`)
- `subject_type` (text — `offer`, `payment`, `restaurant`, etc.)
- `subject_id` (uuid)
- `metadata` (jsonb)
- `ip_address` (text, nullable)
- `user_agent` (text, nullable)

### `stripe_events` (recommended addition for webhook idempotency)
- `id` (text — Stripe event ID, primary key)
- `type` (text)
- `payload` (jsonb)
- `processed_at` (timestamptz)

---

## The auto-approval rubric (core ops concept)

Every payment runs through 6 checks. All pass → auto-approve. Any fail → flag for human review in the admin portal.

1. **Timing** — claim made during the offer's valid hours?
2. **Day** — claim on an approved day of the week?
3. **Min spend** — transaction met the offer's minimum?
4. **MCC match** — merchant category code matches the offer category?
5. **Max per diner** — diner under their per-offer claim limit?
6. **Card match** — same linked card from claim through to payment?

Target auto-approval rate: 94%. This is the marketplace scale story — it's why we can grow to 10× volume with the same ops headcount.

---

## Coding principles

- **Clear over clever.** Idiomatic code, well-known libraries. Custom implementations only when there's no idiomatic option.
- **Comment generously.** Future-Jeremy and future-Claude both need to read this.
- **Test as we go.** After every meaningful function, write a test if reasonable.
- **Don't skip steps.** If something is hard or ambiguous, stop and explain. Don't paper over.
- **Commit early and often.** Use git from minute one. Small commits, clear messages.
- **When unsure, ask.** Don't guess at canon, schema choices, or product decisions.
- **Code that compiles is not code that works.** Verify behavior, don't trust the type system alone.

---

## Build phases

Work through these in strict order. Stop at each phase's acceptance criteria and check in before continuing.

### Phase 0 — Foundation (Day 1–2)

- Initialize Next.js 15 app with TypeScript, Tailwind, shadcn/ui
- Set up GitHub repo, connect to Vercel
- Set up Supabase project, get connection strings
- Set up Drizzle, define schema migrations from the tables above
- Run migrations, verify schema in Supabase dashboard
- Set up env vars: `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`
- Set up CI: every push runs typecheck, lint, build
- Deploy "hello world" to Vercel, confirm it works
- Enable RLS on every table (policies come in Phase 1)

**Phase 0 acceptance criteria:**
- Repository on GitHub
- App auto-deploys to Vercel on push to `main`
- Supabase has all 8 tables (including `stripe_events`) with FKs and RLS enabled
- `npm run dev`, `npm run build`, `npm run typecheck`, `npm run lint`, `npm test` all succeed locally
- CI passes on a green branch and fails on a deliberately broken one
- A connectivity test script can run `select count(*) from users` against the DB from local dev

**Three things likely to bite in Phase 0:**

1. **Drizzle `push` vs `migrate`.** `drizzle-kit push` is fine for Phase 0. Switch to `generate` + `migrate` (file-based migrations under version control) before Phase 2, once real data exists. Add a visible TODO so this isn't forgotten.
2. **RLS will block Phase 1.** Once RLS is on, every query returns zero rows until policies exist. Don't panic — that's expected.
3. **Supabase free tier auto-pauses inactive projects after a week.** "Cannot reach database" after a few days off is usually this; hit Restore in the dashboard.

### Phase 1 — Web auth + basic shell (Day 3–5)

Scope: **web only** (`mealmate-pilot`). Diner sign-up arrives in the separate `mealmate-diner` Expo project (its own phase plan, TBD).

- Implement Supabase auth on the web: magic link + email/password fallback
- Auth UI for merchant + admin sign-up and sign-in (no diner UI on web)
- Two roles enforced on the web: redirect after login based on `users.role` (`merchant` → `/dashboard`, `admin` → `/admin`); a `diner` role hitting the web gets a friendly "get the app" page
- RLS policies for each table (apply to all three roles, including `diner` for when the mobile app starts hitting these tables in Phase 1.5+)
- Basic app shell for merchant + admin (header, nav, empty state)
- Sign out

**Phase 1 acceptance criteria (web only):**
- Can sign up as a merchant or admin (admin creation might be manual via Supabase dashboard)
- Merchants land on `/dashboard`, admins on `/admin` after sign-in
- A user with role `diner` who somehow lands on the web sees a "use the mobile app" page (no sign-in path)
- RLS policies: a merchant can only read their own restaurant, an admin can read everything
- Sign out works

### Phase 1.5 — Bootstrap `mealmate-diner` (Expo)

New repo. Expo managed workflow, TypeScript strict, NativeWind, expo-router, `@supabase/supabase-js`. Diner sign-up + sign-in (magic link via deep link, plus Sign in with Apple / Google). Acceptance criteria TBD when we get there.

### Phase 2+ — TBD

Define after Phases 1 and 1.5 review. Likely: merchant onboarding flow → offer creation → diner browse + claim (in mobile app) → payment via Stripe → auto-approval rubric → admin review queue.

---

## What exists today (reference, not source of truth)

Three static HTML/CSS/JS prototypes deployed on Vercel from separate repos. They're for investor demos and design-partner pitches. They have no backend, no auth, no real data, no payments.

- **Consumer:** `mealmate-jet.vercel.app` (repo: `mealmate`) — 32 screens, Dallas-localized, Bishop Arts focus. Visual reference for the **native `mealmate-diner` app**; the screens are HTML mockups of the iOS-style UI we'll rebuild in Expo / React Native.
- **Merchant:** `mealmate-merchant.vercel.app` (repo: `mealmate-merchant`) — 10–11 screens, Lucia case study. Visual reference for `/dashboard` in this monorepo.
- **Admin:** `mealmate-admin.vercel.app` (repo: `mealmate-admin`) — 5 screens, Jordan Kim as ops persona. Visual reference for `/admin` in this monorepo.

Use these as visual reference for copy, layout, and UX flow when building. Don't try to port their HTML — the real build is React/Next.js. The prototypes capture intent; you're rebuilding intent properly.

---

## Canon to preserve across the build

These details connect the prototypes to the real product. Don't drift.

- **Geography:** Dallas, TX — primarily Bishop Arts; also Knox-Henderson, Deep Ellum, Lower Greenville
- **Hero restaurant:** Lucia (Italian, Bishop Arts, 408 N Bishop Ave)
- **Hero owner:** Dario Morelli
- **Hero diner:** Ava L.
- **Hero offer:** 25% off dinner at Lucia
- **Hero ops user:** Jordan Kim (ops@mealmate.co)
- **Eight Dallas restaurants** in the seed directory — Lucia plus seven others, mix of cuisines

When you seed the database for development, use these.

---

## Communication norms (between Jeremy and Claude Code)

- When Claude Code finishes a phase, it reports: what was built, what was skipped (with reasons), what's broken, what to verify manually.
- When Claude Code hits ambiguity, it stops and asks. It doesn't guess.
- When something fails, Jeremy pastes the actual error text, not a paraphrase.
- After every commit, Claude Code mentions the commit message so Jeremy can sanity-check.

---

## Cost expectations

Free or near-free during the build. Cloud and service costs will run ~$50–200/month while building (Supabase free tier, Vercel hobby, Stripe test mode). Real costs start when you have real diners and real payments.

---

Begin with Phase 0. Stop at the acceptance criteria and check in.
