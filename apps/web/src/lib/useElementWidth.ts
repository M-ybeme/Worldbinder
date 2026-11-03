import { useEffect, useState } from 'react'

/** A callback ref and that element's current content width, kept up to
 * date with a ResizeObserver (window resizes, the sidebar collapsing…).
 * A callback ref, so it follows an element that mounts later (e.g. after
 * data loads). Width is 0 until measured, or without ResizeObserver. */
export function useElementWidth<T extends HTMLElement>(): [(element: T | null) => void, number] {
  const [element, setElement] = useState<T | null>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.round(entry.contentRect.width))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [element])
  return [setElement, width]
}
