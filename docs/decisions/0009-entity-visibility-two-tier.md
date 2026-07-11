# ADR-0009: Entity visibility as a two-tier enum, not per-member grants

**Status:** Accepted
**Date:** 2026-07-11

## Context

Milestone 3 introduces entities, the first resource type with real content to protect: a `public_content_json` section every campaign member can read, and a `gm_content_json` section that shouldn't leak to players. The roadmap's fuller data model (§9.9) describes a `resource_visibility_grants` table supporting `GM_ONLY`, `CAMPAIGN_MEMBERS`, `SELECTED_MEMBERS`, and `PRIVATE_TO_AUTHOR` — i.e. visibility grantable per resource, per member, not just per role.

ADR-0008 (Milestone 2) built `CampaignPolicyService.canViewGmContent(role, editorSecretAccess)` but nothing called it yet, and explicitly named "a second policy surface" as the condition for reconsidering a rules-engine-style abstraction instead of a plain policy service. Entities are that second surface.

## Decision

Entities get a `visibility` column with exactly two values: `public` (visible to every active campaign member) and `gm_only` (visible only to roles `canViewGmContent` already allows — owner, GM, and editors with `editorSecretAccess`). No `resource_visibility_grants` table, no per-member grants, no `SELECTED_MEMBERS`/`PRIVATE_TO_AUTHOR` tiers.

This reuses `canViewGmContent` unchanged for two separate decisions on the same entity: whether the entity is visible at all (when `visibility = 'gm_only'`, a player's request 404s — same "don't confirm existence" reasoning as ADR-0008's non-member campaign access), and whether the `gmContentJson` field is included in the response for an otherwise-visible (`public`) entity. Both checks stay "role plus one per-member flag" — the same shape ADR-0008 already established, not a new one.

## Alternatives considered

- **Build `resource_visibility_grants` now:** Matches the roadmap's fuller model and would avoid a later migration. Rejected for this milestone — it's real, unused complexity today: nothing in Milestone 3's UI needs to grant visibility to a specific subset of players, and ADR-0008's own revisit condition ("if the matrix grows past role plus one per-member flag") isn't actually triggered by a second resource type using the _same_ matrix shape, only by a resource that needs a _richer_ one.
- **Skip entity-level visibility, keep only the content-level split:** Would mean every entity's existence (name, type, tags) is visible to all members even if the GM wants an NPC to stay a total secret until revealed. Rejected — "secret NPC" is an ordinary GM workflow the roadmap's `visibility` column (§9.3) already anticipates; dropping it would under-serve a real use case for no simplification benefit (the column costs nothing extra to support once `canViewGmContent` exists).

## Consequences

- Field-level filtering (§13.2) has its first real implementation: `EntityDetail.gmContentJson` is a genuinely optional contract field, included in the response object only when authorized, so an unauthorized response has no such key at all — not `null`. Future resources (sessions, plot threads) with a similar public/GM split should follow the same pattern rather than inventing a new one.
- A `gm_only` entity and a nonexistent entity are indistinguishable to an unauthorized requester (both 404) — consistent with ADR-0008, but means client error handling can't tell "doesn't exist" from "exists, not for you." Acceptable; the alternative (403, revealing existence) is exactly what §13.1 says not to do.
- Editors without `editorSecretAccess` cannot write `gmContentJson` even though they can otherwise edit the entity — this wasn't strictly required by any roadmap section, but follows directly from the read gate: letting someone overwrite a section they can't see would mean editing blind, risking silently destroying real GM notes.

## Revisit conditions

Revisit (and likely build `resource_visibility_grants`) the first time an actual workflow needs visibility narrower than "role tier" — e.g. a plot thread visible to only two specific players, or a secret shared with one player but not the rest of the party. Until then, the two-tier enum covers every real scenario Milestone 3 has.
