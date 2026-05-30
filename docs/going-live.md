# Going live — taking Mealmate out of test mode

There is **no single "go live" button.** Mealmate plugs into several outside
services, and each one has its **own** sandbox/test ↔ live switch. They're
independent — flipping one does nothing to the others. Some switches are a
one-line env-var change; some require the provider to **approve or verify your
account first**, which takes days. Start the slow ones early.

> Golden rule: a service left in test mode doesn't error loudly — it just
> **silently fails or uses fake data** with real users. A real diner could sign
> up, link a "card," eat, and never get paid, with nothing obviously broken.
> That's why this checklist exists.

This doc is the single source of truth. Work top to bottom.

---

## At a glance

| # | Service | Does what | Switch lives in | Needs provider approval? | Launch-critical? |
|---|---------|-----------|-----------------|--------------------------|------------------|
| 1 | **Plaid** | Links diner cards, reads transactions | `PLAID_ENV` env var | ✅ **Yes — apply early** | 🔴 Yes (core loop) |
| 2 | **Dwolla** | Pays cash back to diners (ACH) | `DWOLLA_ENVIRONMENT` env var | ✅ **Yes — verify account** | 🔴 Yes (core loop) |
| 3 | **Stripe** | Restaurant payouts + weekly settlement | swap test→live keys + webhook | Activate account details | 🔴 Yes (restaurants) |
| 4 | **Twilio** | Sends SMS sign-in codes | Upgrade out of trial (Twilio) | Add payment method | 🟡 Only if using phone signup |
| 5 | **Resend** | Transactional emails | already live | No | 🟢 Already done |
| 6 | **Supabase** | Auth + database | already production | No | 🟢 Already done |
| 7 | **Astra** | Instant debit payout (future) | `DEBIT_PAYOUT_ENABLED` flag | Blocked + not wired | ⚪ Leave OFF |

Legend: 🔴 must be live for the product to work · 🟡 conditional · 🟢 done · ⚪ leave as-is.

**Lead-time warning:** #1, #2, #3 all involve real money/banking and require the
provider to approve or verify you. These can take **days**. Do NOT leave them
for launch morning.

---

## 1. Plaid — `sandbox` → `production`  🔴 START THIS FIRST (longest lead time)

**Why critical:** in sandbox, only Plaid's fake test cards link and no real
transactions are ever read — so the entire "we noticed your visit" loop is fake.

1. **Apply for Production access** in the Plaid Dashboard (Team Settings →
   "Request Production access"). Plaid reviews your use case. **This is the
   gate — start it well before launch.**
2. Once approved, get your **production** `client_id` + **production** secret
   (different from sandbox — a sandbox secret will NOT work against production).
3. In Vercel env vars (Production environment) set:
   - `PLAID_ENV=production`
   - `PLAID_CLIENT_ID=<production client id>`
   - `PLAID_SECRET=<production secret>`
   - Leave `PLAID_TOKEN_ENCRYPTION_KEY` as-is (it's ours, not Plaid's).
4. Redeploy. Test by linking a **real** debit card end-to-end.

> Code reads `PLAID_ENV` to pick the host (see `src/lib/plaid.ts`):
> `production` → Plaid's production host, anything else → sandbox. No code change
> needed — just env vars.

---

## 2. Dwolla — `sandbox` → `production`  🔴 (the only live payout rail)

