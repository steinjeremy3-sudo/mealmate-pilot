// MealMate database schema (Phase 0).
//
// Source of truth: BRIEF.md → "Database schema" section.
// All 8 tables, with Postgres ENUM types for every status field and explicit
// foreign keys so referential integrity lives in the database, not just in TS.
//
// Conventions per BRIEF.md:
//   - All primary keys are uuid default gen_random_uuid()
//   - Every table has created_at + updated_at (timestamptz, default now())
//   - RLS is enabled on every table (done via scripts/enable-rls.ts in Phase 0;
//     actual RLS policies arrive in Phase 1 alongside auth)
//
// PHASE 0 NOTE: schema reaches the DB via `drizzle-kit push` (no migration
// files yet). Per the brief, switch to `generate` + `migrate` before Phase 2,
// once real data exists.

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
// One Postgres ENUM per status field. Drizzle generates the CREATE TYPE.

export const userRoleEnum = pgEnum("user_role", ["diner", "merchant", "admin"]);
export const userStatusEnum = pgEnum("user_status", ["active", "suspended", "deleted"]);
export const restaurantStatusEnum = pgEnum("restaurant_status", ["pending", "approved", "suspended"]);
export const offerStatusEnum = pgEnum("offer_status", ["draft", "scheduled", "live", "ended"]);
export const claimStatusEnum = pgEnum("claim_status", ["claimed", "consumed", "expired", "cancelled"]);
export const autoApprovalStatusEnum = pgEnum("auto_approval_status", [
  "auto_approved",
  "flagged",
  "rejected",
  "manual_approved",
]);
export const cardStatusEnum = pgEnum("card_status", ["active", "expired", "removed"]);

// actor_role extends user_role with `system` for system-emitted audit events
// (cron jobs, webhooks, etc. that aren't attributable to a human user).
export const actorRoleEnum = pgEnum("actor_role", ["diner", "merchant", "admin", "system"]);

// Shared timestamp columns. Spread into every table per BRIEF.md.
const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

// === users =========================================================
// Application-level user record. In Phase 1 this will be linked to
// auth.users (Supabase Auth's managed table) so that signup auto-creates
// a row here. For Phase 0 we just create the table per BRIEF.md.
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  role: userRoleEnum("role").notNull(),
  displayName: text("display_name").notNull(),
  phone: text("phone"),

  // Only populated for diners (used to charge their linked card via Stripe).
  stripeCustomerId: text("stripe_customer_id"),

  // Only meaningful for diners: A+, A, B, etc. Drives fraud/auto-approval signals.
  trustScore: text("trust_score"),

  status: userStatusEnum("status").notNull().default("active"),
  ...timestamps,
});

// === restaurants ===================================================
export const restaurants = pgTable("restaurants", {
  id: uuid("id").primaryKey().defaultRandom(),

  // The merchant user who owns this restaurant. Restrict delete: you can't
  // delete a user who owns a restaurant — suspend it first.
  ownerUserId: uuid("owner_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),

  name: text("name").notNull(),
  address: text("address").notNull(),
  neighborhood: text("neighborhood").notNull(),
  city: text("city").notNull(),
  cuisine: text("cuisine").notNull(),

  // Merchant category code — used by the auto-approval rubric to verify
  // a charge's MCC matches the offer's eligible category.
  mcc: text("mcc").notNull(),

  status: restaurantStatusEnum("status").notNull().default("pending"),
  ...timestamps,
});

// === offers ========================================================
export const offers = pgTable("offers", {
  id: uuid("id").primaryKey().defaultRandom(),

  // If a restaurant is removed, cascade-delete its offers.
  restaurantId: uuid("restaurant_id")
    .notNull()
    .references(() => restaurants.id, { onDelete: "cascade" }),

  title: text("title").notNull(),
  description: text("description").notNull(),

  // 1–99 (whole-number percent). CHECK constraint TODO — Drizzle's pg-core
  // doesn't have a first-class check() yet; add via raw SQL in Phase 1.
  discountPct: integer("discount_pct").notNull(),

  // Minimum subtotal that qualifies for the discount, in cents.
  minSpendCents: integer("min_spend_cents").notNull(),

  // e.g. ['mon','tue','wed']. Stored as text[] in Postgres.
  validDays: text("valid_days").array().notNull(),

  validStartTime: time("valid_start_time").notNull(),
  validEndTime: time("valid_end_time").notNull(),

  // One-off dates the offer is NOT redeemable (holidays, private events).
  blackoutDates: date("blackout_dates").array(),

  // Null = unlimited. Capacity cap across all diners.
  maxClaimsTotal: integer("max_claims_total"),

  // Per-diner cap. Default 1 means each diner can claim this offer once.
  maxClaimsPerDiner: integer("max_claims_per_diner").notNull().default(1),

  status: offerStatusEnum("status").notNull().default("draft"),

  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),

  // Null = open-ended (offer runs until manually ended).
  endsAt: timestamp("ends_at", { withTimezone: true }),

  ...timestamps,
});

