CREATE TABLE "showcase_ratings" (
	"id" serial PRIMARY KEY NOT NULL,
	"showcase_id" integer NOT NULL,
	"item_index" integer NOT NULL,
	"value" integer NOT NULL,
	"voter" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "showcase_ratings" ADD CONSTRAINT "showcase_ratings_showcase_id_showcases_id_fk" FOREIGN KEY ("showcase_id") REFERENCES "public"."showcases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "showcase_rating_voter_uq" ON "showcase_ratings" USING btree ("showcase_id","item_index","voter");