**Why critical:** this is what actually sends cash back to diners. In sandbox no
real money moves. This is the only payout rail wired in code today (Astra/debit
is off — see #7).

1. In the **Dwolla Dashboard**, complete **production account verification**
   (business info, bank funding source). Dwolla must approve before you can move
   real money. Allow several days.
2. Get your **production** `key` + `secret` and set up a **production webhook**
   pointing to `https://mealmatedining.app/api/webhooks/dwolla` with a signing
   secret.
3. In Vercel env vars (Production) set:
   - `DWOLLA_ENVIRONMENT=production`
   - `DWOLLA_KEY=<production key>`
   - `DWOLLA_SECRET=<production secret>`
   - `DWOLLA_WEBHOOK_SECRET=<production webhook secret>`
4. Redeploy. Confirm a real (small) cash-back payout lands.

> Code reads `DWOLLA_ENVIRONMENT` (see `src/lib/dwolla.ts`):
> `production` → `api.dwolla.com`, else sandbox. Env-var only.

---

## 3. Stripe — test keys → live keys  🔴 (restaurant settlement)

**Why critical:** restaurants connect their bank via Stripe Connect and settle
the discount portion weekly. Test keys = no real money from restaurants, and
real restaurant onboarding (bank/SSN) won't work.

1. In the **Stripe Dashboard**, toggle from **Test mode** to **Live mode**
   (top-right). Activate your account if you haven't (business details).
2. Grab the **live** keys:
   - `sk_live_…` → `STRIPE_SECRET_KEY`
   - `pk_live_…` → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
3. **Re-create the webhook in LIVE mode** (test/live webhooks are separate):
   - Endpoint: `https://mealmatedining.app/api/webhooks/stripe`
   - Events to send (the code handles exactly these — see
     `src/app/api/webhooks/stripe/route.ts`):
     `account.updated` (restaurant onboarding status),
     `invoice.paid`, `invoice.payment_failed`,
     `invoice.marked_uncollectible` (weekly settlement status)
   - Copy the **live** signing secret → `STRIPE_WEBHOOK_SECRET`.
4. Set all three env vars in Vercel (Production), redeploy.
5. Test: onboard a real (or your own) restaurant through Stripe Connect and
   confirm `account.updated` flips its status in the app.

> Note: Stripe Connect onboarding shows your Terms URL — make sure `/terms` and
> `/privacy` are filled in (entity name, governing law, contact email — these
> are currently DRAFT placeholders; confirm before launch).

---

## 4. Twilio — leave trial mode  🟡 (only if you keep phone sign-up)

**Why:** a Twilio **trial** account can only text phone numbers you've manually
**verified** in the Twilio console. Real diners' numbers won't receive a code
until you upgrade.

1. In the **Twilio Console**, click **Upgrade** (add a payment method).
2. That's it — the verified-numbers-only restriction lifts; any US number can
   now receive codes.
3. Twilio creds live in the **Supabase dashboard** (Authentication → Providers →
   Phone → Twilio Verify), **not** in our code/env. No redeploy needed.

> You do NOT need to upgrade just to test with your own verified number. See
> `docs/phone-auth-setup.md` for the full Twilio + Supabase setup. If you decide
> not to launch with phone sign-up, you can skip this entirely — email works.

---

## 5. Resend — already live  🟢

Transactional email (contact form, lifecycle notifications) sends via Resend if
`RESEND_API_KEY` is set, otherwise it logs to the server console and never
breaks. No test/live toggle. Just confirm `RESEND_API_KEY` is set in Production
and that the **`support@mealmatedining.com`** inbox actually exists and is
monitored.

---

## 6. Supabase — already production  🟢

Single environment, which is your real production project. No switch. Two things
to verify before launch:
- The site's domain (`https://mealmatedining.app/auth/callback`) is in the
  Auth **redirect allow-list**.
- Decide whether **email confirmation** is on or off (off = instant
  signup→home; on = "check your email" step). Auth → Settings.

---

## 7. Astra (debit payout) — leave OFF  ⚪

Do **nothing** here. `DEBIT_PAYOUT_ENABLED = false`
(`src/lib/rebates/config.ts`). It's off because (a) Astra hasn't enabled debit
on the account (vendor-side, still blocked) AND (b) the send rail doesn't route
to it yet. Diners only ever see the ACH (Dwolla) option, which pays out for
real. Flipping this on prematurely would strand a diner's cash back forever.
Revisit only when both conditions are met — see the push-to-debit project notes.

---

## Final pre-launch sweep (after the switches above)

- [ ] All Production env vars set in **Vercel → Production** (not just Preview).
- [ ] Code pushed to `main` and deployed (Vercel auto-deploys ~60s).
- [ ] One real end-to-end diner run: link real card → claim offer → pay at
      restaurant → cash back lands. (Needs Plaid + Dwolla live.)
- [ ] One real restaurant onboarded through Stripe Connect (live).
- [ ] `/terms` + `/privacy` placeholders confirmed (entity, law, contact email).
- [ ] `support@mealmatedining.com` inbox exists and is monitored.
- [ ] Twilio upgraded if launching with phone sign-up.

## Known scaling limits (NOT launch blockers, revisit with traction)

These are fine for a Dallas pilot but will strain with growth — documented so
they're not a surprise:
- Cash-back pipeline runs **once daily** in a single 60s cron
  (`/api/cron/plaid-sync`); diner payout lags up to ~24h. Fix: Vercel Pro +
  `*/30` schedule.
- The matcher re-scans **all** unmatched transactions against **all**
  restaurants every run (no incremental cursor). Fine for dozens; not thousands.
- Phone OTP endpoint has **no app-level rate limit** (relies on Supabase's
  built-in limits) — an SMS-pumping abuse vector once Twilio is upgraded.
  Stopgap available: wire `src/lib/security/rate-limit.ts` into
  `startPhoneAuth`.
- Admin/merchant list queries have no pagination/`LIMIT`.
