# Data model overview

A narrative companion to `apps/api/src/database/schema.ts` (the authoritative source — this document explains the _why_ behind its shape, not a field-by-field mirror that will drift out of date). See the referenced ADRs for the reasoning behind individual decisions.

## Tenancy: everything hangs off a campaign

A `campaign` is the top-level container — a GM's game. Every piece of campaign content (`entities`, `entity_relationships`, `sessions`, `plot_threads`, `maps`, `timeline_events`, `attachments`, `campaign_exports`, ...) carries a `NOT NULL campaign_id` foreign key back to it, in one shared Postgres schema rather than per-tenant databases (ADR-0015). `campaign_members` joins a `user` to a `campaign` with a `role` (`owner`/`gm`/`editor`/`player`/`viewer`) and a per-member `editor_secret_access` flag — the one place the permission matrix (§5.6) needs more than just a role (see `docs/security/authorization-model.md`).

A campaign also carries its own `calendar_config_json` (null means the default calendar applies — ADR-0018) and `current_world_date_json`, since a campaign's in-world calendar is a property of that campaign, not a global setting.

## Entities: the encyclopedia core

`entities` is the single table behind all 11 entity types (`entityTypeEnum`: character, location, faction, organization, item, deity, creature, event, quest, lore, custom) — one polymorphic table rather than one table per type, since every type shares the same shape (name, slug, aliases, tags, status, visibility, structured `metadata_json`, rich-text content) and differs only in what `metadata_json` holds and how the frontend renders it. `tags`/`entity_tags` is a many-to-many join, shared across campaigns' tag vocabularies where reused.

Content splits at the column level: `public_content_json` (always readable by any member) and `gm_content_json` (only for owner/GM, or an editor with `editor_secret_access`) — both TipTap JSON (ADR-0010), not markdown or HTML. An unauthorized response omits `gm_content_json` entirely rather than sending `null`, so the response shape itself doesn't leak whether hidden content exists (§13.2).

## Relationships and wiki-links: two distinct connection mechanisms

- **`entity_relationships`** — structured, typed, directed edges between two entities (`source_entity_id` → `target_entity_id` via a `relationship_type_id`), the deliberate alternative to a graph database (ADR-0011). `relationship_types` holds the label vocabulary: 14 built-in types shared by every campaign (fixed ids, `campaign_id IS NULL`) plus custom per-campaign types, distinguished by two partial unique indexes on `key` rather than one ordinary unique constraint (Postgres treats every `NULL` as distinct, so a plain `unique(campaign_id, key)` wouldn't stop two built-in rows from colliding).
- **`entity_wiki_links`** — inline mentions extracted from TipTap content (`{ type: 'entityMention', attrs: { entityId, label } }`, ADR-0010) by `WikiLinksService`, recorded separately from `entity_relationships` because a mention isn't a structured relationship — it's "this page's prose happens to reference that entity," the mechanism backlinks are built from. `source_resource_type`/`source_resource_id` generalize beyond entities (today only ever `'entity'` in practice, per Milestone 12's export research finding), so a session recap or plot-thread description mentioning an entity produces the same kind of link.

## Sessions and plot threads: what actually happened, and what's still open

`sessions` (with `session_participants`, `session_entities`, `session_locations`, `session_reveals`) records what happened at the table — recap content, world date, which members/entities/locations were involved, and any GM-triggered reveal of previously-hidden content. `plot_threads` (with `plot_thread_entities`, `session_plot_threads`) tracks ongoing narrative threads through a status lifecycle (`foreshadowed → active → resolved`/`dormant`/`abandoned`), linked to the entities and sessions that advance them.

## Search: two visibility-scoped vectors

`entities`, `sessions`, and `entity_relationships` each carry `tsvector` columns split by visibility tier — `search_vector_public` (name/aliases/tags/summary/public content) and `search_vector_gm` (additionally includes GM-only content) on entities and sessions, one combined `search_vector` on relationships (no public/GM split there, weight D). `timeline_events` and `plot_threads`/`sessions`/`entities` names also get `pg_trgm` GIN trigram indexes for fuzzy matching. The column-level visibility split (ADR-0014) is what makes an unauthorized search simply not query the GM column, rather than filtering results after fetching them — the enforcement mechanism, not just an implementation detail.

## Revisions and audit: two distinct trails

- **`resource_revisions`** — full-content snapshots of entities/sessions/plot-threads on each write (ADR-0013), merged within a same-actor ~30-minute window (`RevisionRecorderService`) so autosave doesn't spam history, always forced open on restore. This is "page history a user browses and can restore from."
- **`campaign_audit_events`** / **`security_events`** — two separate append-only logs, not the same table. Audit events are campaign-level activity (member added, entity deleted, campaign exported) surfaced in-app (`CampaignAuditViewModule`); security events are cross-campaign auth/security telemetry (failed logins, refresh-token reuse) with hashed IPs, used for incident response (`docs/runbooks/security-incident.md`), not shown to end users at all.

## Attachments and maps: files plus their placement

`attachments` is one table for every uploaded file (portraits, handouts, map backgrounds, session images, campaign covers), tracking upload lifecycle status (`pending → uploaded → ready`/`failed`, the last two set asynchronously by `apps/worker`'s magic-byte/dimension detection — ADR-0020) and detected MIME type/dimensions. `resource_attachments` links a ready attachment to the entity/session/plot-thread it belongs to; `campaigns.cover_attachment_id` and `maps`' own image fields are direct FKs instead, since "the campaign's cover image" isn't a many-to-many relationship. `maps`/`map_layers`/`map_pins` model a map as one or more visibility-scoped layers (a public "surface" layer, an optional `gm_only` layer) each with pins linking back to real entities.

## Timeline: campaign history with variable precision

`timeline_events` (with `timeline_event_entities`, `timeline_event_sessions`, `timeline_event_tags`) records both historical backstory and the campaign's own unfolding events, dated with the structured, calendar-aware `TimelineDate` shape (ADR-0018) rather than a native SQL date — supporting year-only or year+month precision plus an `approximate` flag, since not every historical event has (or should imply) an exact known day.

## Export/import: a schema-independent snapshot

`campaign_exports`/`campaign_imports` track background job status (`pending/processing/ready/failed` and `pending/validating/dry_run_ready/importing/completed/failed` respectively) for producing and consuming the versioned zip archive format (ADR-0017, full spec in `docs/architecture/export-format.md`). `campaign_imports` isn't campaign-scoped like everything else in this document — importing _creates_ a campaign, so it can't belong to one yet when the job starts.

## Soft deletion, with two documented exceptions

Most resource tables carry a nullable `deleted_at`, filtered out of normal reads rather than actually removed (ADR-0016) — the product's continuity promise means an accidental delete needs to be recoverable. `maps` and `timeline_events` are the deliberate exception: no `deleted_at` column at all, hard-deleted instead, per the roadmap's own literal column lists for those two resources (flagged directly in `schema.ts`'s comments where those tables are defined).
