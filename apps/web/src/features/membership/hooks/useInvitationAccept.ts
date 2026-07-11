import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as membersApi from '../api/membersApi'

export function useInvitationPreviewQuery(token: string) {
  return useQuery({
    queryKey: ['invitations', token],
    queryFn: () => membersApi.previewInvitation(token),
    enabled: !!token,
    retry: false,
  })
}

export function useAcceptInvitationMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (token: string) => membersApi.acceptInvitation(token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campaigns'] }),
  })
}
