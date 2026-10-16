ALTER TABLE "requests" ADD COLUMN "materials" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "package" text;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "timeline" text;