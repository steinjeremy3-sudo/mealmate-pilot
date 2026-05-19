-- 2026-05-18: switch from in-app payment (Stripe PaymentIntents) to
-- rebate model (Plaid + Visa Direct + Stripe Connect). Drops cards
-- and payments tables; adds restaurant_stripe_accounts, plaid_items,
-- plaid_card_accounts, matched_transactions, rebates, settlements.
-- Renames offers.min_spend_cents -> min_check_cents and adds monthly
-- budget tracking + discount_pct CHECK.
--
-- Hand-written (drizzle-kit's interactive rename resolver couldn't
-- run without a TTY).

-- ====================================================================
-- 1. Drop legacy tables (payments references cards + claims; drop first)
-- ====================================================================

DROP TABLE IF EXISTS payments;--> statement-breakpoint
DROP TABLE IF EXISTS cards;--> statement-breakpoint


-- ====================================================================
-- 2. Extend existing enums
-- ====================================================================

ALTER TYPE offer_status ADD VALUE IF NOT EXISTS 'paused';--> statement-breakpoint
ALTER TYPE claim_status ADD VALUE IF NOT EXISTS 'matched';--> statement-breakpoint


-- ====================================================================
-- 3. Offers: rename min_spend_cents, add monthly budget + check
-- ====================================================================

ALTER TABLE offers RENAME COLUMN min_spend_cents TO min_check_cents;--> statement-breakpoint

-- Default 100000 ($1000/month) for existing seed offers. New offers
-- will set this explicitly via the merchant form. NOT NULL after.
ALTER TABLE offers ADD COLUMN monthly_budget_cents integer NOT NULL DEFAULT 100000;--> statement-breakpoint
ALTER TABLE offers ADD COLUMN monthly_spent_cents integer NOT NULL DEFAULT 0;--> statement-breakpoint

-- Discount must be 15-50% per BRIEF.md offer constraints. Seed data
-- already conforms.
ALTER TABLE offers ADD CONSTRAINT offers_discount_pct_range
  CHECK (discount_pct BETWEEN 15 AND 50);--> statement-breakpoint

-- max_claims_total was on the v1 schema but isn't in the rebate-model
-- BRIEF. Drop if present.
ALTER TABLE offers DROP COLUMN IF EXISTS max_claims_total;--> statement-breakpoint


-- ====================================================================
-- 4. New enums
-- ====================================================================

CREATE TYPE plaid_item_status AS ENUM ('active', 'error', 'removed');--> statement-breakpoint
CREATE TYPE plaid_card_status AS ENUM ('active', 'removed');--> statement-breakpoint
CREATE TYPE match_confidence AS ENUM ('high', 'medium', 'low', 'none');--> statement-breakpoint
CREATE TYPE rebate_status AS ENUM ('initiated', 'sent', 'failed', 'settled');--> statement-breakpoint
CREATE TYPE rebate_provider AS ENUM ('stripe', 'dwolla', 'visa_direct');--> statement-breakpoint
CREATE TYPE settlement_status AS ENUM ('pending', 'invoiced', 'paid', 'overdue');--> statement-breakpoint
CREATE TYPE stripe_account_status AS ENUM ('pending', 'restricted', 'active');--> statement-breakpoint


-- ====================================================================
-- 5. New tables
-- ====================================================================