// === claims ========================================================
// A claim is a diner reserving an offer before showing up to redeem it.
export const claims = pgTable("claims", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Don't allow deleting an offer that has historical claims.
  offerId: uuid("offer_id")
    .notNull()
    .references(() => offers.id, { onDelete: "restrict" }),

  dinerUserId: uuid("diner_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),

  claimedAt: timestamp("claimed_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

  status: claimStatusEnum("status").notNull().default("claimed"),
  ...timestamps,
});

// === cards =========================================================
// Defined BEFORE `payments` so payments can FK to it.
// A diner's linked credit card, stored as a Stripe payment method.
export const cards = pgTable("cards", {
  id: uuid("id").primaryKey().defaultRandom(),

  // If a user is removed, cascade-remove their cards.
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  // The Stripe-side identifier we use to actually charge.
  stripePaymentMethodId: text("stripe_payment_method_id").notNull(),

  last4: text("last4").notNull(),
  brand: text("brand").notNull(),
  expMonth: integer("exp_month").notNull(),
  expYear: integer("exp_year").notNull(),

  isDefault: boolean("is_default").notNull().default(false),
  status: cardStatusEnum("status").notNull().default("active"),
  ...timestamps,
});

// === payments ======================================================
export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),

  claimId: uuid("claim_id")
    .notNull()
    .references(() => claims.id, { onDelete: "restrict" }),
  cardId: uuid("card_id")
    .notNull()
    .references(() => cards.id, { onDelete: "restrict" }),

  // Stripe PaymentIntent id, e.g. "pi_3MqK...". Used for refunds & reconciliation.
  stripePaymentIntentId: text("stripe_payment_intent_id").notNull(),

  // Money columns in cents (integers — never floats for money).
  subtotalCents: integer("subtotal_cents").notNull(), // pre-discount
  discountCents: integer("discount_cents").notNull(),
  platformFeeCents: integer("platform_fee_cents").notNull(),
  totalCents: integer("total_cents").notNull(),       // what the diner paid
  payoutCents: integer("payout_cents").notNull(),     // what the restaurant receives

  // Output of the 6-rubric auto-approval check (see BRIEF.md).
  autoApprovalStatus: autoApprovalStatusEnum("auto_approval_status").notNull(),

  // Which rubrics failed, if any. e.g. ["timing","min_spend"]
  flaggedReasons: text("flagged_reasons").array(),

  // Set when an admin reviews a flagged payment.
  reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),

  ...timestamps,
});

// === audit_log =====================================================
// Append-only event log. Immutability is enforced via RLS in Phase 1
// (a "no UPDATE / no DELETE" policy), not by schema shape.
export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Nullable for system-emitted events (cron, webhooks, scripts).
  actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  actorRole: actorRoleEnum("actor_role").notNull(),

  action: text("action").notNull(),         // e.g. "offer.created", "payment.succeeded"
  subjectType: text("subject_type").notNull(), // "offer" | "payment" | "restaurant" | ...
  subjectId: uuid("subject_id").notNull(),
  metadata: jsonb("metadata"),

  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),

  ...timestamps,
});

// === stripe_events =================================================
// Webhook idempotency table. Primary key is Stripe's own event id, so
// re-deliveries become no-op upserts. Per BRIEF.md this table does NOT
// have created_at / updated_at — processed_at carries the timestamp.
export const stripeEvents = pgTable("stripe_events", {
  id: text("id").primaryKey(),              // Stripe event id, e.g. "evt_1MqK..."
  type: text("type").notNull(),
  payload: jsonb("payload").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).defaultNow().notNull(),
});
