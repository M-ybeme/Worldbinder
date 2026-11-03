import { z } from 'zod'
import { ALLOWED_ATTACHMENT_MIME_TYPES, ATTACHMENT_MAX_SIZE_BYTES } from './attachment-detection.js'

export const attachmentResourceTypeSchema = z.enum(['entity', 'session', 'plot_thread'])
export type AttachmentResourceType = z.infer<typeof attachmentResourceTypeSchema>

export const presignAttachmentSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  // Advisory only — the worker's magic-byte detection is the real security
  // boundary, not this client-declared value (roadmap §16.2).
  declaredMimeType: z.enum(ALLOWED_ATTACHMENT_MIME_TYPES),
  sizeBytes: z.coerce.number().int().positive().max(ATTACHMENT_MAX_SIZE_BYTES),
})
export type PresignAttachmentInput = z.infer<typeof presignAttachmentSchema>

export const linkAttachmentSchema = z.object({
  resourceType: attachmentResourceTypeSchema,
  resourceId: z.string().uuid(),
  caption: z.string().trim().max(500).nullable().optional(),
  displayOrder: z.coerce.number().int().min(0).optional(),
})
export type LinkAttachmentInput = z.infer<typeof linkAttachmentSchema>

/** Optional context for deleting an attachment: the resource the request
 * comes from, whose own link doesn't count as "used elsewhere". */
export const deleteAttachmentContextSchema = z
  .object({
    resourceType: attachmentResourceTypeSchema.optional(),
    resourceId: z.string().uuid().optional(),
  })
  .refine((value) => Boolean(value.resourceType) === Boolean(value.resourceId), {
    message: 'resourceType and resourceId go together',
  })
export type DeleteAttachmentContext = z.infer<typeof deleteAttachmentContextSchema>
