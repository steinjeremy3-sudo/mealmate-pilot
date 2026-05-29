-- Add menu_items.description — an optional one-line description a
-- merchant can write for a dish ("Slow-roasted pork, salsa verde,
-- pickled onion"). Null/blank until the merchant adds one; the diner
-- menu screens render it under the item name when present.
--
-- Hand-written (drizzle-kit generate requires a TTY).

ALTER TABLE "menu_items"
  ADD COLUMN IF NOT EXISTS "description" text;
