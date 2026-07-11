# ADR-0008: Campaign-scoped authorization via guard chain plus policy service

**Status:** Accepted
**Date:** 2026-07-11

## Context

Milestone 2 introduces multi-tenancy: every campaign resource belongs to exactly one campaign, and a user's rights within it depend on their `campaign_members` role (Owner/GM/Editor/Player/Viewer, roadmap §5.6). Every later milestone's data (entities, sessions, plot threads, maps) hangs off the same `campaignId`, so the enforcement shape decided here becomes the pattern the rest of the API follows. The roadmap's own exit criterion for this milestone is strict: no campaign resource may be reachable outside its tenant boundary, and every protected endpoint must use campaign authorization — not "most."

The permission matrix isn't uniformly role-based, either: a GM has "Limited" settings access and can't act on another GM or the owner; an Editor's visibility into GM-only content depends on a per-member `editor_secret_access` flag, not their role alone. A single coarse role check at the route level can't express that.

## Decision

Split enforcement into two layers, both under `apps/api/src/membership/`, exported for any campaign-scoped module (starting with `campaigns/`, and every future domain module) to import via `MembershipModule`:

1. **`CampaignMembershipGuard`** — resolves `:campaignId` against the caller's active membership row and attaches it to the request (mirrors `JwtAuthGuard`/`@CurrentUser`, adding `@CurrentMembership`). It returns `404 NotFoundException` — never `403` — whether the campaign doesn't exist, is soft-deleted, or the caller simply isn't a member. This is deliberate: a non-member can't distinguish "wrong campaign ID" from "not your campaign," which is what "no resource reachable outside its tenant boundary" actually requires. `CampaignRolesGuard` + `@RequireCampaignRole(...)` sit on top of it for coarse route-level gating (e.g. `owner`-only delete).
2. **`CampaignPolicyService`** — a plain, DB-free class encoding the matrix's finer cells: `canManageTarget(actorRole, targetRole)` (owner acts on anyone but another owner; GM acts on editor/player/viewer but not the owner or a fellow GM), `canViewGmContent(role, editorSecretAccess)`, `canRenameCampaign`, `canManageSettings`, `canArchiveCampaign`, `canDeleteCampaign`. Services call this after the guards have already confirmed membership, for decisions the guard can't make because they depend on a second piece of data (the target member's role, or a per-member flag) that isn't known until the handler runs.

The guard answers "can this request touch this campaign at all"; the policy service answers "can this specific member do this specific thing to this specific target." Neither one alone can express the whole matrix.

## Alternatives considered

- **A single `RolesGuard` with no policy service:** Works for the uniform cases (owner-only delete) but can't express "GM can act on editors but not on another GM" without either a much more elaborate metadata/guard system per route, or leaking that logic into every controller by hand. Rejected — the policy service keeps the matrix in one place, unit-testable as a truth table (`campaign-policy.service.spec.ts`), instead of scattered across controllers.
- **403 for non-members instead of 404:** More conventional REST semantics, but it confirms the campaign exists to someone with no right to know that. Rejected in favor of 404, matching the roadmap's explicit tenant-isolation requirement over convention.
- **CASL or a similar general-purpose authorization library:** Would generalize well as more resource types arrive, but Milestone 2 has exactly one policy surface (campaign membership) and the roadmap principle is "deep, not broad" (§2.5) — pulling in a rules-engine dependency for five methods is premature. Revisit once entities/sessions/threads each need their own visibility rules layered on top of campaign role (§9.9 visibility grants, Milestone 3+).

## Consequences

- Every future campaign-scoped module imports `MembershipModule` and gets `CampaignMembershipGuard` scoped to a real `:campaignId` param for free — the guard is the one and only place that resolves campaign membership from the database, so there's a single implementation to audit for the "always filter by campaignId" rule instead of one per module.
- Field-level filtering (§13.2 — omitting GM-only fields from a player's response entirely) is explicitly out of scope for this ADR. Milestone 2 has no content to filter yet (entities/sessions don't exist); `canViewGmContent` exists on the policy service now so Milestone 3+ can call it without a second design pass, but no serializer uses it yet.
- Ownership transfer is unimplemented: `canManageTarget` and `canChangeRole` both hard-block any operation targeting or promoting to `owner`. A campaign's owner can only be removed by deleting the campaign itself.

## Revisit conditions

Revisit once a second policy surface appears (entity-level visibility grants, §9.9) — if the matrix grows past "role plus one per-member flag," a rules engine or a more general policy abstraction may earn its complexity budget.
