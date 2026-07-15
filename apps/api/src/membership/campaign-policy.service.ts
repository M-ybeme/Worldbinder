import { Injectable } from '@nestjs/common';
import type { CampaignRole, EntityVisibility } from '@worldbinder/contracts';

const MANAGEMENT_ROLES: CampaignRole[] = ['owner', 'gm'];
const ENTITY_EDITOR_ROLES: CampaignRole[] = ['owner', 'gm', 'editor'];

/**
 * Encodes the §5.6 permission matrix. Route-level access is a coarse
 * `@RequireCampaignRole` guard; this service handles the matrix's
 * finer-grained cells (GM "Limited", Editor "Configurable") that depend on
 * the target of the action, not just the actor's role.
 */
@Injectable()
export class CampaignPolicyService {
  canManageMembers(role: CampaignRole): boolean {
    return MANAGEMENT_ROLES.includes(role);
  }

  /**
   * Owner may act on anyone but another owner (ownership transfer is out of
   * scope for v1 — §5.1). GM may act on editors/players/viewers but not the
   * owner or a fellow GM. Editors/players/viewers have no management rights.
   */
  canManageTarget(actorRole: CampaignRole, targetRole: CampaignRole): boolean {
    if (targetRole === 'owner') return false;
    if (actorRole === 'owner') return true;
    if (actorRole === 'gm') return targetRole !== 'gm';
    return false;
  }

  canChangeRole(
    actorRole: CampaignRole,
    targetCurrentRole: CampaignRole,
    newRole: CampaignRole,
  ): boolean {
    if (newRole === 'owner') return false;
    return this.canManageTarget(actorRole, targetCurrentRole);
  }

  canRemoveMember(actorRole: CampaignRole, targetRole: CampaignRole): boolean {
    return this.canManageTarget(actorRole, targetRole);
  }

  /** Editor visibility into GM-only content follows their per-member flag (§5.3). */
  canViewGmContent(role: CampaignRole, editorSecretAccess: boolean): boolean {
    if (role === 'owner' || role === 'gm') return true;
    if (role === 'editor') return editorSecretAccess;
    return false;
  }

  canManageSettings(role: CampaignRole): boolean {
    return MANAGEMENT_ROLES.includes(role);
  }

  /** Renaming (name/slug) stays owner-only even though GM has "Limited" settings access. */
  canRenameCampaign(role: CampaignRole): boolean {
    return role === 'owner';
  }

  canArchiveCampaign(role: CampaignRole): boolean {
    return MANAGEMENT_ROLES.includes(role);
  }

  canDeleteCampaign(role: CampaignRole): boolean {
    return role === 'owner';
  }

  /**
   * Player is "Optional" for entity editing per §5.6, but v1 has no
   * per-campaign toggle for that yet — Player/Viewer stay read-only until
   * one is designed.
   */
  canEditEntities(role: CampaignRole): boolean {
    return ENTITY_EDITOR_ROLES.includes(role);
  }

  /** Same actor set as `canEditEntities` (§5.6's "Create/edit sessions" row)
   * — kept as its own method since it's a distinct capability the matrix
   * could diverge on later, not because the logic differs today. */
  canEditSessions(role: CampaignRole): boolean {
    return ENTITY_EDITOR_ROLES.includes(role);
  }

  /** "Reveal content" is owner/GM only per §5.6 — unlike editing sessions
   * or entities, an editor cannot flip a secret to public. */
  canRevealContent(role: CampaignRole): boolean {
    return MANAGEMENT_ROLES.includes(role);
  }

  /** §5.6's permission matrix marks Editor "Configurable" for exporting a
   * campaign — same "no v1 per-campaign toggle yet" position as
   * `canEditEntities`'s Player row, so it defaults to the safer of the two
   * options (owner/GM only) until that toggle is designed. */
  canExportCampaign(role: CampaignRole): boolean {
    return MANAGEMENT_ROLES.includes(role);
  }

  /** Same actor set as `canEditEntities`/`canEditSessions` (§5.6's "Manage
   * plot threads" row). */
  canManagePlotThreads(role: CampaignRole): boolean {
    return ENTITY_EDITOR_ROLES.includes(role);
  }

  /** Same actor set as `canEditEntities`/`canEditSessions`/
   * `canManagePlotThreads` — kept as its own method for the same reason:
   * a distinct capability the matrix could diverge on later. */
  canManageAttachments(role: CampaignRole): boolean {
    return ENTITY_EDITOR_ROLES.includes(role);
  }

  /** Same actor set as canEditEntities/canEditSessions/canManagePlotThreads/
   * canManageAttachments — kept as its own method per the existing
   * "distinct capability that could diverge later" convention. */
  canManageMaps(role: CampaignRole): boolean {
    return ENTITY_EDITOR_ROLES.includes(role);
  }

  /** Same actor set as canEditEntities/canEditSessions/canManagePlotThreads/
   * canManageAttachments/canManageMaps — kept as its own method per the
   * existing "distinct capability that could diverge later" convention. */
  canManageTimeline(role: CampaignRole): boolean {
    return ENTITY_EDITOR_ROLES.includes(role);
  }

  /**
   * Shared two-tier visibility check (ADR-0009): `public` is visible to
   * every member, `gm_only` follows the same GM-content rule as entities.
   * Used for entities themselves, relationships, and wiki-link backlinks so
   * "hidden content does not leak" means the same thing everywhere it's
   * checked (roadmap §13, Milestone 4 exit criteria).
   */
  canViewVisibility(
    visibility: EntityVisibility,
    role: CampaignRole,
    editorSecretAccess: boolean,
  ): boolean {
    return (
      visibility === 'public' || this.canViewGmContent(role, editorSecretAccess)
    );
  }
}