CREATE TABLE "restaurant_stripe_accounts" (
  "restaurant_id" uuid PRIMARY KEY NOT NULL,
  "stripe_account_id" text NOT NULL UNIQUE,
  "details_submitted" boolean DEFAULT false NOT NULL,
  "charges_enabled" boolean DEFAULT false NOT NULL,
  "payouts_enabled" boolean DEFAULT false NOT NULL,
  "status" "stripe_account_status" DEFAULT 'pending' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "restaurant_stripe_accounts" ADD CONSTRAINT "restaurant_stripe_accounts_restaurant_id_restaurants_id_fk"
  FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint


CREATE TABLE "plaid_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "plaid_item_id" text NOT NULL UNIQUE,
  "access_token" text NOT NULL,
  "institution_name" text,
  "status" "plaid_item_status" DEFAULT 'active' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "plaid_items" ADD CONSTRAINT "plaid_items_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint


CREATE TABLE "plaid_card_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "plaid_item_id" uuid NOT NULL,
  "plaid_account_id" text NOT NULL UNIQUE,
  "name" text,
  "official_name" text,
  "mask" text,
  "brand" text,
  "is_default" boolean DEFAULT false NOT NULL,
  "status" "plaid_card_status" DEFAULT 'active' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "plaid_card_accounts" ADD CONSTRAINT "plaid_card_accounts_plaid_item_id_plaid_items_id_fk"
  FOREIGN KEY ("plaid_item_id") REFERENCES "public"."plaid_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint


CREATE TABLE "matched_transactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "claim_id" uuid,
  "plaid_card_account_id" uuid NOT NULL,
  "plaid_transaction_id" text NOT NULL UNIQUE,
  "merchant_name_raw" text NOT NULL,
  "merchant_name_normalized" text,
  "restaurant_id" uuid,
  "amount_cents" integer NOT NULL,
  "transaction_date" date NOT NULL,
  "match_confidence" "match_confidence" DEFAULT 'none' NOT NULL,
  "discount_pct_at_match" integer,
  "discount_cents" integer,
  "platform_fee_cents" integer,
  "rebate_cents" integer,
  "auto_approval_status" "auto_approval_status",
  "flagged_reasons" text[],
  "reviewed_by_user_id" uuid,
  "reviewed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "matched_transactions" ADD CONSTRAINT "matched_transactions_claim_id_claims_id_fk"
  FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matched_transactions" ADD CONSTRAINT "matched_transactions_plaid_card_account_id_plaid_card_accounts_id_fk"
  FOREIGN KEY ("plaid_card_account_id") REFERENCES "public"."plaid_card_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matched_transactions" ADD CONSTRAINT "matched_transactions_restaurant_id_restaurants_id_fk"
  FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matched_transactions" ADD CONSTRAINT "matched_transactions_reviewed_by_user_id_users_id_fk"
  FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint


CREATE TABLE "rebates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "matched_transaction_id" uuid NOT NULL UNIQUE,
  "plaid_card_account_id" uuid NOT NULL,
  "amount_cents" integer NOT NULL,
  "provider" "rebate_provider" NOT NULL,
  "provider_transfer_id" text UNIQUE,
  "status" "rebate_status" DEFAULT 'initiated' NOT NULL,
  "sent_at" timestamp with time zone,
  "settled_at" timestamp with time zone,
  "error_message" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "rebates" ADD CONSTRAINT "rebates_matched_transaction_id_matched_transactions_id_fk"
  FOREIGN KEY ("matched_transaction_id") REFERENCES "public"."matched_transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rebates" ADD CONSTRAINT "rebates_plaid_card_account_id_plaid_card_accounts_id_fk"
  FOREIGN KEY ("plaid_card_account_id") REFERENCES "public"."plaid_card_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint


CREATE TABLE "settlements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "restaurant_id" uuid NOT NULL,
  "period_start" date NOT NULL,
  "period_end" date NOT NULL,
  "total_discount_cents" integer NOT NULL,
  "transaction_count" integer NOT NULL,
  "stripe_invoice_id" text UNIQUE,
  "status" "settlement_status" DEFAULT 'pending' NOT NULL,
  "invoiced_at" timestamp with time zone,
  "paid_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "settlements" ADD CONSTRAINT "settlements_restaurant_id_restaurants_id_fk"
  FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint


-- ====================================================================
-- 6. Drop unused users.stripe_customer_id (simulated-payment era)
-- ====================================================================

ALTER TABLE users DROP COLUMN IF EXISTS stripe_customer_id;
