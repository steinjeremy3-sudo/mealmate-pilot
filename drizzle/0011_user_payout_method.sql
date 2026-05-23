CREATE TYPE "public"."payout_method" AS ENUM('astra', 'dwolla');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "payout_method" "payout_method";
