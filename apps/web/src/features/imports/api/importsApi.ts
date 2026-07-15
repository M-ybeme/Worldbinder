import type { CampaignImportSummary, PresignedImportUploadResponse } from '@worldbinder/contracts'
import { apiGet, apiPost } from '../../../lib/apiClient'

export const presignImport = (input: {
  filename: string
  sizeBytes: number
}): Promise<PresignedImportUploadResponse> => apiPost('/imports/presign', input)

export const completeImport = (importId: string): Promise<CampaignImportSummary> =>
  apiPost(`/imports/${importId}/complete`)

export const getImport = (importId: string): Promise<CampaignImportSummary> =>
  apiGet(`/imports/${importId}`)

export const confirmImport = (importId: string): Promise<CampaignImportSummary> =>
  apiPost(`/imports/${importId}/confirm`)
