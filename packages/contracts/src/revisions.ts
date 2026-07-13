export type RevisionResourceType = 'entity' | 'session' | 'plot_thread'

export interface RevisionSummary {
  id: string
  resourceType: RevisionResourceType
  resourceId: string
  revisionNumber: number
  /** Always the GM-inclusive shape at write time; omitted/redacted fields
   * for non-GM viewers are handled by the API before this reaches the
   * client, not by the frontend — see RevisionsService.list(). */
  snapshotJson: Record<string, unknown>
  changeSummary: string | null
  createdByUserId: string | null
  createdByDisplayName: string | null
  createdAt: string
}
