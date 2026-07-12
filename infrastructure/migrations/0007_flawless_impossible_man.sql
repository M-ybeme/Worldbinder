CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
ALTER TABLE "entities" ADD COLUMN "search_vector_public" "tsvector";--> statement-breakpoint
ALTER TABLE "entities" ADD COLUMN "search_vector_gm" "tsvector";--> statement-breakpoint
ALTER TABLE "entity_relationships" ADD COLUMN "search_vector" "tsvector";--> statement-breakpoint
ALTER TABLE "plot_threads" ADD COLUMN "search_vector_public" "tsvector";--> statement-breakpoint
ALTER TABLE "plot_threads" ADD COLUMN "search_vector_gm" "tsvector";--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "search_vector_public" "tsvector";--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "search_vector_gm" "tsvector";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "entities_campaign_id_idx" ON "entities" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "entities_search_vector_public_idx" ON "entities" USING gin ("search_vector_public");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "entities_search_vector_gm_idx" ON "entities" USING gin ("search_vector_gm");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "entities_name_trgm_idx" ON "entities" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "entity_relationships_campaign_id_idx" ON "entity_relationships" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "entity_relationships_search_vector_idx" ON "entity_relationships" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plot_threads_campaign_id_idx" ON "plot_threads" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plot_threads_search_vector_public_idx" ON "plot_threads" USING gin ("search_vector_public");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plot_threads_search_vector_gm_idx" ON "plot_threads" USING gin ("search_vector_gm");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plot_threads_title_trgm_idx" ON "plot_threads" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_campaign_id_idx" ON "sessions" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_search_vector_public_idx" ON "sessions" USING gin ("search_vector_public");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_search_vector_gm_idx" ON "sessions" USING gin ("search_vector_gm");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_title_trgm_idx" ON "sessions" USING gin ("title" gin_trgm_ops);