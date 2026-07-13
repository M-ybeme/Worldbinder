export type CampaignAuditEventType =
  | 'member_role_changed'
  | 'member_removed'
  | 'content_revealed'
  | 'revision_restored'
  | 'campaign_archived'
  | 'campaign_deleted'
  | 'destructive_action'

export interface CampaignAuditEvent {
  id: string
  type: CampaignAuditEventType
  actorUserId: string | null
  actorDisplayName: string | null
  targetResourceType: string | null
  targetResourceId: string | null
  /** Structured details only — never content bodies (roadmap §11.14). */
  metadataJson: Record<string, unknown> | null
  createdAt: string
}
