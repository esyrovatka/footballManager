ALTER TABLE "clubs" ADD COLUMN "invite_code" text;--> statement-breakpoint
ALTER TABLE "clubs" ADD CONSTRAINT "clubs_invite_code_unique" UNIQUE("invite_code");