# MealMate — Build Brief

Last major architecture revision: **2026-05-18** — switched from
in-app payment (Stripe PaymentIntents) to the **rebate model** below.
Earlier code (Phase 2d / 3.5 in-app pay flow + payouts admin) is being
ripped out and replaced as part of Phase 4.

---

## Product overview

MealMate is a two-sided marketplace where independent Dallas restaurants
offer time-bound, daypart-specific discounts to diners. Diners browse
offers, claim one, **eat at the restaurant and pay normally at the POS
using their own linked Visa/MC**, then receive a cash-back **rebate** to
their card 1–2 days later. The restaurant settles the discount portion
with MealMate weekly. MealMate keeps a small platform fee out of the
rebate.

Three audiences, one product:

- **Diner (consumer)** — links a card via Plaid, browses, claims, eats,
  gets rebated. Mobile-first iOS-style web app at `/app`.
- **Merchant** — restaurant operator. Onboards via Stripe Connect,
  creates / manages offers, monitors redemptions, sees what they owe
  MealMate in next week's settlement. Desktop-friendly web app at
  `/dashboard`.
- **Admin (ops)** — internal MealMate team. Approves merchants, reviews
  unmatched transactions and flagged matches, initiates weekly
  settlement batches and tracks Visa Direct rebate issuance. Web app
  at `/admin`.

---

## Architecture decisions (immutable — don't re-litigate)

- **Single Next.js 16 monorepo.** Three role-gated sections under the
  app router: `/app` (diner), `/dashboard` (merchant), `/admin` (ops).
- **Shared auth, shared database.** Role is determined at sign-in and
  enforced at row level in Postgres.
- **Project name:** `mealmate-pilot`
- **Hosting:** Vercel (auto-deploy `main`)
- **Payment model is the REBATE model (below). MealMate never holds
  the diner's money in-app.** The Phase 2d simulated card-linked flow
  has been deprecated.
- **Stack is fixed (below). Don't propose substitutions.**

---

## Stack

**Frontend**
- Next.js 16 (App Router)
- TypeScript (strict mode)
- Tailwind CSS v4
- shadcn/ui for component primitives
- Lucide for icons
- Fonts: Fraunces (serif), Inter (body), JetBrains Mono (labels)

**Backend / data**
- Next.js API routes + server actions
- Supabase (Postgres + auth + storage + real-time)
- Drizzle ORM, file-based migrations (`generate` + `migrate`)
- Zod for runtime validation

**Auth**
- Supabase Auth — magic link primary, email/password fallback
- Three roles: `diner`, `merchant`, `admin` — enforced via RLS
- Custom SMTP via Resend

**Payment infrastructure (rebate model)**
- **Plaid** — Auth + Transactions API. Diners link their Visa/MC
  through Plaid Link; we read transaction data via the Transactions
  endpoint to match charges against active claims.
- **Visa Direct / Mastercard Send** — push rebates to the diner's
  linked card 1–2 business days after the matched dining transaction.
  Available through Stripe push payouts, Dwolla, or direct network
  integration. ~1.5% + $0.50 per push.
- **Stripe Connect** — restaurant onboarding (KYC, account status) +
  weekly settlement collection. Each restaurant has one Stripe
  Connect account. We invoice them weekly for the sum of discounts
  they offered on matched transactions.
- **NOT Stripe PaymentIntents.** That was the v1 simulated model;
  it has been removed.

---

## How the rebate flow works

For each transaction, the lifecycle is:

**1. Onboarding (one time):**
- Diner signs up → links a Visa/MC via Plaid Link (Plaid Auth +
  Transactions). One-time KYC, similar to Venmo.
- Restaurant signs up → completes Stripe Connect onboarding (KYC,
  business details, bank account). ~25 minutes.

**2. Claim (just before / when planning the meal):**
- Diner sees an offer (e.g. "Lucia 25% off tonight"), taps **Claim**.
- The Claim screen **explicitly discloses the fee** before they
  confirm: "MealMate keeps a 20% fee on the discount (capped at $10)
  out of your cash back."

**3. Dining:**
- Diner goes to the restaurant, eats, pays at the POS with their
  linked Visa/MC just like any other meal.
- Restaurant receives full check via their normal processor
  (Toast/Square/Aloha). MealMate is invisible at this moment.

**4. Match (0–3 days later, typically next business day):**
- Plaid sees the charge on the diner's linked card.
- The MealMate matching engine checks: does this transaction match
  an active unredeemed claim? (Merchant name + amount window +
  date window.)
- High-confidence match → proceed to step 5. Low / no match →
  manual review queue. No claim at all → ignore.

