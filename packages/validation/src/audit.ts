import { z } from 'zod'

export const auditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
})
export type AuditQuery = z.infer<typeof auditQuerySchema>
