CREATE TABLE IF NOT EXISTS "map_layers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"map_id" uuid NOT NULL,
	"name" text NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"visibility" "entity_visibility" DEFAULT 'public' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "map_pins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"map_id" uuid NOT NULL,
	"layer_id" uuid,
	"location_entity_id" uuid,
	"label" text,
	"x_normalized" double precision NOT NULL,
	"y_normalized" double precision NOT NULL,
	"visibility" "entity_visibility" DEFAULT 'public' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "maps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"image_attachment_id" uuid,
	"visibility" "entity_visibility" DEFAULT 'public' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "map_layers" ADD CONSTRAINT "map_layers_map_id_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."maps"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "map_pins" ADD CONSTRAINT "map_pins_map_id_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."maps"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "map_pins" ADD CONSTRAINT "map_pins_layer_id_map_layers_id_fk" FOREIGN KEY ("layer_id") REFERENCES "public"."map_layers"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "map_pins" ADD CONSTRAINT "map_pins_location_entity_id_entities_id_fk" FOREIGN KEY ("location_entity_id") REFERENCES "public"."entities"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "maps" ADD CONSTRAINT "maps_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "maps" ADD CONSTRAINT "maps_image_attachment_id_attachments_id_fk" FOREIGN KEY ("image_attachment_id") REFERENCES "public"."attachments"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "map_layers_map_id_idx" ON "map_layers" USING btree ("map_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "map_pins_map_id_idx" ON "map_pins" USING btree ("map_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "map_pins_layer_id_idx" ON "map_pins" USING btree ("layer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "map_pins_location_entity_id_idx" ON "map_pins" USING btree ("location_entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "maps_campaign_id_idx" ON "maps" USING btree ("campaign_id");