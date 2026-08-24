CREATE TABLE "entity_favorites" (
	"user_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entity_favorites_user_id_entity_id_unique" UNIQUE("user_id","entity_id")
);
--> statement-breakpoint
ALTER TABLE "entity_favorites" ADD CONSTRAINT "entity_favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_favorites" ADD CONSTRAINT "entity_favorites_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entity_favorites_entity_id_idx" ON "entity_favorites" USING btree ("entity_id");