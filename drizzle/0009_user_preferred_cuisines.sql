-- Diner cuisine preferences.
--
-- users.preferred_cuisines — a text[] of cuisine names the diner has
-- chosen. Drives the "For you" section on the diner home feed. Empty
-- by default; existing rows get '{}'.
--
-- Hand-written (drizzle-kit generate requires a TTY).

ALTER TABLE "users" ADD COLUMN "preferred_cuisines" text[] DEFAULT '{}' NOT NULL;
