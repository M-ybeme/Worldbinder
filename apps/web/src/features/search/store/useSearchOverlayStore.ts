import { create } from 'zustand'

interface SearchOverlayState {
  isOpen: boolean
  open: () => void
  close: () => void
}

/** Overlay open/closed state only, per roadmap §10.2 — the results page's
 * query/filters/pagination stay URL-owned, not routed through here. */
export const useSearchOverlayStore = create<SearchOverlayState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}))
