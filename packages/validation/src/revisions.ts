import { z } from 'zod'

export const revisionResourceTypeSchema = z.enum(['entity', 'session', 'plot_thread'])
export type RevisionResourceType = z.infer<typeof revisionResourceTypeSchema>
