ALTER TABLE "scope_of_work" ALTER COLUMN "status" SET DEFAULT 'in_review';--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "flpp_shared_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "scope_of_work" ADD COLUMN "comments" jsonb DEFAULT '[]'::jsonb NOT NULL;