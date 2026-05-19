-- Phase 4c: add transactions_cursor column to plaid_items.
--
-- Plaid's transactionsSync API is cursor-based: pass the previous
-- cursor and get only added/modified/removed transactions since.
-- NULL = first sync, returns full history (capped server-side).
--
-- Hand-written (drizzle-kit's interactive resolver couldn't run
-- without a TTY — same workaround as 0002_rebate_model.sql).

ALTER TABLE "plaid_items" ADD COLUMN "transactions_cursor" text;
