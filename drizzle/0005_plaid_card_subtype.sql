-- Phase 4d.2: add subtype to plaid_card_accounts.
--
-- Plaid surfaces account subtype on /accounts/get ('credit card',
-- 'checking', etc.). We weren't storing it because Phase 4b only
-- needed credit cards. Phase 4d.2 routes ACH rebates to checking
-- accounts, which means /app/rebates/setup needs to filter by
-- subtype — so we cache it instead of re-fetching from Plaid every
-- page render.
--
-- Nullable: existing rows (linked under Phase 4b) don't have the
-- value; new rows from /app/cards going forward will populate it.
-- The setup page treats NULL as "unknown — show but warn".
--
-- Hand-written (drizzle-kit generate requires a TTY).

ALTER TABLE "plaid_card_accounts" ADD COLUMN "subtype" text;
