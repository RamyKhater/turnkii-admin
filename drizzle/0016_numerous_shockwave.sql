CREATE TABLE "scope_of_work" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"doc_ref" text NOT NULL,
	"request_ref" text,
	"ticket_ref" text,
	"status" text DEFAULT 'shared' NOT NULL,
	"data" jsonb NOT NULL,
	"customer_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scope_of_work_token_unique" UNIQUE("token")
);
