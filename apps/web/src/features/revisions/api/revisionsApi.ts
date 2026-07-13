import type { RevisionResourceType, RevisionSummary } from '@worldbinder/contracts'
import { apiGet, apiPost } from '../../../lib/apiClient'

export const listRevisions = (
  campaignId: string,
  resourceType: RevisionResourceType,
  resourceId: string,
): Promise<RevisionSummary[]> =>
  apiGet(`/campaigns/${campaignId}/revisions/${resourceType}/${resourceId}`)

export const restoreRevision = (
  campaignId: string,
  revisionId: string,
): Promise<{ message: string }> =>
  apiPost(`/campaigns/${campaignId}/revisions/${revisionId}/restore`)
