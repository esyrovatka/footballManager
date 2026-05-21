ALTER TABLE "clubs" ADD COLUMN "default_formation" "formation";--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "default_style" "style";--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "default_starters" uuid[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "default_subs" uuid[] DEFAULT '{}' NOT NULL;