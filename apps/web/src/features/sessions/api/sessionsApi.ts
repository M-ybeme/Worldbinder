import type {
  CampaignSessionDetail,
  CampaignSessionSummary,
  EntitySummary,
} from '@worldbinder/contracts'
import type {
  CompleteSessionInput,
  CreateSessionInput,
  RevealEntityInput,
  UpdateSessionInput,
} from '@worldbinder/validation'
import { apiDelete, apiGet, apiPatch, apiPost } from '../../../lib/apiClient'

export const listSessions = (campaignId: string): Promise<CampaignSessionSummary[]> =>
  apiGet(`/campaigns/${campaignId}/sessions`)

export const createSession = (
  campaignId: string,
  input: CreateSessionInput,
): Promise<CampaignSessionDetail> => apiPost(`/campaigns/${campaignId}/sessions`, input)

export const getSession = (campaignId: string, sessionId: string): Promise<CampaignSessionDetail> =>
  apiGet(`/campaigns/${campaignId}/sessions/${sessionId}`)

export const updateSession = (
  campaignId: string,
  sessionId: string,
  input: UpdateSessionInput,
): Promise<CampaignSessionDetail> =>
  apiPatch(`/campaigns/${campaignId}/sessions/${sessionId}`, input)

export const deleteSession = (
  campaignId: string,
  sessionId: string,
): Promise<{ message: string }> => apiDelete(`/campaigns/${campaignId}/sessions/${sessionId}`)

export const completeSession = (
  campaignId: string,
  sessionId: string,
  input: CompleteSessionInput,
): Promise<CampaignSessionDetail> =>
  apiPost(`/campaigns/${campaignId}/sessions/${sessionId}/complete`, input)

export const revealEntity = (
  campaignId: string,
  sessionId: string,
  input: RevealEntityInput,
): Promise<EntitySummary> =>
  apiPost(`/campaigns/${campaignId}/sessions/${sessionId}/reveals`, input)
