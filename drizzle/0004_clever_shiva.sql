ALTER TABLE "requests" ADD COLUMN "kind" text DEFAULT 'brief' NOT NULL;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "monthly_income" integer;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "finance_amount" integer;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "employment" text;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "indicative_limit" integer;