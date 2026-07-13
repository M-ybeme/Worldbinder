CREATE TYPE "public"."attachment_status" AS ENUM('pending', 'uploaded', 'processing', 'ready', 'rejected', 'deleted');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"uploaded_by_user_id" uuid,
	"storage_key" text NOT NULL,
	"original_filename" text NOT NULL,
	"detected_mime_type" text,
	"size_bytes" integer NOT NULL,
	"sha256" text,
	"width" integer,
	"height" integer,
	"status" "attachment_status" DEFAULT 'pending' NOT NULL,
	"visibility" "entity_visibility" DEFAULT 'public' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "attachments_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "resource_attachments" (
	"attachment_id" uuid NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" uuid NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"caption" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resource_attachments_attachment_id_resource_type_resource_id_unique" UNIQUE("attachment_id","resource_type","resource_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "attachments" ADD CONSTRAINT "attachments_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resource_attachments" ADD CONSTRAINT "resource_attachments_attachment_id_attachments_id_fk" FOREIGN KEY ("attachment_id") REFERENCES "public"."attachments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attachments_campaign_id_idx" ON "attachments" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attachments_status_idx" ON "attachments" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resource_attachments_resource_idx" ON "resource_attachments" USING btree ("resource_type","resource_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_cover_attachment_id_attachments_id_fk" FOREIGN KEY ("cover_attachment_id") REFERENCES "public"."attachments"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
