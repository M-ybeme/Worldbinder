import { z } from 'zod'
import { emailSchema } from './auth.js'

// Owner is assigned only at campaign creation and transferred out of scope
// for v1 (§5.1) — never selectable through an invite or a role change.
export const assignableCampaignRoleSchema = z.enum(['gm', 'editor', 'player', 'viewer'])

export const inviteMemberSchema = z.object({
  email: emailSchema,
  role: assignableCampaignRoleSchema,
})
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>

export const updateMemberRoleSchema = z.object({
  role: assignableCampaignRoleSchema,
  editorSecretAccess: z.boolean().optional(),
})
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>

export const acceptInvitationSchema = z.object({
  token: z.string().min(1),
})
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>
