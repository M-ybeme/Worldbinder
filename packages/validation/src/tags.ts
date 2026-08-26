import { z } from 'zod'

export const renameTagSchema = z.object({
  name: z.string().trim().min(1).max(50),
})
export type RenameTagInput = z.infer<typeof renameTagSchema>

export const mergeTagSchema = z.object({
  targetTagId: z.string().uuid(),
})
export type MergeTagInput = z.infer<typeof mergeTagSchema>
