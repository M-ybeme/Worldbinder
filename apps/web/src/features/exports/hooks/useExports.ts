import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CampaignExportSummary } from '@worldbinder/contracts'
import * as exportsApi from '../api/exportsApi'

const NON_TERMINAL_STATUSES = new Set(['pending', 'processing'])

const exportsListKey = (campaignId: string) => ['campaigns', campaignId, 'exports'] as const

export function useExportsQuery(campaignId: string) {
  return useQuery({
    queryKey: exportsListKey(campaignId),
    queryFn: () => exportsApi.listExports(campaignId),
    // Keeps the list live while an export is still being built, without
    // the user needing to refresh — same precedent as attachments' panel.
    refetchInterval: (query) => {
      const exports = query.state.data as CampaignExportSummary[] | undefined
      const hasPending = exports?.some((e) => NON_TERMINAL_STATUSES.has(e.status))
      return hasPending ? 2000 : false
    },
  })
}

export function useCreateExportMutation(campaignId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => exportsApi.createExport(campaignId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: exportsListKey(campaignId) }),
  })
}
