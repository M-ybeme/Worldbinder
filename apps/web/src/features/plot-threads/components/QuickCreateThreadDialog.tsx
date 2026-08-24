import { QuickCreateDialog, TextField } from '@worldbinder/ui'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCreatePlotThreadMutation } from '../hooks/usePlotThreads'

export interface QuickCreateThreadDialogProps {
  campaignId: string
  open: boolean
  onClose: () => void
}

/** Plot-thread counterpart to QuickCreateEntityDialog — title only. */
export function QuickCreateThreadDialog({
  campaignId,
  open,
  onClose,
}: QuickCreateThreadDialogProps) {
  const navigate = useNavigate()
  const createThread = useCreatePlotThreadMutation(campaignId)
  const [title, setTitle] = useState('')

  function handleClose() {
    setTitle('')
    createThread.reset()
    onClose()
  }

  function handleSubmit() {
    if (!title.trim()) return
    createThread.mutate(
      { title },
      {
        onSuccess: (thread) => {
          handleClose()
          navigate(`/app/campaign/${campaignId}/threads/${thread.id}`)
        },
      },
    )
  }

  return (
    <QuickCreateDialog
      open={open}
      onClose={handleClose}
      title="New plot thread"
      onSubmit={handleSubmit}
      submitDisabled={!title.trim()}
      pending={createThread.isPending}
      error={createThread.error?.message}
    >
      <TextField
        id="quick-create-thread-title"
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />
    </QuickCreateDialog>
  )
}
