CREATE TYPE "public"."campaign_audit_event_type" AS ENUM('member_role_changed', 'member_removed', 'content_revealed', 'revision_restored', 'campaign_archived', 'campaign_deleted', 'destructive_action');--> statement-breakpoint
CREATE TYPE "public"."resource_revision_type" AS ENUM('entity', 'session', 'plot_thread');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "campaign_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"type" "campaign_audit_event_type" NOT NULL,
	"actor_user_id" uuid,
	"target_resource_type" text,
	"target_resource_id" uuid,
	"metadata_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "resource_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"resource_type" "resource_revision_type" NOT NULL,
	"resource_id" uuid NOT NULL,
	"revision_number" integer NOT NULL,
	"snapshot_json" jsonb NOT NULL,
	"change_summary" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "campaign_audit_events" ADD CONSTRAINT "campaign_audit_events_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "campaign_audit_events" ADD CONSTRAINT "campaign_audit_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resource_revisions" ADD CONSTRAINT "resource_revisions_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resource_revisions" ADD CONSTRAINT "resource_revisions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "campaign_audit_events_campaign_idx" ON "campaign_audit_events" USING btree ("campaign_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resource_revisions_lookup_idx" ON "resource_revisions" USING btree ("campaign_id","resource_type","resource_id","revision_number");