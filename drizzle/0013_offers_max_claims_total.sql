-- Add offers.max_claims_total — the merchant-facing cap on total
-- activations across all diners. When ≥ this number of claims are
-- active, the diner-facing claim flow rejects with "fully booked"
-- (see src/app/app/offers/[id]/actions.ts).
--
-- This column was referenced in the offer-creation action and the
-- claim cap check but never made it into the schema. Every published
-- offer was silently failing on a "column does not exist" insert.
--
-- Nullable: pre-existing offers (none today after the seed wipe, but
-- worth keeping safe) stay null = uncapped. New offers always set a
-- value via the simplified offer form.
--
-- Hand-written (drizzle-kit generate requires a TTY).

ALTER TABLE "offers"
  ADD COLUMN IF NOT EXISTS "max_claims_total" integer;
