ALTER TYPE "public"."proposal_status" ADD VALUE 'changes_requested' BEFORE 'archived';--> statement-breakpoint
ALTER TYPE "public"."proposal_status" ADD VALUE 'rejected' BEFORE 'archived';--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "responded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "response_note" text;