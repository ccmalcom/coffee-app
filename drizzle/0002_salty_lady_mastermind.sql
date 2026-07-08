ALTER TABLE "equipment" ADD COLUMN "micro_steps_per_macro_notch" integer;--> statement-breakpoint
ALTER TABLE "shots" ADD COLUMN "grind_macro" real;--> statement-breakpoint
ALTER TABLE "shots" ADD COLUMN "grind_micro" real;--> statement-breakpoint
ALTER TABLE "shots" ADD COLUMN "grind_position" real;