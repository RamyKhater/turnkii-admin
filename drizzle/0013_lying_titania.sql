CREATE TYPE "public"."showcase_status" AS ENUM('draft', 'shared', 'viewed', 'archived');--> statement-breakpoint
CREATE TABLE "showcases" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"title" text NOT NULL,
	"subtitle" text,
	"intro" text,
	"status" "showcase_status" DEFAULT 'draft' NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb,
	"cta_label" text,
	"cta_href" text,
	"created_by" integer,
	"viewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "showcases_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "showcases" ADD CONSTRAINT "showcases_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;