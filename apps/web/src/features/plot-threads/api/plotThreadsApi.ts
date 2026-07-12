import type { PlotThreadDetail, PlotThreadSummary } from '@worldbinder/contracts'
import type { CreatePlotThreadInput, UpdatePlotThreadInput } from '@worldbinder/validation'
import { apiDelete, apiGet, apiPatch, apiPost } from '../../../lib/apiClient'

export const listPlotThreads = (campaignId: string): Promise<PlotThreadSummary[]> =>
  apiGet(`/campaigns/${campaignId}/plot-threads`)

export const createPlotThread = (
  campaignId: string,
  input: CreatePlotThreadInput,
): Promise<PlotThreadDetail> => apiPost(`/campaigns/${campaignId}/plot-threads`, input)

export const getPlotThread = (campaignId: string, threadId: string): Promise<PlotThreadDetail> =>
  apiGet(`/campaigns/${campaignId}/plot-threads/${threadId}`)

export const updatePlotThread = (
  campaignId: string,
  threadId: string,
  input: UpdatePlotThreadInput,
): Promise<PlotThreadDetail> => apiPatch(`/campaigns/${campaignId}/plot-threads/${threadId}`, input)

export const deletePlotThread = (
  campaignId: string,
  threadId: string,
): Promise<{ message: string }> => apiDelete(`/campaigns/${campaignId}/plot-threads/${threadId}`)
