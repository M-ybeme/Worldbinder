import { Injectable } from '@nestjs/common';
import type { CampaignRole } from '@worldbinder/contracts';

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
}
