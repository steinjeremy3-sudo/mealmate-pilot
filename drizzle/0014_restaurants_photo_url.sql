-- Add restaurants.photo_url — the public URL of a merchant-uploaded
-- hero photo (Supabase Storage, bucket "restaurant-photos"). Null until
-- the merchant uploads one; the UI falls back to a generated placeholder
-- (see src/components/brand/placeholder-img.tsx).
--
-- Hand-written (drizzle-kit generate requires a TTY).

ALTER TABLE "restaurants"
  ADD COLUMN IF NOT EXISTS "photo_url" text;
