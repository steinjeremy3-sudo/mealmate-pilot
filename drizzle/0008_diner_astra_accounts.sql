-- Push-to-debit cash back: per-diner Astra state.
--
-- One row per diner, created on the card-connect return after the
-- OAuth code exchange. access_token / refresh_token hold the diner's
-- Astra OAuth tokens, ENCRYPTED at rest (AES-256-GCM — see
-- src/lib/crypto). card_id is the connected debit card Astra pushes
-- cash back to; null until the diner connects one.
--
-- Replaces the Dwolla-shaped diner_dwolla_accounts as the cash-back
-- destination store. diner_dwolla_accounts is dropped once the Dwolla
-- teardown lands.
--
-- Hand-written (drizzle-kit generate requires a TTY).

CREATE TABLE "diner_astra_accounts" (
  "user_id" uuid PRIMARY KEY NOT NULL,
  "astra_user_id" text,
  "access_token" text NOT NULL,
  "refresh_token" text NOT NULL,
  "token_expires_at" timestamp with time zone NOT NULL,
  "card_id" text,
  "card_last4" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "diner_astra_accounts" ADD CONSTRAINT "diner_astra_accounts_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
