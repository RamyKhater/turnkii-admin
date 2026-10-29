CREATE TABLE "estimates" (
	"id" serial PRIMARY KEY NOT NULL,
	"ref" text NOT NULL,
	"request_id" integer,
	"owner_id" integer,
	"brief" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tier" text,
	"auto_quotation" integer,
	"auto_breakdown" jsonb DEFAULT '[]'::jsonb,
	"confirmed_quotation" integer,
	"flpp_sheet_ref" text,
	"status" text DEFAULT 'requested' NOT NULL,
	"sla_due_at" timestamp with time zone,
	"signed_off_by" integer,
	"signed_off_at" timestamp with time zone,
	"token" text,
	"customer_url" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "estimates_ref_unique" UNIQUE("ref"),
	CONSTRAINT "estimates_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_signed_off_by_users_id_fk" FOREIGN KEY ("signed_off_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;