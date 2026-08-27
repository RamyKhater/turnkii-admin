CREATE TABLE "project_media" (
	"id" serial PRIMARY KEY NOT NULL,
	"update_id" integer NOT NULL,
	"type" text DEFAULT 'photo' NOT NULL,
	"url" text NOT NULL,
	"caption" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"reason" text,
	"comment" text,
	"ai_caption" text,
	"ai_flags" jsonb,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_signoffs" (
	"id" serial PRIMARY KEY NOT NULL,
	"update_id" integer NOT NULL,
	"ref" text NOT NULL,
	"signed_by_name" text NOT NULL,
	"signed_by_role" text DEFAULT 'Owner' NOT NULL,
	"owner_id" integer,
	"item_count" integer DEFAULT 0 NOT NULL,
	"method" text DEFAULT 'Account sign-off, verified mobile' NOT NULL,
	"amount" integer DEFAULT 0 NOT NULL,
	"signed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"voided_at" timestamp with time zone,
	"voided_reason" text
);
--> statement-breakpoint
ALTER TABLE "project_updates" ADD COLUMN "stage" text;--> statement-breakpoint
ALTER TABLE "project_updates" ADD COLUMN "milestone" text;--> statement-breakpoint
ALTER TABLE "project_updates" ADD COLUMN "amount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "project_updates" ADD COLUMN "payment_id" integer;--> statement-breakpoint
ALTER TABLE "project_updates" ADD COLUMN "sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "project_media" ADD CONSTRAINT "project_media_update_id_project_updates_id_fk" FOREIGN KEY ("update_id") REFERENCES "public"."project_updates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_signoffs" ADD CONSTRAINT "project_signoffs_update_id_project_updates_id_fk" FOREIGN KEY ("update_id") REFERENCES "public"."project_updates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_signoffs" ADD CONSTRAINT "project_signoffs_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE set null ON UPDATE no action;