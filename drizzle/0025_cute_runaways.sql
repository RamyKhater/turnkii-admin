ALTER TYPE "public"."role" ADD VALUE 'project_manager' BEFORE 'agent';--> statement-breakpoint
ALTER TABLE "project_updates" ADD COLUMN "flpp_actor" text;