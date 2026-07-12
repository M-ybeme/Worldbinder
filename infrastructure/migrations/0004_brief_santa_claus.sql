CREATE TYPE "public"."wiki_link_section" AS ENUM('public', 'gm');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "entity_relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"source_entity_id" uuid NOT NULL,
	"target_entity_id" uuid NOT NULL,
	"relationship_type_id" uuid NOT NULL,
	"description" text,
	"visibility" "entity_visibility" DEFAULT 'public' NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "entity_wiki_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"source_resource_type" text NOT NULL,
	"source_resource_id" uuid NOT NULL,
	"source_section" "wiki_link_section" NOT NULL,
	"target_entity_id" uuid NOT NULL,
	"display_text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "relationship_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid,
	"key" text NOT NULL,
	"forward_label" text NOT NULL,
	"reverse_label" text NOT NULL,
	"allowed_source_types_json" jsonb,
	"allowed_target_types_json" jsonb,
	"symmetric" boolean DEFAULT false NOT NULL,
	"allow_duplicates" boolean DEFAULT false NOT NULL,
	"default_visibility" "entity_visibility" DEFAULT 'public' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "entity_relationships" ADD CONSTRAINT "entity_relationships_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "entity_relationships" ADD CONSTRAINT "entity_relationships_source_entity_id_entities_id_fk" FOREIGN KEY ("source_entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "entity_relationships" ADD CONSTRAINT "entity_relationships_target_entity_id_entities_id_fk" FOREIGN KEY ("target_entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "entity_relationships" ADD CONSTRAINT "entity_relationships_relationship_type_id_relationship_types_id_fk" FOREIGN KEY ("relationship_type_id") REFERENCES "public"."relationship_types"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "entity_relationships" ADD CONSTRAINT "entity_relationships_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "entity_wiki_links" ADD CONSTRAINT "entity_wiki_links_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "entity_wiki_links" ADD CONSTRAINT "entity_wiki_links_target_entity_id_entities_id_fk" FOREIGN KEY ("target_entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "relationship_types" ADD CONSTRAINT "relationship_types_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "relationship_types_builtin_key_idx" ON "relationship_types" USING btree ("key") WHERE "relationship_types"."campaign_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "relationship_types_campaign_key_idx" ON "relationship_types" USING btree ("campaign_id","key") WHERE "relationship_types"."campaign_id" is not null;