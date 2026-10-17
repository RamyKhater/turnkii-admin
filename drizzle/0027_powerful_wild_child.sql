CREATE TABLE "project_handovers" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"summary" text,
	"warranty" text,
	"delivered_by_name" text,
	"delivered_rating" integer,
	"media" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'ready' NOT NULL,
	"signoff_ref" text,
	"signed_by_name" text,
	"signed_at" timestamp with time zone,
	"showcase_token" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_handovers_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
CREATE TABLE "variations" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"ref" text NOT NULL,
	"flpp_vo_id" integer,
	"description" text NOT NULL,
	"amount" integer DEFAULT 0 NOT NULL,
	"bearer" text DEFAULT 'client' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"owner_id" integer,
	"decided_by_name" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "sow_approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "build_cleared_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "delivered_by_name" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "delivered_rating" integer;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "flpp_certified" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "flpp_committed" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "flpp_paid" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "flpp_retention" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "finance_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "project_handovers" ADD CONSTRAINT "project_handovers_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variations" ADD CONSTRAINT "variations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variations" ADD CONSTRAINT "variations_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE set null ON UPDATE no action;