**5. Calculate rebate:**
```
discount_cents      = round(total_cents * offer.discount_pct / 100)
platform_fee_cents  = max(MIN, min(MAX, discount_cents * 0.20))
rebate_cents        = max(0, discount_cents - platform_fee_cents)
```
where `MIN = 50` cents and `MAX = 1000` cents (env-driven). The fee is
20% of the discount the restaurant funds — not the check.

**6. Issue rebate to diner:**
- Visa Direct / Mastercard Send push for `rebate_cents` to the
  diner's linked card.
- Diner sees credit on their statement within 1–2 business days
  ("MealMate cash-back").
- Push notification to the diner once initiated.

**7. Settle with restaurant (weekly batch):**
- Every Tuesday: sum every matched transaction per restaurant for
  the prior week.
- Invoice the restaurant via Stripe Connect for the sum of
  `discount_cents`.
- Restaurant pays via Stripe Connect (ACH pull or invoice payment).
- MealMate retains `platform_fee_cents`. The deltas to Visa Direct,
  Plaid, and Stripe come out of that fee.

---

## Fee model (env-var driven)

```
PLATFORM_FEE_RATE      = 0.20    (20% of the discount)
PLATFORM_FEE_MIN_CENTS = 50      ($0.50 floor)
PLATFORM_FEE_MAX_CENTS = 1000    ($10.00 cap)

fee_cents    = max(MIN, min(MAX, discount_cents * PLATFORM_FEE_RATE))
rebate_cents = max(0, discount_cents - fee_cents)
```

The fee is a share of the discount (the pool the restaurant funds), not
the check. The restaurant settlement is unchanged: they still pay the
full `discount_cents`.

Sample math:
- **$148 check, 25% discount:** discount = $37, fee = $7.40
  (20% of $37, within cap), cash back = $29.60
- **$10 check, 15% discount:** discount = $1.50, fee = $0.50
  (floored), cash back = $1.00
- **$400 check, 30% discount:** discount = $120, fee capped at
  $10, cash back = $110

Tunable in production via env vars without a deploy.

---

## Offer constraints

- **Minimum discount: 15%** — restaurants can't go below
- **Maximum discount: 50%** — restaurants can't go above
- Restaurant sets the daily time window (e.g. Mon–Wed 5pm–9pm)
- Restaurant sets the **monthly budget cap** (e.g. $2,000/month max
  total discount spend). When exhausted, offer auto-pauses.
- Restaurant sets the **minimum check size** (typically $40–50)

---

## Database schema

Twelve tables. All `id` columns are `uuid default gen_random_uuid()`
unless noted. All tables have `created_at` and `updated_at`. RLS is
enabled on every table.

### `users`
- `id` (uuid)
- `email` (text, unique)
- `role` (enum: `diner`, `merchant`, `admin`)
- `display_name` (text)
- `phone` (text, nullable)
- `trust_score` (text, nullable — A+, A, B, etc. — only for diners)
- `status` (enum: `active`, `suspended`, `deleted`)

### `restaurants`
- `id` (uuid)
- `owner_user_id` (uuid → users.id)
- `name` (text)
- `address` (text)
- `neighborhood` (text)
- `city` (text)
- `cuisine` (text)
- `mcc` (text)
- `status` (enum: `pending`, `approved`, `suspended`)

### `restaurant_stripe_accounts`
- `restaurant_id` (uuid PK → restaurants.id)
- `stripe_account_id` (text — `acct_...`)
- `details_submitted` (bool)
- `charges_enabled` (bool)
- `payouts_enabled` (bool)
- `status` (enum: `pending`, `restricted`, `active`)

### `offers`
- `id` (uuid)
- `restaurant_id` (uuid → restaurants.id)
- `title` (text)
- `description` (text)
- `discount_pct` (int, CHECK 15–50)
- `min_check_cents` (int — minimum check size to qualify)
- `monthly_budget_cents` (int — max discount spend per month)
- `monthly_spent_cents` (int default 0 — running tally, reset monthly)
- `valid_days` (text[])
- `valid_start_time` (time)
- `valid_end_time` (time)
- `blackout_dates` (date[])
- `max_claims_per_diner` (int, default 1)
- `status` (enum: `draft`, `scheduled`, `live`, `paused`, `ended`)
- `starts_at` (timestamptz)
- `ends_at` (timestamptz, nullable)

### `claims`
- `id` (uuid)
- `offer_id` (uuid → offers.id)
- `diner_user_id` (uuid → users.id)
- `claimed_at` (timestamptz)
- `expires_at` (timestamptz — typically 24h, gives Plaid time to
  catch the transaction)
- `status` (enum: `claimed`, `matched`, `expired`, `cancelled`)

