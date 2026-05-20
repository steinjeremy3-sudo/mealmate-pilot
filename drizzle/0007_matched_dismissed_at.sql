-- A3: admin "not a MealMate visit" dismissal.
--
-- matched_transactions.dismissed_at — set when ops marks a transaction
-- as not a MealMate visit. The matcher skips dismissed rows so it
-- stops re-evaluating them every run.
--
-- Hand-written (drizzle-kit generate requires a TTY).

ALTER TABLE "matched_transactions" ADD COLUMN "dismissed_at" timestamp with time zone;
