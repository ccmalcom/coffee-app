CREATE TYPE "public"."discovery_run_type" AS ENUM('roaster_check', 'web_search');--> statement-breakpoint
CREATE TYPE "public"."equipment_kind" AS ENUM('grinder', 'machine');--> statement-breakpoint
CREATE TYPE "public"."library_status" AS ENUM('candidate', 'wishlist', 'owned', 'finished');--> statement-breakpoint
CREATE TYPE "public"."shot_outcome_tag" AS ENUM('sour', 'bitter', 'weak', 'harsh', 'balanced', 'excellent');--> statement-breakpoint
CREATE TABLE "directives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"goals" text[] DEFAULT '{}'::text[] NOT NULL,
	"free_text" text,
	"exclude_added_flavor" boolean DEFAULT true NOT NULL,
	"edited_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "directives_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "discovery_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "discovery_run_type" NOT NULL,
	"source" text,
	"candidates_found" integer DEFAULT 0 NOT NULL,
	"candidates_created" integer DEFAULT 0 NOT NULL,
	"errors" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "equipment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "equipment_kind" NOT NULL,
	"brand" text,
	"model" text,
	"nickname" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "library_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"coffee_id" uuid NOT NULL,
	"status" "library_status" DEFAULT 'candidate' NOT NULL,
	"rating" integer,
	"review" text,
	"discovery_score" real,
	"discovery_explanation" text,
	"discovered_in_run_id" uuid,
	"acquired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"coffee_id" uuid NOT NULL,
	"grinder_id" uuid NOT NULL,
	"machine_id" uuid NOT NULL,
	"method" varchar(32) DEFAULT 'espresso' NOT NULL,
	"dose_g" real NOT NULL,
	"yield_g" real NOT NULL,
	"time_s" real NOT NULL,
	"grind_setting" text NOT NULL,
	"outcome_tags" "shot_outcome_tag"[] DEFAULT '{}'::shot_outcome_tag[] NOT NULL,
	"note" text,
	"rating" integer,
	"brewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "taste_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"built_at" timestamp with time zone DEFAULT now() NOT NULL,
	"profile" jsonb NOT NULL,
	"stale" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "directives" ADD CONSTRAINT "directives_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_entries" ADD CONSTRAINT "library_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_entries" ADD CONSTRAINT "library_entries_coffee_id_coffees_id_fk" FOREIGN KEY ("coffee_id") REFERENCES "public"."coffees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shots" ADD CONSTRAINT "shots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shots" ADD CONSTRAINT "shots_coffee_id_coffees_id_fk" FOREIGN KEY ("coffee_id") REFERENCES "public"."coffees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shots" ADD CONSTRAINT "shots_grinder_id_equipment_id_fk" FOREIGN KEY ("grinder_id") REFERENCES "public"."equipment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shots" ADD CONSTRAINT "shots_machine_id_equipment_id_fk" FOREIGN KEY ("machine_id") REFERENCES "public"."equipment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taste_profile" ADD CONSTRAINT "taste_profile_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;