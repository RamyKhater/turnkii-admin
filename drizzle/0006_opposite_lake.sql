CREATE TABLE "whatsapp_clicks" (
	"id" serial PRIMARY KEY NOT NULL,
	"path" text,
	"referrer" text,
	"channel" text DEFAULT 'WhatsApp' NOT NULL,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"gclid" text,
	"fbclid" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
