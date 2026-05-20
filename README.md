# MealMate

A two-sided marketplace for restaurant discounts in Dallas, built on the
**rebate model**: diners link a card, browse offers, claim one, eat at the
restaurant and **pay normally at the POS**, then receive a cash-back
**rebate** to that card a few days later. Restaurants settle the discount
portion to MealMate weekly.

This repo is the pilot build — one Next.js monorepo with three role-gated
sections sharing one database and one auth system.

---

## How the money flows

1. **Diner** links a bank card via Plaid and claims an offer (e.g. "25% off
   dinner at Lucia").
2. Diner eats at the restaurant and pays the full check at the restaurant's
   own point-of-sale terminal — MealMate is not in that transaction.
3. A scheduled job pulls the diner's transactions from Plaid, **matches**
   the restaurant charge to their open claim, and scores confidence.
4. High-confidence matches auto-approve through a 6-check rubric;
   lower-confidence ones go to an ops review queue.
5. An approved match issues a **rebate** to the diner's bank account via
   Dwolla (ACH).
6. Every week, MealMate **invoices each restaurant** (via Stripe) for the
   sum of discounts it granted. MealMate keeps a small platform fee.

```
diner links card → claims offer → eats & pays at POS
   → Plaid transaction sync → match engine → approval
   → Dwolla rebate to diner        (cash back)
   → weekly Stripe invoice to restaurant   (settlement)
```

---

## Tech stack

| Layer        | Choice                                            |
|--------------|---------------------------------------------------|
| Framework    | Next.js 16 (App Router, React 19)                 |
| Database     | Supabase Postgres, row-level security on every table |
| ORM / migrations | Drizzle (`drizzle-kit generate` + a custom migrate script) |
| Auth         | Supabase Auth (magic-link), role-gated layouts    |
| Card linking | Plaid (Transactions + Auth products)              |
| Rebates      | Dwolla (ACH push to the diner's bank account)     |
| Settlement   | Stripe Invoicing (weekly invoice per restaurant)  |
| Hosting      | Vercel (auto-deploy from `main`), Vercel Cron     |
| Tests        | Vitest                                            |

---

## The three sections

The app is one deployment with three role-gated areas. `requireRole()` in
each section's layout enforces access and redirects the wrong role away.

- **`/app`** — the diner experience: browse offers, claim, link cards, set
  up a rebate destination.
- **`/dashboard`** — the merchant experience: onboard a restaurant, create
  offers, view matched transactions.
- **`/admin`** — the ops experience: approve restaurants, work the match
  review queue, watch rebate and settlement status.

---

## Project layout

```
src/
  app/
    app/          diner section (/app)
    dashboard/    merchant section (/dashboard)
    admin/        ops section (/admin)
    api/
      cron/       scheduled jobs (Plaid sync, weekly settlement)
      webhooks/   Stripe + Dwolla webhook handlers
  db/
    schema.ts     Drizzle table definitions
  lib/
    matching/     merchant-name normalization, confidence scoring, matcher
    rebates/      rebate creation + Dwolla transfer
    settlements/  weekly settlement run
    crypto/       at-rest encryption for Plaid access tokens
    auth/         role gating
    db/           query helpers per table
    plaid.ts dwolla.ts stripe.ts   third-party clients
drizzle/          SQL migrations + journal
scripts/          one-off setup: RLS policies, seeds, migration runner
```

---

## Build status

The full pilot build plan is complete:

| Phase | Scope | Status |
|-------|-------|--------|
| 0–1   | Foundation, auth, role-gated shell | Done |
| 2     | Merchant onboarding, offers, claim flow | Done |
| 3     | Operational ergonomics | Done |
| 4a    | Stripe Connect onboarding for restaurants | Done |
| 4b    | Plaid card linking, encrypted tokens at rest | Done |
| 4c    | Matching engine (sync, normalize, score, auto-approve) | Done |
| 4d    | Rebate issuance via Dwolla | Done |
| 4e    | Weekly settlement invoicing via Stripe | Done |

See `BRIEF.md` for the authoritative architecture and phase detail.

---

## Local development

### 1. Install

```
npm install
```

### 2. Configure environment

Copy the template and fill in real values:

```
cp .env.example .env.local
```

`.env.local` is gitignored — secrets never get committed. Required values,
and where each comes from:

| Variable | Source |
|----------|--------|
| `DATABASE_URL` | Supabase → Project Settings → Database (connection string) |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API (server-only — bypasses RLS) |
| `STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe Dashboard → Developers → API keys (test mode) |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Developers → Webhooks (per endpoint) |
| `PLAID_CLIENT_ID` / `PLAID_SECRET` | Plaid Dashboard → Developers → Keys (sandbox) |
| `PLAID_ENV` | `sandbox` for development |
| `PLAID_TOKEN_ENCRYPTION_KEY` | Generate: `openssl rand -base64 32` (32-byte AES key) |
| `DWOLLA_KEY` / `DWOLLA_SECRET` | Dwolla sandbox dashboard → Applications |
| `DWOLLA_ENVIRONMENT` | `sandbox` for development |
| `DWOLLA_WEBHOOK_SECRET` | Chosen when registering a Dwolla webhook subscription |
| `CRON_SECRET` | Generate: `openssl rand -base64 32` (bearer token for cron routes) |

Generate a **separate** value of each generated key per environment
(local / preview / production). Never reuse or commit a real value.

### 3. Set up the database

Apply migrations and row-level-security policies:

```
npm run db:migrate
npm run setup:auth
npm run setup:offer-policies
npm run setup:claim-policies
npm run setup:stripe-account-policies
npm run setup:plaid-policies
npm run setup:matched-transactions-policies
npm run setup:rebates-policies
npm run setup:dwolla-policies
npm run setup:settlements-policies
```

Seed canon data (Dallas restaurants + offers):

```
npm run seed
```

### 4. Run

```
npm run dev
```

App runs at `localhost:3000`.

---

## Common commands

| Command | What it does |
|---------|--------------|
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm test` | Run the Vitest suite |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check, no emit |
| `npm run db:generate` | Generate a migration from schema changes |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:ping` | Check database connectivity |
| `npm run seed` | Seed canon restaurants + offers |

---

## Scheduled jobs

Two Vercel Cron jobs (see `vercel.json`), both authenticated with
`CRON_SECRET`:

- **`/api/cron/plaid-sync`** — pulls new Plaid transactions, runs the
  matcher, auto-approves high-confidence matches, and issues rebates.
- **`/api/cron/weekly-settlement`** — groups approved transactions per
  restaurant and issues weekly Stripe invoices.

---

## Deployment

Push to `main` — Vercel auto-deploys in about a minute. Environment
variables are configured in the Vercel project settings, scoped per
environment (production / preview / development).

---

## Security notes

- Every table has row-level security; policy scripts live in `scripts/`.
- `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS and is server-only — it must
  never be imported into a client component.
- Plaid access tokens are encrypted at rest (AES-256-GCM) with
  `PLAID_TOKEN_ENCRYPTION_KEY`.
- Webhook handlers verify signatures (Stripe signing secret, Dwolla
  HMAC-SHA256) before acting on any event.
- No `.env*` file or secret of any kind is committed — see `.gitignore`.
