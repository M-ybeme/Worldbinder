import type { AuthUser } from '@worldbinder/contracts'
import { create } from 'zustand'

interface AuthState {
  status: 'idle' | 'authenticated' | 'unauthenticated'
  accessToken: string | null
  user: AuthUser | null
  setSession: (accessToken: string, user: AuthUser) => void
  clearSession: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'idle',
  accessToken: null,
  user: null,
  setSession: (accessToken, user) => set({ status: 'authenticated', accessToken, user }),
  clearSession: () => set({ status: 'unauthenticated', accessToken: null, user: null }),
}))
