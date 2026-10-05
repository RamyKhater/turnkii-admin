ALTER TABLE "requests" ADD COLUMN "booking_token" text;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "reminded_at" timestamp with time zone;