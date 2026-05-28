-- Capture Plaid PFC (personal-finance category) on matched_transactions
-- so future scoring can gate on sit-down vs fast-food vs non-food.
--
-- Two nullable text columns:
--   transaction_category           — Plaid PFC `primary`, the high-level
--                                    bucket (e.g. "FOOD_AND_DRINK").
--   transaction_category_detailed  — Plaid PFC `detailed`, the fine
--                                    bucket (e.g. "FOOD_AND_DRINK_RESTAURANT"
--                                    vs "FOOD_AND_DRINK_FAST_FOOD_RESTAURANTS").
--                                    This is the field we'll gate on once
--                                    we trust Plaid's classification here.
--
-- (Plaid's classic 4-digit MCC `merchant_category_code` is not on the
-- standard /transactions/sync payload — it requires the Enrichment
-- add-on — so we don't try to capture it here.)
--
-- Both nullable: existing rows stay null, and downstream code should
-- treat null as "unknown — neutral, don't penalise." New rows after
-- this migration get the values populated from the Plaid sync.
--
-- Hand-written (drizzle-kit generate requires a TTY).

ALTER TABLE "matched_transactions"
  ADD COLUMN IF NOT EXISTS "transaction_category" text,
  ADD COLUMN IF NOT EXISTS "transaction_category_detailed" text;
