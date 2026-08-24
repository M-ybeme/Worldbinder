import { QuickCreateDialog, TextField } from '@worldbinder/ui'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCreateSessionMutation } from '../hooks/useSessions'

export interface QuickCreateSessionDialogProps {
  campaignId: string
  open: boolean
  onClose: () => void
}

/** Session counterpart to QuickCreateEntityDialog — title only, everything
 * else (recap, participants, featured entities, plot-thread changes) is
 * genuinely a "fill in after the session happens" concern, not something
 * a quick-create step should ask for up front. */
export function QuickCreateSessionDialog({
  campaignId,
  open,
  onClose,
}: QuickCreateSessionDialogProps) {
  const navigate = useNavigate()
  const createSession = useCreateSessionMutation(campaignId)
  const [title, setTitle] = useState('')

  function handleClose() {
    setTitle('')
    createSession.reset()
    onClose()
  }

  function handleSubmit() {
    if (!title.trim()) return
    createSession.mutate(
      { title },
      {
        onSuccess: (session) => {
          handleClose()
          navigate(`/app/campaign/${campaignId}/sessions/${session.id}`)
        },
      },
    )
  }

  return (
    <QuickCreateDialog
      open={open}
      onClose={handleClose}
      title="New session"
      onSubmit={handleSubmit}
      submitDisabled={!title.trim()}
      pending={createSession.isPending}
      error={createSession.error?.message}
    >
      <TextField
        id="quick-create-session-title"
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />
    </QuickCreateDialog>
  )
}
