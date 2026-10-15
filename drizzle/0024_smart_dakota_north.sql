CREATE TYPE "public"."project_stage" AS ENUM('lead', 'survey', 'sow_review', 'won', 'scope_locked', 'in_execution', 'certifying', 'handover', 'complete', 'on_hold', 'blocked');--> statement-breakpoint
CREATE TABLE "flpp_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" text,
	"name" text NOT NULL,
	"ticket_ref" text,
	"project_id" integer,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "flpp_events_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "request_id" integer;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "request_ref" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "flpp_ticket_ref" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "stage" "project_stage" DEFAULT 'won' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "pct_complete" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "scope_of_work" ADD COLUMN "project_id" integer;--> statement-breakpoint
ALTER TABLE "flpp_events" ADD CONSTRAINT "flpp_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scope_of_work" ADD CONSTRAINT "scope_of_work_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_flpp_ticket_ref_unique" UNIQUE("flpp_ticket_ref");