CREATE TYPE "public"."campaign_export_status" AS ENUM('pending', 'processing', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."campaign_import_status" AS ENUM('pending', 'validating', 'dry_run_ready', 'importing', 'completed', 'failed');--> statement-breakpoint
ALTER TYPE "public"."campaign_audit_event_type" ADD VALUE 'campaign_exported';--> statement-breakpoint
ALTER TYPE "public"."campaign_audit_event_type" ADD VALUE 'campaign_imported';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "campaign_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"requested_by_user_id" uuid,
	"status" "campaign_export_status" DEFAULT 'pending' NOT NULL,
	"storage_key" text,
	"size_bytes" integer,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "campaign_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"status" "campaign_import_status" DEFAULT 'pending' NOT NULL,
	"archive_storage_key" text NOT NULL,
	"dry_run_report_json" jsonb,
	"import_report_json" jsonb,
	"result_campaign_id" uuid,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "campaign_exports" ADD CONSTRAINT "campaign_exports_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "campaign_exports" ADD CONSTRAINT "campaign_exports_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "campaign_imports" ADD CONSTRAINT "campaign_imports_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "campaign_imports" ADD CONSTRAINT "campaign_imports_result_campaign_id_campaigns_id_fk" FOREIGN KEY ("result_campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "campaign_exports_campaign_id_idx" ON "campaign_exports" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "campaign_imports_created_by_user_id_idx" ON "campaign_imports" USING btree ("created_by_user_id");