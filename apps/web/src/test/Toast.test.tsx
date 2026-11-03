import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Toast } from '@worldbinder/ui'

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('Toast', () => {
  it('announces its message through a live region that exists before the text', () => {
    render(<Toast message="Removed: A ally of B" onDismiss={() => {}} />)
    const region = screen.getByRole('status')
    expect(region).toHaveTextContent('Removed: A ally of B')
  })

  it('dismisses itself after its duration, but not while hovered', () => {
    const onDismiss = vi.fn()
    render(<Toast message="Removed" durationMs={10_000} onDismiss={onDismiss} />)
    const toast = document.querySelector('.wb-toast')!
    act(() => vi.advanceTimersByTime(4_000))
    fireEvent.mouseEnter(toast)
    act(() => vi.advanceTimersByTime(30_000))
    expect(onDismiss).not.toHaveBeenCalled()
    fireEvent.mouseLeave(toast)
    act(() => vi.advanceTimersByTime(5_900))
    expect(onDismiss).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(200))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('Escape or the close button dismisses it; the action runs on click', () => {
    const onDismiss = vi.fn()
    const onUndo = vi.fn()
    render(
      <Toast
        message="Removed"
        action={{ label: 'Undo', onClick: onUndo }}
        focusAction
        onDismiss={onDismiss}
      />,
    )
    const undo = screen.getByRole('button', { name: 'Undo' })
    expect(undo).toHaveFocus()
    fireEvent.click(undo)
    expect(onUndo).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(undo, { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(onDismiss).toHaveBeenCalledTimes(2)
  })

  it('errors are announced assertively', () => {
    render(<Toast tone="error" message="Couldn’t restore" onDismiss={() => {}} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Couldn’t restore')
  })
})
