CREATE TYPE "public"."added_via" AS ENUM('manual', 'discovery');--> statement-breakpoint
CREATE TYPE "public"."flavor_origin" AS ENUM('process', 'added', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."parse_confidence" AS ENUM('HIGH', 'MEDIUM', 'LOW');--> statement-breakpoint
CREATE TYPE "public"."process" AS ENUM('washed', 'natural', 'honey', 'anaerobic', 'carbonic_maceration', 'nitro_washed', 'co_ferment', 'thermal_shock', 'other');--> statement-breakpoint
CREATE TABLE "coffees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"roaster_id" uuid NOT NULL,
	"name" text NOT NULL,
	"origin_country" text,
	"origin_region" text,
	"producer" text,
	"variety" text,
	"process" "process",
	"process_detail" text,
	"flavor_origin" "flavor_origin" DEFAULT 'unknown' NOT NULL,
	"tasting_notes" text[] DEFAULT '{}'::text[] NOT NULL,
	"raw_listing_text" text,
	"listing_url" text,
	"barcode" varchar(64),
	"price_cents" integer,
	"size_grams" integer,
	"parse_confidence" "parse_confidence" DEFAULT 'LOW' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coffees_listing_url_unique" UNIQUE("listing_url"),
	CONSTRAINT "coffees_barcode_unique" UNIQUE("barcode")
);
--> statement-breakpoint
CREATE TABLE "roasters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"website" text,
	"location" text,
	"watched" boolean DEFAULT false NOT NULL,
	"added_via" "added_via" DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coffees" ADD CONSTRAINT "coffees_roaster_id_roasters_id_fk" FOREIGN KEY ("roaster_id") REFERENCES "public"."roasters"("id") ON DELETE no action ON UPDATE no action;