-- Add restaurants.statement_descriptors — how the restaurant appears on
-- a diner's card statement, e.g. "La Playa Cafe Bar Bsp Ar". Seeded by
-- the merchant at onboarding and grown automatically from confirmed
-- matches (src/lib/matching/descriptors.ts). The matcher uses these as a
-- high-precision fast-path before falling back to fuzzy name similarity.
--
-- text[] NOT NULL DEFAULT '{}' so existing rows get an empty set.
--
-- Hand-written (drizzle-kit generate requires a TTY).

ALTER TABLE "restaurants"
  ADD COLUMN IF NOT EXISTS "statement_descriptors" text[] NOT NULL DEFAULT '{}'::text[];
