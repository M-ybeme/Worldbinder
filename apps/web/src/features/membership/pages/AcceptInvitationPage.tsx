import { Button, FormMessage, LoadingState } from '@worldbinder/ui'
import { useNavigate, useParams } from 'react-router-dom'
import {
  useAcceptInvitationMutation,
  useInvitationPreviewQuery,
} from '../hooks/useInvitationAccept'

export function AcceptInvitationPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const previewQuery = useInvitationPreviewQuery(token ?? '')
  const acceptInvitation = useAcceptInvitationMutation()

  if (previewQuery.isLoading) return <LoadingState label="Loading invitation…" />

  if (!token || previewQuery.isError || !previewQuery.data) {
    return (
      <section>
        <h1>Invitation</h1>
        <FormMessage message="This invitation link is invalid or has expired." />
      </section>
    )
  }

  const preview = previewQuery.data

  return (
    <section>
      <h1>Join &quot;{preview.campaignName}&quot;</h1>
      <p>You&apos;ve been invited to join as {preview.role}.</p>
      <FormMessage message={acceptInvitation.error?.message} />
      <Button
        onClick={() =>
          acceptInvitation.mutate(token, {
            onSuccess: (result) => navigate(`/app/campaign/${result.campaignId}`),
          })
        }
        disabled={acceptInvitation.isPending}
      >
        {acceptInvitation.isPending ? 'Joining…' : 'Accept invitation'}
      </Button>
    </section>
  )
}
