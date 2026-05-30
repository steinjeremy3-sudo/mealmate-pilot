// Mealmate database schema (rebate model — see BRIEF.md).
//
// Conventions:
//   - All primary keys are uuid default gen_random_uuid() unless noted
//   - Every table has created_at + updated_at (timestamptz, default now())
//     unless explicitly omitted (audit_log, stripe_events keep their own)
//   - RLS is enabled on every table; per-table policies live in
//     scripts/{auth,offer,claim,plaid,match,settlement}-policies.sql
//
// Workflow: schema changes go through `npm run db:generate` then
// `npm run db:migrate`. drizzle-kit push is no longer used.
//
// Major revision 2026-05-18: in-app payment (Stripe PaymentIntents)
// removed; rebate model added (Plaid + Visa Direct + Stripe Connect).
// `cards` and `payments` tables dropped. New tables: plaid_items,
// plaid_card_accounts, matched_transactions, rebates, settlements,
// restaurant_stripe_accounts.

import {
  pgEnum,
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  time,
  date,
  jsonb,
} from "drizzle-orm/pg-core";

// === Enum types ====================================================

export const userRoleEnum = pgEnum("user_role", ["diner", "merchant", "admin"]);
export const userStatusEnum = pgEnum("user_status", ["active", "suspended", "deleted"]);
// 'astra' = push-to-debit-card (Astra), 'dwolla' = ACH (Dwolla).
export const payoutMethodEnum = pgEnum("payout_method", ["astra", "dwolla"]);
export const restaurantStatusEnum = pgEnum("restaurant_status", ["pending", "approved", "suspended"]);

// `paused` added for offers that hit monthly_budget_cents.
export const offerStatusEnum = pgEnum("offer_status", [
  "draft",
  "scheduled",
  "live",
  "paused",
  "ended",
]);

// `matched` is the rebate-model success state, replacing the older
// `consumed`. `consumed` stays in the enum as a legacy value (Postgres
// can't easily drop enum values once data may reference them); new code
// uses `matched`.
export const claimStatusEnum = pgEnum("claim_status", [
  "claimed",
  "matched",
  "consumed",
  "expired",
  "cancelled",
]);

export const autoApprovalStatusEnum = pgEnum("auto_approval_status", [
  "auto_approved",
  "flagged",
  "rejected",
  "manual_approved",
]);

// Kept around purely so the migration generator doesn't try to resolve
// the dropped `cards` table's enum as a rename of one of the new ones.
// No table references it after the rebate-model rewrite; drop in a
// later migration when convenient.
export const cardStatusEnum = pgEnum("card_status", ["active", "expired", "removed"]);

// Plaid item / account lifecycle.
export const plaidItemStatusEnum = pgEnum("plaid_item_status", ["active", "error", "removed"]);
export const plaidCardStatusEnum = pgEnum("plaid_card_status", ["active", "removed"]);

// Transaction match confidence — output of the matcher.
export const matchConfidenceEnum = pgEnum("match_confidence", [
  "high",
  "medium",
  "low",
  "none",
]);

// Rebate lifecycle (Visa Direct / push payouts).
export const rebateStatusEnum = pgEnum("rebate_status", [
  "initiated",
  "sent",
  "failed",
  "settled",
]);
export const rebateProviderEnum = pgEnum("rebate_provider", [
  "stripe",
  "dwolla",
  "visa_direct",
]);

// Weekly settlement lifecycle (Stripe Connect invoice).
export const settlementStatusEnum = pgEnum("settlement_status", [
  "pending",
  "invoiced",
  "paid",
  "overdue",
]);

// Stripe Connect account state mirror.
export const stripeAccountStatusEnum = pgEnum("stripe_account_status", [
  "pending",
  "restricted",
  "active",
]);

// actor_role extends user_role with `system` for system-emitted audit
// events (cron jobs, webhooks, scripts).
export const actorRoleEnum = pgEnum("actor_role", ["diner", "merchant", "admin", "system"]);

// Shared timestamp columns. Spread into every table that follows the
// pattern.
const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

