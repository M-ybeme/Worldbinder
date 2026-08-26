CREATE TABLE "plot_thread_tags" (
	"plot_thread_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "plot_thread_tags_plot_thread_id_tag_id_unique" UNIQUE("plot_thread_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "session_tags" (
	"session_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "session_tags_session_id_tag_id_unique" UNIQUE("session_id","tag_id")
);
--> statement-breakpoint
ALTER TABLE "plot_thread_tags" ADD CONSTRAINT "plot_thread_tags_plot_thread_id_plot_threads_id_fk" FOREIGN KEY ("plot_thread_id") REFERENCES "public"."plot_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plot_thread_tags" ADD CONSTRAINT "plot_thread_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_tags" ADD CONSTRAINT "session_tags_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_tags" ADD CONSTRAINT "session_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "plot_thread_tags_tag_id_idx" ON "plot_thread_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "session_tags_tag_id_idx" ON "session_tags" USING btree ("tag_id");