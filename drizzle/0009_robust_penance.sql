CREATE TYPE "public"."proposal_status" AS ENUM('draft', 'sent', 'viewed', 'approved', 'archived');--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"title" text NOT NULL,
	"client_name" text,
	"status" "proposal_status" DEFAULT 'draft' NOT NULL,
	"intro" text,
	"style_name" text,
	"palette" text,
	"direction_note" text,
	"images" jsonb DEFAULT '[]'::jsonb,
	"scope_items" jsonb DEFAULT '[]'::jsonb,
	"price_label" text,
	"financing_note" text,
	"timeline_items" jsonb DEFAULT '[]'::jsonb,
	"timeline_note" text,
	"cta_type" text,
	"cta_label" text,
	"cta_value" text,
	"created_by" integer,
	"viewed_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proposals_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;