// === users =========================================================
// Linked to auth.users (Supabase Auth) via the handle_new_user trigger
// in scripts/auth-setup.sql — public.users.id matches auth.users.id.
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Nullable: phone-only diners (SMS OTP sign-up) have no email. UNIQUE
  // still holds — Postgres permits multiple NULLs under a unique index.
  email: text("email").unique(),
  role: userRoleEnum("role").notNull(),
  displayName: text("display_name").notNull(),
  phone: text("phone"),

  // Trust score for diners — informs fraud weighting in the matcher and
  // auto-approval rubric. A+, A, B, etc.
  trustScore: text("trust_score"),

  // Diner cuisine preferences — drives the "For you" home section.
  preferredCuisines: text("preferred_cuisines").array().notNull().default([]),

  // Where the diner chose to receive cash back. Null until they pick on
  // /app/rebates/setup; 'astra' = push to debit card, 'dwolla' = ACH to
  // bank account. Drives which setup screen they bounce to and (later)
  // which send rail rebates use.
  payoutMethod: payoutMethodEnum("payout_method"),

  status: userStatusEnum("status").notNull().default("active"),
  ...timestamps,
});

// === restaurants ===================================================
export const restaurants = pgTable("restaurants", {
  id: uuid("id").primaryKey().defaultRandom(),

  ownerUserId: uuid("owner_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),

  name: text("name").notNull(),
  address: text("address").notNull(),
  neighborhood: text("neighborhood").notNull(),
  city: text("city").notNull(),
  cuisine: text("cuisine").notNull(),

  // Merchant category code — used by the matcher to verify a Plaid
  // transaction's merchant category aligns with the restaurant's
  // declared MCC.
  mcc: text("mcc").notNull(),

  // Public URL of the merchant-uploaded hero photo (Supabase Storage,
  // bucket "restaurant-photos"). Null until they upload one — the UI
  // falls back to a generated placeholder.
  photoUrl: text("photo_url"),

  status: restaurantStatusEnum("status").notNull().default("pending"),
  ...timestamps,
});

// === restaurant_stripe_accounts ====================================
// One Stripe Connect account per restaurant. Created during merchant
// onboarding (Phase 4a). Mirror of Stripe-side state for cheap reads
// without hitting Stripe's API on every page load.
export const restaurantStripeAccounts = pgTable("restaurant_stripe_accounts", {
  // PK is restaurant_id (1:1 with restaurants).
  restaurantId: uuid("restaurant_id")
    .primaryKey()
    .references(() => restaurants.id, { onDelete: "cascade" }),

  stripeAccountId: text("stripe_account_id").notNull().unique(),

  detailsSubmitted: boolean("details_submitted").notNull().default(false),
  chargesEnabled: boolean("charges_enabled").notNull().default(false),
  payoutsEnabled: boolean("payouts_enabled").notNull().default(false),

  status: stripeAccountStatusEnum("status").notNull().default("pending"),

  ...timestamps,
});

// === offers ========================================================
export const offers = pgTable("offers", {
  id: uuid("id").primaryKey().defaultRandom(),

  restaurantId: uuid("restaurant_id")
    .notNull()
    .references(() => restaurants.id, { onDelete: "cascade" }),

  title: text("title").notNull(),
  description: text("description").notNull(),

  // 15–50 (whole-number percent). Bounds enforced in the form layer +
  // a Postgres CHECK constraint added in the migration.
  discountPct: integer("discount_pct").notNull(),

  // Minimum check size to qualify (post-tax total, in cents). Restaurant
  // sets this; typical pilot values are $40–$50.
  minCheckCents: integer("min_check_cents").notNull(),

  // Monthly budget cap (in cents). When monthly_spent_cents >=
  // monthly_budget_cents the offer auto-pauses (status='paused') until
  // the next reset.
  monthlyBudgetCents: integer("monthly_budget_cents").notNull(),
  monthlySpentCents: integer("monthly_spent_cents").notNull().default(0),

  // e.g. ['mon','tue','wed']. Stored as text[].
  validDays: text("valid_days").array().notNull(),

  validStartTime: time("valid_start_time").notNull(),
  validEndTime: time("valid_end_time").notNull(),

  // One-off dates the offer is NOT redeemable.
  blackoutDates: date("blackout_dates").array(),

  // Per-diner cap. Default 1 means each diner can claim this offer
  // once per period.
  maxClaimsPerDiner: integer("max_claims_per_diner").notNull().default(1),

  // Total-activations cap across all diners. Nullable = uncapped. The
  // simplified offer form (post db847ee) always sets a value; older
  // offers can be null. claimOffer rejects with "fully booked" when
  // the count of active claims reaches this number.
  maxClaimsTotal: integer("max_claims_total"),

  status: offerStatusEnum("status").notNull().default("draft"),

  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }),

  ...timestamps,
});

