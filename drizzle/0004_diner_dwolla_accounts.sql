-- Phase 4d.2: per-diner Dwolla state.
--
-- One row per diner. dwolla_customer_url is created via Dwolla's
-- /customers endpoint on the diner's first visit to /app/rebates/setup.
-- default_card_funding_source_url is populated when the diner adds a
-- debit card via the Dwolla.js iframe.
--
-- We never store the card itself — only Dwolla's URL reference to it.
-- The card lives at Dwolla, scoped to their PCI environment.
--
-- Hand-written (drizzle-kit generate requires a TTY).

CREATE TABLE "diner_dwolla_accounts" (
  "user_id" uuid PRIMARY KEY NOT NULL,
  "dwolla_customer_url" text NOT NULL UNIQUE,
  "default_card_funding_source_url" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "diner_dwolla_accounts" ADD CONSTRAINT "diner_dwolla_accounts_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
