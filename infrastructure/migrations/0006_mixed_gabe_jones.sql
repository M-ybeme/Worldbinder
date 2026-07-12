CREATE TYPE "public"."plot_thread_importance" AS ENUM('minor', 'standard', 'major', 'critical');--> statement-breakpoint
CREATE TYPE "public"."plot_thread_session_action" AS ENUM('introduced', 'advanced', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."plot_thread_status" AS ENUM('foreshadowed', 'active', 'dormant', 'resolved', 'abandoned');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "plot_thread_entities" (
	"plot_thread_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	CONSTRAINT "plot_thread_entities_plot_thread_id_entity_id_unique" UNIQUE("plot_thread_id","entity_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "plot_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"public_content_json" jsonb,
	"gm_content_json" jsonb,
	"status" "plot_thread_status" DEFAULT 'foreshadowed' NOT NULL,
	"importance" "plot_thread_importance" DEFAULT 'standard' NOT NULL,
	"visibility" "entity_visibility" DEFAULT 'public' NOT NULL,
	"introduced_session_id" uuid,
	"last_referenced_session_id" uuid,
	"resolved_session_id" uuid,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "session_plot_threads" (
	"session_id" uuid NOT NULL,
	"plot_thread_id" uuid NOT NULL,
	"action" "plot_thread_session_action" NOT NULL,
	CONSTRAINT "session_plot_threads_session_id_plot_thread_id_unique" UNIQUE("session_id","plot_thread_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "plot_thread_entities" ADD CONSTRAINT "plot_thread_entities_plot_thread_id_plot_threads_id_fk" FOREIGN KEY ("plot_thread_id") REFERENCES "public"."plot_threads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "plot_thread_entities" ADD CONSTRAINT "plot_thread_entities_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "plot_threads" ADD CONSTRAINT "plot_threads_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "plot_threads" ADD CONSTRAINT "plot_threads_introduced_session_id_sessions_id_fk" FOREIGN KEY ("introduced_session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "plot_threads" ADD CONSTRAINT "plot_threads_last_referenced_session_id_sessions_id_fk" FOREIGN KEY ("last_referenced_session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "plot_threads" ADD CONSTRAINT "plot_threads_resolved_session_id_sessions_id_fk" FOREIGN KEY ("resolved_session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "plot_threads" ADD CONSTRAINT "plot_threads_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "plot_threads" ADD CONSTRAINT "plot_threads_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "session_plot_threads" ADD CONSTRAINT "session_plot_threads_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "session_plot_threads" ADD CONSTRAINT "session_plot_threads_plot_thread_id_plot_threads_id_fk" FOREIGN KEY ("plot_thread_id") REFERENCES "public"."plot_threads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