// === claims ========================================================
// A claim is a diner's intent to use an offer. Sits open until a Plaid
// transaction matches (status → matched), the diner cancels, or expires.
export const claims = pgTable("claims", {
  id: uuid("id").primaryKey().defaultRandom(),

  offerId: uuid("offer_id")
    .notNull()
    .references(() => offers.id, { onDelete: "restrict" }),

  dinerUserId: uuid("diner_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),

  claimedAt: timestamp("claimed_at", { withTimezone: true }).defaultNow().notNull(),
  // Typically 24h after claim — gives Plaid time to surface the
  // transaction (most charges post within 1–3 days).
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

  status: claimStatusEnum("status").notNull().default("claimed"),
  ...timestamps,
});

// === plaid_items ===================================================
// A Plaid Item = one bank/issuer connection a diner has. Holds the
// access token (server-only secret) we use to fetch transactions.
export const plaidItems = pgTable("plaid_items", {
  id: uuid("id").primaryKey().defaultRandom(),

  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  plaidItemId: text("plaid_item_id").notNull().unique(),
  // SERVER-ONLY. Access tokens grant transaction-read on the diner's
  // accounts. NEVER expose to a client. RLS denies SELECT to any
  // non-service-role caller (policy in plaid-policies.sql, Phase 4b).
  accessToken: text("access_token").notNull(),

  institutionName: text("institution_name"),

  // Plaid transactionsSync cursor. NULL on first sync — Plaid then
  // returns the full history (capped server-side). After each sync we
  // store the returned `next_cursor` so the next call gets only the
  // delta. Phase 4c: see src/lib/plaid/sync-transactions.ts.
  transactionsCursor: text("transactions_cursor"),

  status: plaidItemStatusEnum("status").notNull().default("active"),
  ...timestamps,
});

// === plaid_card_accounts ===========================================
// Specific card accounts inside a Plaid Item that the diner linked to
// Mealmate. We match Plaid transactions against accounts here.
export const plaidCardAccounts = pgTable("plaid_card_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),

  plaidItemId: uuid("plaid_item_id")
    .notNull()
    .references(() => plaidItems.id, { onDelete: "cascade" }),

  plaidAccountId: text("plaid_account_id").notNull().unique(),

  name: text("name"),           // Plaid's friendly label
  officialName: text("official_name"), // bank's full name
  mask: text("mask"),           // last 4
  brand: text("brand"),         // 'visa', 'mastercard', etc.

  // Plaid's account subtype: 'credit card' or 'checking' in our flows.
  // Used by /app/rebates/setup to filter rebate-eligible (checking)
  // accounts. Nullable for rows linked before Phase 4d.2.
  subtype: text("subtype"),

  isDefault: boolean("is_default").notNull().default(false),
  status: plaidCardStatusEnum("status").notNull().default("active"),
  ...timestamps,
});

// === diner_dwolla_accounts =========================================
// Per-diner Dwolla state. One row per diner, populated lazily the
// first time the diner visits /app/rebates/setup. dwolla_customer_url
// is created via the Dwolla API; default_card_funding_source_url is
// set once the diner adds a debit card via the Dwolla.js iframe.
//
// We don't store the card itself (PAN, expiry, CVV) — those live with
// Dwolla, behind the iframe. We only hold the URL Dwolla gives us to
// reference that card when initiating transfers.
export const dinerDwollaAccounts = pgTable("diner_dwolla_accounts", {
  // PK is user_id (1:1 with users).
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),

  dwollaCustomerUrl: text("dwolla_customer_url").notNull().unique(),
  defaultCardFundingSourceUrl: text("default_card_funding_source_url"),

  ...timestamps,
});

