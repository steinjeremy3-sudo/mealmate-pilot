-- Make users.email nullable.
--
-- Diners can now sign up with a phone number instead of an email (SMS
-- OTP). A phone-only user has no email, so the column can't be NOT NULL.
-- The UNIQUE constraint stays — Postgres allows multiple NULLs under a
-- unique index, so phone-only rows don't collide.
--
-- Hand-written (drizzle-kit generate requires a TTY).

ALTER TABLE "users"
  ALTER COLUMN "email" DROP NOT NULL;
