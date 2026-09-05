CREATE TABLE "referrers" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "referrers_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "referred_by_code" text;