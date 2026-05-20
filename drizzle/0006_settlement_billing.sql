-- Phase 4e: weekly settlement billing.
--
-- restaurant_billing_customers: one Stripe Customer per restaurant so
-- we can issue weekly settlement Invoices. Separate from
-- restaurant_stripe_accounts (the Connect account) — that's for Stripe
-- paying the restaurant; this is for us billing the restaurant.
--
-- matched_transactions.settlement_id: marks which weekly batch claimed
-- a transaction. NULL = approved but not yet settled. Ensures a
-- transaction is counted in exactly one settlement.
--
-- Hand-written (drizzle-kit generate requires a TTY).

CREATE TABLE "restaurant_billing_customers" (
  "restaurant_id" uuid PRIMARY KEY NOT NULL,
  "stripe_customer_id" text NOT NULL UNIQUE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "restaurant_billing_customers" ADD CONSTRAINT "restaurant_billing_customers_restaurant_id_restaurants_id_fk"
  FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "matched_transactions" ADD COLUMN "settlement_id" uuid;--> statement-breakpoint

ALTER TABLE "matched_transactions" ADD CONSTRAINT "matched_transactions_settlement_id_settlements_id_fk"
  FOREIGN KEY ("settlement_id") REFERENCES "public"."settlements"("id") ON DELETE set null ON UPDATE no action;
