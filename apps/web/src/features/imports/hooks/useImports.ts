import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CampaignImportSummary } from '@worldbinder/contracts'
import { uploadToStorage } from '../../attachments/lib/uploadToStorage'
import * as importsApi from '../api/importsApi'

const NON_TERMINAL_STATUSES = new Set(['pending', 'validating', 'importing'])

const importKey = (importId: string) => ['imports', importId] as const

/** Orchestrates presign -> direct storage PUT -> complete, same shape as
 * the attachments panel's upload pipeline (uploadToStorage is shared,
 * not duplicated — a plain fetch PUT with no Authorization header, since
 * it hits a different-origin storage endpoint). */
export function useUploadImportMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const { importId, uploadUrl } = await importsApi.presignImport({
        filename: file.name,
        sizeBytes: file.size,
      })
      await uploadToStorage(uploadUrl, file)
      return importsApi.completeImport(importId)
    },
    onSuccess: (summary) => {
      queryClient.setQueryData(importKey(summary.id), summary)
    },
  })
}

export function useImportQuery(importId: string | undefined) {
  return useQuery({
    queryKey: importKey(importId ?? ''),
    queryFn: () => importsApi.getImport(importId as string),
    enabled: !!importId,
    refetchInterval: (query) => {
      const summary = query.state.data as CampaignImportSummary | undefined
      return summary && NON_TERMINAL_STATUSES.has(summary.status) ? 2000 : false
    },
  })
}

export function useConfirmImportMutation(importId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => importsApi.confirmImport(importId),
    onSuccess: (summary) => queryClient.setQueryData(importKey(importId), summary),
  })
}
