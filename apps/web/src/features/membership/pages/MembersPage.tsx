import { zodResolver } from '@hookform/resolvers/zod'
import { Button, FormMessage, Select, TextField } from '@worldbinder/ui'
import { inviteMemberSchema, type InviteMemberInput } from '@worldbinder/validation'
import { useForm } from 'react-hook-form'
import { useCampaignOutletContext } from '../../campaigns/hooks/useCampaignContext'
import {
  useInvitationsQuery,
  useInviteMemberMutation,
  useMembersQuery,
  useRemoveMemberMutation,
  useRevokeInvitationMutation,
  useUpdateMemberRoleMutation,
} from '../hooks/useCampaignMembers'

const ASSIGNABLE_ROLE_OPTIONS = [
  { value: 'gm', label: 'GM' },
  { value: 'editor', label: 'Editor' },
  { value: 'player', label: 'Player' },
  { value: 'viewer', label: 'Viewer' },
]

const MANAGEMENT_ROLES = new Set(['owner', 'gm'])

export function MembersPage() {
  const { campaign } = useCampaignOutletContext()
  const canManage = MANAGEMENT_ROLES.has(campaign.role)

  const membersQuery = useMembersQuery(campaign.id)
  const invitationsQuery = useInvitationsQuery(campaign.id, canManage)
  const inviteMember = useInviteMemberMutation(campaign.id)
  const revokeInvitation = useRevokeInvitationMutation(campaign.id)
  const updateRole = useUpdateMemberRoleMutation(campaign.id)
  const removeMember = useRemoveMemberMutation(campaign.id)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InviteMemberInput>({ resolver: zodResolver(inviteMemberSchema) })

  const onInvite = handleSubmit((data) => {
    inviteMember.mutate(data, { onSuccess: () => reset() })
  })

  // A GM can manage editors/players/viewers but not another GM (§5.6 —
  // matches CampaignPolicyService.canManageTarget on the backend).
  const canManageMember = (memberRole: string) =>
    canManage && memberRole !== 'owner' && !(campaign.role === 'gm' && memberRole === 'gm')

  return (
    <section>
      <h1>Members</h1>
      {membersQuery.isLoading && <p>Loading members…</p>}
      <ul className="wb-member-list">
        {membersQuery.data?.map((member) => (
          <li key={member.id}>
            <div>
              <div>{member.displayName}</div>
              <div className="wb-member-list__meta">{member.email}</div>
            </div>
            {canManageMember(member.role) ? (
              <div className="wb-member-list__actions">
                <Select
                  aria-label={`Role for ${member.displayName}`}
                  options={ASSIGNABLE_ROLE_OPTIONS}
                  value={member.role}
                  onChange={(event) =>
                    updateRole.mutate({
                      memberId: member.id,
                      input: {
                        role: event.target.value as InviteMemberInput['role'],
                      },
                    })
                  }
                  disabled={updateRole.isPending}
                />
                <Button
                  variant="secondary"
                  onClick={() => removeMember.mutate(member.id)}
                  disabled={removeMember.isPending}
                >
                  Remove
                </Button>
              </div>
            ) : (
              <span className="wb-member-list__role">{member.role}</span>
            )}
          </li>
        ))}
      </ul>

      {canManage && (
        <>
          <h2>Pending invitations</h2>
          <ul className="wb-invitation-list">
            {invitationsQuery.data?.map((invitation) => (
              <li key={invitation.id}>
                <div>
                  {invitation.email} — {invitation.role}
                </div>
                <Button
                  variant="secondary"
                  onClick={() => revokeInvitation.mutate(invitation.id)}
                  disabled={revokeInvitation.isPending}
                >
                  Revoke
                </Button>
              </li>
            ))}
            {invitationsQuery.data?.length === 0 && <li>No pending invitations.</li>}
          </ul>

          <h2>Invite a member</h2>
          <form className="wb-form" onSubmit={onInvite} noValidate>
            <TextField
              label="Email"
              type="email"
              error={errors.email?.message}
              {...register('email')}
            />
            <Select
              label="Role"
              options={ASSIGNABLE_ROLE_OPTIONS}
              error={errors.role?.message}
              {...register('role')}
            />
            <FormMessage message={inviteMember.error?.message} />
            {inviteMember.isSuccess && <FormMessage tone="success" message="Invitation sent." />}
            <Button type="submit" disabled={inviteMember.isPending}>
              {inviteMember.isPending ? 'Sending…' : 'Send invitation'}
            </Button>
          </form>
        </>
      )}
    </section>
  )
}
