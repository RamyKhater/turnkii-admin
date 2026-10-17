ALTER TYPE "public"."role" ADD VALUE 'finance' BEFORE 'agent';--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "risk_flag" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "risk_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "materials" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "package" text;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "timeline" text;