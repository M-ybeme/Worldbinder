CREATE TYPE "public"."timeline_date_precision" AS ENUM('year', 'month', 'day');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "timeline_event_entities" (
	"timeline_event_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	CONSTRAINT "timeline_event_entities_timeline_event_id_entity_id_unique" UNIQUE("timeline_event_id","entity_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "timeline_event_sessions" (
	"timeline_event_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	CONSTRAINT "timeline_event_sessions_timeline_event_id_session_id_unique" UNIQUE("timeline_event_id","session_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "timeline_event_tags" (
	"timeline_event_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "timeline_event_tags_timeline_event_id_tag_id_unique" UNIQUE("timeline_event_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "timeline_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"content_json" jsonb,
	"start_date_json" jsonb,
	"end_date_json" jsonb,
	"date_precision" timeline_date_precision,
	"visibility" "entity_visibility" DEFAULT 'public' NOT NULL,
	"search_vector" "tsvector",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "calendar_config_json" jsonb;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "timeline_event_entities" ADD CONSTRAINT "timeline_event_entities_timeline_event_id_timeline_events_id_fk" FOREIGN KEY ("timeline_event_id") REFERENCES "public"."timeline_events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "timeline_event_entities" ADD CONSTRAINT "timeline_event_entities_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "timeline_event_sessions" ADD CONSTRAINT "timeline_event_sessions_timeline_event_id_timeline_events_id_fk" FOREIGN KEY ("timeline_event_id") REFERENCES "public"."timeline_events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "timeline_event_sessions" ADD CONSTRAINT "timeline_event_sessions_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "timeline_event_tags" ADD CONSTRAINT "timeline_event_tags_timeline_event_id_timeline_events_id_fk" FOREIGN KEY ("timeline_event_id") REFERENCES "public"."timeline_events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "timeline_event_tags" ADD CONSTRAINT "timeline_event_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_events_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "timeline_events_campaign_id_idx" ON "timeline_events" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "timeline_events_search_vector_idx" ON "timeline_events" USING gin ("search_vector");