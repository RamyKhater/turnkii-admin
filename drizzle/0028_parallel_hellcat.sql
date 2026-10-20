CREATE TABLE "failed_submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"route" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text,
	"contact_name" text,
	"phone" text,
	"email" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"recovered_request_id" integer,
	"handled_by" integer,
	"handled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "failed_submissions" ADD CONSTRAINT "failed_submissions_handled_by_users_id_fk" FOREIGN KEY ("handled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;