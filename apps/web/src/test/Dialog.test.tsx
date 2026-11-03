import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Dialog, QuickCreateDialog, TextField } from '@worldbinder/ui'

// Dialog used to set initial focus one animation frame after opening.
// Frames are run by hand, so a regression to deferred focus is caught
// deterministically instead of depending on timing.
let frames: FrameRequestCallback[] = []
beforeEach(() => {
  frames = []
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frames.push(cb)
    return frames.length
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    frames[id - 1] = () => {}
  })
})
afterEach(() => {
  vi.unstubAllGlobals()
})
const runFrames = () => {
  const pending = frames
  frames = []
  pending.forEach((cb) => cb(0))
}

function QuickCreate({ onCreate }: { onCreate: (title: string) => void }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        New session
      </button>
      <QuickCreateDialog
        open={open}
        onClose={() => {
          setTitle('')
          setOpen(false)
        }}
        title="New session"
        onSubmit={() => onCreate(title)}
        submitDisabled={!title.trim()}
      >
        <TextField id="t" label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </QuickCreateDialog>
    </>
  )
}

describe('Dialog initial focus', () => {
  it('doesn’t pull focus away from a field the user already moved into', () => {
    // The race behind the intermittent "quick-create field is empty"
    // failures: a user (or test) focuses the field and starts typing before
    // the next animation frame; the deferred initial focus then moved focus
    // to the Close button, so the rest of the typing went nowhere.
    render(<QuickCreate onCreate={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'New session' }))
    const field = screen.getByLabelText('Title')
    field.focus()
    runFrames()
    expect(field).toHaveFocus()
  })

  it('starts in the dialog’s first field, not on its Close button', () => {
    render(<QuickCreate onCreate={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'New session' }))
    runFrames()
    expect(screen.getByLabelText('Title')).toHaveFocus()
  })

  it('falls back to the first focusable element when there’s no field', () => {
    render(
      <Dialog open onClose={() => {}} title="Confirm">
        <button type="button">OK</button>
      </Dialog>,
    )
    runFrames()
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()
  })

  it('reopening starts fresh and focused on the field', () => {
    render(<QuickCreate onCreate={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'New session' }))
    runFrames()
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Draft' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(screen.getByRole('button', { name: 'New session' }))
    runFrames()
    expect(screen.getByLabelText('Title')).toHaveValue('')
    expect(screen.getByLabelText('Title')).toHaveFocus()
  })
})

describe('QuickCreateDialog submission', () => {
  it('submits the entered value once, even on a repeated submit', () => {
    const onCreate = vi.fn()
    render(<QuickCreate onCreate={onCreate} />)
    fireEvent.click(screen.getByRole('button', { name: 'New session' }))
    runFrames()
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Session 1' } })
    const form = screen.getByLabelText('Title').closest('form')!
    // Two submits in the same tick (a fast double Enter), before React has
    // re-rendered with the request pending.
    fireEvent.submit(form)
    fireEvent.submit(form)
    expect(onCreate).toHaveBeenCalledTimes(1)
    expect(onCreate).toHaveBeenCalledWith('Session 1')
  })

  it('ignores a submit while disabled (e.g. an empty title)', () => {
    const onCreate = vi.fn()
    render(<QuickCreate onCreate={onCreate} />)
    fireEvent.click(screen.getByRole('button', { name: 'New session' }))
    runFrames()
    fireEvent.submit(screen.getByLabelText('Title').closest('form')!)
    expect(onCreate).not.toHaveBeenCalled()
  })
})

describe('Dialog Escape', () => {
  it('closes on an Escape pressed the moment the dialog appears', async () => {
    // A dialog opened by a non-urgent update (e.g. a save failing) is
    // painted before React runs passive effects. Escape pressed in that gap
    // used to be dropped because the listener wasn't attached yet. Press it
    // from a MutationObserver: right after the dialog enters the DOM,
    // before any later task can run effects.
    const g = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    const actEnvironment = g.IS_REACT_ACT_ENVIRONMENT
    g.IS_REACT_ACT_ENVIRONMENT = false
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const onClose = vi.fn()
    const pressed = new Promise<void>((resolve) => {
      const observer = new MutationObserver(() => {
        if (!document.querySelector('[role="dialog"]')) return
        observer.disconnect()
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
        resolve()
      })
      observer.observe(document.body, { childList: true, subtree: true })
    })
    try {
      root.render(
        <Dialog open onClose={onClose} title="Couldn’t save">
          <button type="button">Try again</button>
        </Dialog>,
      )
      await pressed
      expect(onClose).toHaveBeenCalledTimes(1)
    } finally {
      root.unmount()
      host.remove()
      g.IS_REACT_ACT_ENVIRONMENT = actEnvironment
    }
  })
})
