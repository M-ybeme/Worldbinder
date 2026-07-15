import type { TimelineEventDetail, TimelineEventSummary } from '@worldbinder/contracts'
import type {
  CreateTimelineEventInput,
  ListTimelineEventsQuery,
  UpdateTimelineEventInput,
} from '@worldbinder/validation'
import { apiDelete, apiGet, apiPatch, apiPost } from '../../../lib/apiClient'

function buildQuery(query: ListTimelineEventsQuery): string {
  const params = new URLSearchParams()
  if (query.entityId) params.set('entityId', query.entityId)
  if (query.sessionId) params.set('sessionId', query.sessionId)
  if (query.tag) params.set('tag', query.tag)
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export const listTimelineEvents = (
  campaignId: string,
  query: ListTimelineEventsQuery = {},
): Promise<TimelineEventSummary[]> =>
  apiGet(`/campaigns/${campaignId}/timeline${buildQuery(query)}`)

export const createTimelineEvent = (
  campaignId: string,
  input: CreateTimelineEventInput,
): Promise<TimelineEventDetail> => apiPost(`/campaigns/${campaignId}/timeline`, input)

export const getTimelineEvent = (
  campaignId: string,
  eventId: string,
): Promise<TimelineEventDetail> => apiGet(`/campaigns/${campaignId}/timeline/${eventId}`)

export const updateTimelineEvent = (
  campaignId: string,
  eventId: string,
  input: UpdateTimelineEventInput,
): Promise<TimelineEventDetail> => apiPatch(`/campaigns/${campaignId}/timeline/${eventId}`, input)

export const deleteTimelineEvent = (
  campaignId: string,
  eventId: string,
): Promise<{ message: string }> => apiDelete(`/campaigns/${campaignId}/timeline/${eventId}`)