// === diner_astra_accounts ==========================================
// Per-diner Astra (push-to-debit cash-back) state. One row per diner,
// created on the card-connect return after the OAuth code exchange.
// access_token / refresh_token hold the diner's Astra OAuth tokens,
// ENCRYPTED at rest (AES-256-GCM — see src/lib/crypto). card_id is the
// debit card Astra pushes cash back to.
export const dinerAstraAccounts = pgTable("diner_astra_accounts", {
  // PK is user_id (1:1 with users).
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),

  astraUserId: text("astra_user_id"),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  tokenExpiresAt: timestamp("token_expires_at", {
    withTimezone: true,
  }).notNull(),

  cardId: text("card_id"),
  cardLast4: text("card_last4"),

  ...timestamps,
});

// === menu_items ====================================================
// A restaurant's menu — sections of named, priced items. Merchants
// manage these; diners view them on the offer screen.
//
// `discount_eligible` is a vestige from an earlier draft. Mealmate
// discounts are blanket — they apply to the whole check, never to
// specific items — so this column is no longer read or written by
// the app. Left in the schema to avoid a destructive migration.
export const menuItems = pgTable("menu_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  restaurantId: uuid("restaurant_id")
    .notNull()
    .references(() => restaurants.id, { onDelete: "cascade" }),
  section: text("section").notNull(),
  name: text("name").notNull(),
  // Optional one-line description ("Slow-roasted pork, salsa verde").
  // Null/blank until the merchant adds one.
  description: text("description"),
  priceCents: integer("price_cents").notNull(),
  discountEligible: boolean("discount_eligible").notNull().default(false),
  ...timestamps,
});

// === matched_transactions ==========================================
// One row per Plaid transaction we ingest (matched or not). Replaces
// the v1 `payments` table in the rebate model — money math now lives
// here instead of being snapshotted at in-app-pay time.
export const matchedTransactions = pgTable("matched_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Null until / unless we resolve it to an active claim.
  claimId: uuid("claim_id").references(() => claims.id, { onDelete: "set null" }),

  // Which card the diner used (and therefore which Plaid Item).
  plaidCardAccountId: uuid("plaid_card_account_id")
    .notNull()
    .references(() => plaidCardAccounts.id, { onDelete: "restrict" }),

  // Plaid's transaction id (idempotency key).
  plaidTransactionId: text("plaid_transaction_id").notNull().unique(),

  merchantNameRaw: text("merchant_name_raw").notNull(),
  merchantNameNormalized: text("merchant_name_normalized"),

  // Null when unmatched.
  restaurantId: uuid("restaurant_id").references(() => restaurants.id, { onDelete: "set null" }),

  amountCents: integer("amount_cents").notNull(),
  transactionDate: date("transaction_date").notNull(),

  // Plaid PFC (personal-finance category), captured at sync time.
  // Both nullable — Plaid doesn't always populate them, and rows
  // synced before drizzle 0012 stay null. Downstream code should
  // treat null as "unknown — neutral, don't penalise."
  //   transaction_category          — PFC primary (e.g. "FOOD_AND_DRINK")
  //   transaction_category_detailed — PFC detailed (e.g.
  //                                   "FOOD_AND_DRINK_RESTAURANT" vs
  //                                   "FOOD_AND_DRINK_FAST_FOOD_RESTAURANTS")
  // (Classic 4-digit MCC isn't on standard /transactions/sync — it
  // requires Plaid's Enrichment add-on — so we don't capture it.)
  transactionCategory: text("transaction_category"),
  transactionCategoryDetailed: text("transaction_category_detailed"),

  matchConfidence: matchConfidenceEnum("match_confidence").notNull().default("none"),

  // Snapshotted from the offer at match time so historical analysis
  // doesn't depend on the offer being unchanged.
  discountPctAtMatch: integer("discount_pct_at_match"),
  discountCents: integer("discount_cents"),
  platformFeeCents: integer("platform_fee_cents"),
  rebateCents: integer("rebate_cents"),

  autoApprovalStatus: autoApprovalStatusEnum("auto_approval_status"),
  flaggedReasons: text("flagged_reasons").array(),
  reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),

  // Set when ops marks this transaction "not a Mealmate visit" (A3).
  // The matcher skips dismissed rows so it stops re-evaluating them.
  dismissedAt: timestamp("dismissed_at", { withTimezone: true }),

  // Set when this transaction is rolled into a weekly settlement
  // batch (Phase 4e). NULL = approved but not yet settled. A
  // transaction is only ever counted in one settlement.
  settlementId: uuid("settlement_id").references(() => settlements.id, {
    onDelete: "set null",
  }),

  ...timestamps,
});

