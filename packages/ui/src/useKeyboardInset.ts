import { useEffect, useState } from 'react'

/** How much of the layout viewport the on-screen keyboard covers, while
 * `active`. iOS Safari and Android Chrome shrink only the *visual* viewport
 * when the keyboard opens, so anything `position: fixed; bottom: 0` would
 * sit behind it; offset it by this much to keep it in view. 0 without
 * `visualViewport` (and with no keyboard). */
export function useKeyboardInset(active: boolean): number {
  const [inset, setInset] = useState(0)
  useEffect(() => {
    const viewport = typeof window !== 'undefined' ? window.visualViewport : null
    if (!active || !viewport) return
    const update = () =>
      setInset(Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop)))
    update()
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    return () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
      setInset(0)
    }
  }, [active])
  return inset
}