### `plaid_items`
- `id` (uuid)
- `user_id` (uuid → users.id)
- `plaid_item_id` (text — Plaid's id, unique)
- `access_token` (text — Plaid access token; ENCRYPTED at rest
  via Supabase column-level encryption, never returned to client)
- `institution_name` (text)
- `status` (enum: `active`, `error`, `removed`)

### `plaid_card_accounts`
- `id` (uuid)
- `plaid_item_id` (uuid → plaid_items.id)
- `plaid_account_id` (text — unique per item)
- `name` (text — Plaid's friendly name)
- `official_name` (text — bank's official name)
- `mask` (text — last 4)
- `brand` (text — `visa`, `mastercard`, etc.)
- `is_default` (bool)
- `status` (enum: `active`, `removed`)

### `matched_transactions`
- `id` (uuid)
- `claim_id` (uuid → claims.id, nullable until matched)
- `plaid_card_account_id` (uuid → plaid_card_accounts.id)
- `plaid_transaction_id` (text — Plaid's transaction id, unique)
- `merchant_name_raw` (text — as Plaid reports it)
- `merchant_name_normalized` (text — what our matcher resolved)
- `restaurant_id` (uuid → restaurants.id, nullable for unmatched)
- `amount_cents` (int)
- `transaction_date` (date)
- `match_confidence` (enum: `high`, `medium`, `low`, `none`)
- `discount_pct_at_match` (int)
- `discount_cents` (int)
- `platform_fee_cents` (int)
- `rebate_cents` (int)
- `auto_approval_status` (enum: `auto_approved`, `flagged`,
  `rejected`, `manual_approved`)
- `flagged_reasons` (text[], nullable)
- `reviewed_by_user_id` (uuid → users.id, nullable)
- `reviewed_at` (timestamptz, nullable)

### `rebates`
- `id` (uuid)
- `matched_transaction_id` (uuid → matched_transactions.id, unique)
- `plaid_card_account_id` (uuid → plaid_card_accounts.id)
- `amount_cents` (int)
- `provider` (enum: `stripe`, `dwolla`, `visa_direct`)
- `provider_transfer_id` (text — their id, unique)
- `status` (enum: `initiated`, `sent`, `failed`, `settled`)
- `sent_at` (timestamptz, nullable)
- `settled_at` (timestamptz, nullable)
- `error_message` (text, nullable)

### `settlements`
- `id` (uuid)
- `restaurant_id` (uuid → restaurants.id)
- `period_start` (date)
- `period_end` (date)
- `total_discount_cents` (int — sum of discounts in period)
- `transaction_count` (int)
- `stripe_invoice_id` (text, nullable)
- `status` (enum: `pending`, `invoiced`, `paid`, `overdue`)
- `invoiced_at` (timestamptz, nullable)
- `paid_at` (timestamptz, nullable)

### `audit_log` (immutable, append-only)
- `id` (uuid)
- `actor_user_id` (uuid → users.id, nullable for system events)
- `actor_role` (enum: `diner`, `merchant`, `admin`, `system`)
- `action` (text — e.g. `restaurant.approved`, `transaction.matched`,
  `rebate.sent`, `settlement.paid`)
- `subject_type` (text)
- `subject_id` (uuid)
- `metadata` (jsonb)
- `ip_address` (text, nullable)
- `user_agent` (text, nullable)

### `stripe_events`
- `id` (text PK — Stripe event id)
- `type` (text — Connect events: `account.updated`,
  `invoice.paid`, `transfer.created`, etc.)
- `payload` (jsonb)
- `processed_at` (timestamptz)

---

## Matching engine (Phase 4c — hardest piece)

Plaid reports the diner's transactions with raw merchant strings like
`SQ *LUCIA`, `LUCIA RESTAURANT BISHOP ARTS`, `LUCIA          DALLAS TX`,
etc. We have to resolve those to a specific restaurant and an active
claim.

Confidence dimensions:
- **Merchant name match** — normalize both sides, exact / fuzzy / token
  containment
- **Timing match** — transaction posted 0–3 days after the claim
- **Amount tolerance** — actual check meets `offer.min_check_cents`
- **Geography** — both Dallas (sanity check)

Output: `high` / `medium` / `low` / `none`. **High** auto-approves
into the rebate flow. **Medium** + **low** queue for admin review.
**None** is logged as unmatched and the claim eventually expires.

Target match rate: **85–95%**. Manual review tools are part of Phase
4c. The 6-check auto-approval rubric (timing / day / min check / MCC /
max per diner / card match) is applied to high-confidence matches
post-resolution.

---

## Unit economics (reference)

**$148 check, 25% discount at Lucia:**
- Restaurant settles: $37 → MealMate
- Platform fee retained: $8.88 (6% of $148)
- Rebate to diner: $28.12 via Visa Direct
- Visa Direct cost: ~$0.92
- Plaid cost: ~$0.05
- Stripe Connect cost on weekly batch: ~$0.05
- **MealMate net: ~$7.86**

**$50 check, 15% discount:**
- Restaurant settles: $7.50 → MealMate
- Platform fee: $3.00 (6% of $50, within cap)
- Rebate to diner: $4.50
- Visa Direct cost: ~$0.57
- **MealMate net: ~$2.33**

---

## Coding principles

- **Clear over clever.** Idiomatic code, well-known libraries.
- **Comment generously.** Future-Jeremy and future-Claude both read this.
- **Test as we go.** After every meaningful function, write a test.
- **Don't skip steps.** If something is hard or ambiguous, stop and
  explain. Don't paper over.
- **Commit early and often.** Small commits, clear messages.
- **When unsure, ask.** Don't guess at canon, schema, or product.
- **Code that compiles is not code that works.** Verify behavior.

---

## Build phases

Phases 0–3.5 are complete. Phase 4 begins the rebate model build-out.

### Phase 0 — Foundation ✅ (done)
Next.js + Supabase + Drizzle + Vercel + CI.

### Phase 1 — Auth + basic shell ✅ (done)
Magic-link auth, RLS, role-gated sections, sign-out.

### Phase 2a — Merchant onboarding + admin approval ✅ (done)

### Phase 2b — Offer creation + diner browse ✅ (done)

### Phase 2c — Claim flow ✅ (done)

### ~~Phase 2d — In-app payment via Stripe PaymentIntents~~ ❌ (removed)
Replaced by the rebate model. The code (`/app/cards/add`,
`/app/claims/[id]/pay`, `payClaim` action, PaymentIntent flow,
card-add via SetupIntent) was ripped out in Phase 4-prep.

### Phase 2e — Auto-approval rubric ✅ (done, repurposed for matching)
The 6 checks remain. They now apply to high-confidence Plaid matches
in `matched_transactions`, not to in-app PaymentIntents.

### Phase 3 — Operational ergonomics ✅ (done)
Claim cancel, offer end, merchant "tonight" view.

### ~~Phase 3.5 — Admin payout management~~ ❌ (removed)
Inverted by the rebate model — restaurants now owe MealMate, not the
other way around. The `paid_out_at` / `payout_batch_id` columns and
`/admin/payouts` UI were ripped out in Phase 4-prep.

### Phase 4 — Rebate model implementation

- **Phase 4a:** Stripe Connect for restaurants — sign-up, KYC,
  account status, webhook handling for `account.updated`.
- **Phase 4b:** Plaid integration — Plaid Link UI, Item / Account
  storage, encrypted access token at rest, sandbox + production.
- **Phase 4c:** Matching engine — merchant-name normalization,
  confidence scoring, manual review queue, the hardest piece.
- **Phase 4d:** Visa Direct / Mastercard Send rebate issuance —
  pick the provider (Stripe push payouts vs Dwolla), idempotent
  retry, status tracking.
- **Phase 4e:** Weekly settlement batch — cron / scheduled job
  that compiles per-restaurant invoices via Stripe Connect.

Each sub-phase has its own acceptance criteria; we'll define them
when we start the sub-phase.

---

## What exists today (reference, not source of truth)

Three static HTML/CSS/JS prototypes:

- **Consumer:** `mealmate-jet.vercel.app` — visual reference for `/app`.
- **Merchant:** `mealmate-merchant.vercel.app` — visual reference for
  `/dashboard`.
- **Admin:** `mealmate-admin.vercel.app` — visual reference for
  `/admin`.

Use these for copy/layout/UX flow. Don't port the HTML — the real
build is Next.js.

---

## Canon

- **Geography:** Dallas, TX — primarily Bishop Arts; also
  Knox-Henderson, Deep Ellum, Lower Greenville
- **Hero restaurant:** Lucia (Italian, Bishop Arts, 408 N Bishop Ave)
- **Hero owner:** Dario Morelli
- **Hero diner:** Ava L.
- **Hero offer:** 25% off dinner at Lucia
- **Hero ops user:** Jordan Kim (ops@mealmate.co)
- **Eight Dallas restaurants** in the seed directory

---

## Communication norms (Jeremy ↔ Claude Code)

- When Claude finishes a phase, it reports: built / skipped (with
  reasons) / broken / what to verify manually.
- When Claude hits ambiguity, it stops and asks.
- When something fails, Jeremy pastes the actual error text.
- After every commit, Claude mentions the commit message.

---

## Cost expectations

Build phase: ~$50–200/month (Supabase, Vercel, Stripe test, Plaid
sandbox, Resend free tier). Real costs scale with matched volume —
Visa Direct (~$0.90 per rebate at a $30 average), Plaid
(~$0.05/match), Stripe Connect (~$0.05/settlement).
