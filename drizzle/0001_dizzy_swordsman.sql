CREATE TABLE "handovers" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"location" text,
	"title" text NOT NULL,
	"provider" text,
	"role" text,
	"brand_mark" text,
	"brand_hex" text DEFAULT '#2E4A3A',
	"shots" jsonb DEFAULT '[]'::jsonb,
	"published" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "handovers_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "styles" ADD COLUMN "closeups" jsonb DEFAULT '[]'::jsonb;