CREATE INDEX "campaign_invitations_campaign_id_idx" ON "campaign_invitations" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "campaign_invitations_token_hash_idx" ON "campaign_invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "campaign_members_user_id_idx" ON "campaign_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "email_verification_tokens_token_hash_idx" ON "email_verification_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "entity_tags_tag_id_idx" ON "entity_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "entity_wiki_links_source_idx" ON "entity_wiki_links" USING btree ("source_resource_type","source_resource_id");--> statement-breakpoint
CREATE INDEX "entity_wiki_links_target_idx" ON "entity_wiki_links" USING btree ("campaign_id","target_entity_id");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_token_hash_idx" ON "password_reset_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "session_entities_entity_id_idx" ON "session_entities" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "session_locations_entity_id_idx" ON "session_locations" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "session_plot_threads_plot_thread_id_idx" ON "session_plot_threads" USING btree ("plot_thread_id");--> statement-breakpoint
CREATE INDEX "timeline_event_entities_entity_id_idx" ON "timeline_event_entities" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "timeline_event_sessions_session_id_idx" ON "timeline_event_sessions" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "timeline_event_tags_tag_id_idx" ON "timeline_event_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "timeline_events_title_trgm_idx" ON "timeline_events" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "user_sessions_user_id_idx" ON "user_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_sessions_token_family_id_idx" ON "user_sessions" USING btree ("token_family_id");