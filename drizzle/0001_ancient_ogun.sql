ALTER TABLE "payments" ADD COLUMN "paid_out_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "payout_batch_id" text;