// === rebates =======================================================
// Visa Direct / Mastercard Send push tracking. One row per matched
// transaction that's been queued for rebate.
export const rebates = pgTable("rebates", {
  id: uuid("id").primaryKey().defaultRandom(),

  matchedTransactionId: uuid("matched_transaction_id")
    .notNull()
    .unique()
    .references(() => matchedTransactions.id, { onDelete: "restrict" }),

  plaidCardAccountId: uuid("plaid_card_account_id")
    .notNull()
    .references(() => plaidCardAccounts.id, { onDelete: "restrict" }),

  amountCents: integer("amount_cents").notNull(),

  provider: rebateProviderEnum("provider").notNull(),
  providerTransferId: text("provider_transfer_id").unique(),

  status: rebateStatusEnum("status").notNull().default("initiated"),

  sentAt: timestamp("sent_at", { withTimezone: true }),
  settledAt: timestamp("settled_at", { withTimezone: true }),
  errorMessage: text("error_message"),

  ...timestamps,
});

// === settlements ===================================================
// Weekly invoice batch. One row per (restaurant, period) — restaurant
// owes Mealmate the sum of discount_cents for matched transactions in
// that period.
export const settlements = pgTable("settlements", {
  id: uuid("id").primaryKey().defaultRandom(),

  restaurantId: uuid("restaurant_id")
    .notNull()
    .references(() => restaurants.id, { onDelete: "restrict" }),

  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),

  totalDiscountCents: integer("total_discount_cents").notNull(),
  transactionCount: integer("transaction_count").notNull(),

  stripeInvoiceId: text("stripe_invoice_id").unique(),

  status: settlementStatusEnum("status").notNull().default("pending"),

  invoicedAt: timestamp("invoiced_at", { withTimezone: true }),
  paidAt: timestamp("paid_at", { withTimezone: true }),

  ...timestamps,
});

// === restaurant_billing_customers ==================================
// Phase 4e: each restaurant gets a Stripe Customer so we can issue
// weekly settlement Invoices. Distinct from restaurant_stripe_accounts
// (the Connect account from Phase 4a) — that one is for Stripe paying
// the restaurant out; this is for us billing the restaurant. Created
// lazily on the first settlement run.
export const restaurantBillingCustomers = pgTable(
  "restaurant_billing_customers",
  {
    // PK is restaurant_id (1:1 with restaurants).
    restaurantId: uuid("restaurant_id")
      .primaryKey()
      .references(() => restaurants.id, { onDelete: "cascade" }),

    stripeCustomerId: text("stripe_customer_id").notNull().unique(),

    ...timestamps,
  },
);

// === audit_log =====================================================
// Append-only event log. Immutability enforced via RLS (no UPDATE, no
// DELETE policies).
export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),

  actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  actorRole: actorRoleEnum("actor_role").notNull(),

  action: text("action").notNull(),
  subjectType: text("subject_type").notNull(),
  subjectId: uuid("subject_id").notNull(),
  metadata: jsonb("metadata"),

  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),

  ...timestamps,
});

// === stripe_events =================================================
// Webhook idempotency table. PK is Stripe's own event id. In the
// rebate model we receive Connect events here (account.updated,
// invoice.paid, transfer.created) rather than PaymentIntent events.
export const stripeEvents = pgTable("stripe_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  payload: jsonb("payload").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).defaultNow().notNull(),
});
