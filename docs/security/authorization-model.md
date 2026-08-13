# Authorization model

The full role/permission matrix (roadmap §5.6) in one place, with each cell mapped to its real enforcement code — supersedes the brief "Authorization model" section in `docs/security/threat-model.md`, which now points here instead of duplicating this content. See [ADR-0008](../decisions/0008-campaign-scoped-authorization.md) and [ADR-0009](../decisions/0009-entity-visibility-two-tier.md) for the reasoning behind the enforcement mechanism itself.

## Roles

Every campaign member has exactly one role, stored on their `campaign_members` row: **owner**, **gm**, **editor**, **player**, or **viewer** (roadmap §5.1–§5.5). An owner additionally can't be demoted or removed except by deleting the campaign itself — `CampaignPolicyService.canManageTarget`/`canChangeRole` both hard-block any operation targeting or promoting to `owner` (a real, documented gap: ownership transfer is unimplemented, see `docs/product/known-limitations.md`).

Editors get one additional per-member flag, `editor_secret_access` (boolean, off by default), that decides whether _this specific_ editor can see `gm_only` content — set via `PATCH /campaigns/:id/members/:memberId`, not implied by the `editor` role alone.

## Two enforcement layers

1. **Route-level guards** — `CampaignMembershipGuard` resolves `:campaignId` against the caller's real membership row (404, never 403, whether the campaign doesn't exist or the caller just isn't a member — ADR-0008's "don't confirm existence" rule). `CampaignRolesGuard` + `@RequireCampaignRole(...)` sit on top for coarse allow-listing (e.g. owner-only routes).
2. **`CampaignPolicyService`** — a plain, DB-free class (`apps/api/src/membership/campaign-policy.service.ts`) for matrix cells that depend on more than the actor's role: the target's role, a per-member flag, or a fixed policy where the roadmap's matrix says "Optional"/"Configurable" but no per-campaign toggle exists yet (see below). Called from the service layer after the guards have already confirmed membership.

## The matrix

| Capability             | Owner | GM      | Editor         | Player     | Viewer | Enforced by                                                                                                                                      |
| ---------------------- | ----- | ------- | -------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Edit campaign settings | Yes   | Limited | No             | No         | No     | `canManageSettings`, `canRenameCampaign` (rename is owner-only even though GM has "Limited" settings access)                                     |
| Invite/remove members  | Yes   | Yes     | No             | No         | No     | `canManageMembers`, `canManageTarget` (owner acts on anyone but another owner; GM acts on editor/player/viewer but not the owner or a fellow GM) |
| Change roles           | Yes   | Limited | No             | No         | No     | `canChangeRole` (same `canManageTarget` rule; no one can promote to `owner`)                                                                     |
| View GM-only content   | Yes   | Yes     | Configurable   | No         | No     | `canViewGmContent(role, editorSecretAccess)`                                                                                                     |
| Create/edit entities   | Yes   | Yes     | Yes            | Optional\* | No     | `canEditEntities`                                                                                                                                |
| Create/edit sessions   | Yes   | Yes     | Yes            | No         | No     | `canEditSessions`                                                                                                                                |
| Manage plot threads    | Yes   | Yes     | Yes            | No         | No     | `canManagePlotThreads`                                                                                                                           |
| Manage attachments     | Yes   | Yes     | Yes            | No         | No     | `canManageAttachments`                                                                                                                           |
| Manage maps            | Yes   | Yes     | Yes            | No         | No     | `canManageMaps`                                                                                                                                  |
| Manage timeline        | Yes   | Yes     | Yes            | No         | No     | `canManageTimeline`                                                                                                                              |
| View visible threads   | Yes   | Yes     | Yes            | Yes        | Yes    | route-level guard only — every active member can read what's visible to them                                                                     |
| Reveal content         | Yes   | Yes     | No             | No         | No     | `canRevealContent` (unlike editing, an editor cannot flip a secret to public)                                                                    |
| Export campaign        | Yes   | Yes     | Configurable\* | No         | No     | `canExportCampaign`                                                                                                                              |
| Archive campaign       | Yes   | Yes     | No             | No         | No     | `canArchiveCampaign`                                                                                                                             |
| Delete campaign        | Yes   | No      | No             | No         | No     | `canDeleteCampaign` (owner only)                                                                                                                 |

\* **"Optional" (player entity editing) and "Configurable" (editor export access)** are the roadmap's own words for matrix cells v1 deliberately doesn't build a per-campaign toggle for yet. Both currently resolve to their safer default — players stay read-only, export stays owner/GM-only — documented directly in `campaign-policy.service.ts`'s comments rather than left as a silent gap. If a real workflow ever needs the toggle, it's additive (a new settings field plus a guard change), not a redesign.

## Content visibility (entities, relationships, wiki-links)

Independent of the role matrix above: entities, relationships, and wiki-link backlinks each carry a `visibility` of `public` or `gm_only` (ADR-0009), gated by the same `canViewGmContent` check. This is deliberately a flat two-tier enum, not per-member grants (`SELECTED_MEMBERS`/`PRIVATE_TO_AUTHOR` from the roadmap's fuller §9.9 model) — revisit only once a real workflow needs visibility narrower than "role tier," per ADR-0009's own revisit condition.

Two rules apply uniformly everywhere visibility is checked:

- A `gm_only` resource and a nonexistent resource are indistinguishable to an unauthorized requester — both 404, never 403 (§13.1: don't confirm existence).
- An unauthorized response _omits_ the `gmContentJson`/hidden field entirely rather than sending `null` — the response shape itself doesn't leak whether hidden content exists (§13.2).

## The API is the source of truth

"The API must make the final permission decision. UI checks exist only to improve usability" (roadmap §5.6, verbatim). Every permission check described above is enforced server-side; frontend role checks (e.g. hiding a "Settings" nav link for non-managers) are a UX convenience, never the actual gate — verified directly in Milestone 14 Phase 1's authorization audit, which spot-checked every controller (entities, sessions, maps, attachments, membership, exports) for both enforcement layers being present, and in the Milestone 15 demo campaign's own scripted GM-vs-player verification pass.
