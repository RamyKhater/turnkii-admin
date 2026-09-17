CREATE TABLE "survey_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"project_id" integer,
	"kind" text DEFAULT 'document' NOT NULL,
	"url" text NOT NULL,
	"name" text NOT NULL,
	"content_type" text,
	"size" integer,
	"note" text,
	"uploaded_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "survey_files" ADD CONSTRAINT "survey_files_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_files" ADD CONSTRAINT "survey_files_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_files" ADD CONSTRAINT "survey_files_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;