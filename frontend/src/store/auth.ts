import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type UserRole = 'admin' | 'instructor' | 'operator'

export interface UserProfile {
  id: string
  username: string
  displayName: string
  role: UserRole
}

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: UserProfile | null
  isAuthenticated: boolean
  setTokens: (access: string, refresh: string) => void
  setUser: (user: UserProfile) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,

      setTokens: (access, refresh) =>
        set({ accessToken: access, refreshToken: refresh, isAuthenticated: true }),

      setUser: (user) => set({ user }),

      logout: () =>
        set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false }),
    }),
    {
      name: 'ktk-auth',
      partialize: (state) => ({
        refreshToken: state.refreshToken,
        user: state.user,
      }),
      // Access tokens are intentionally not persisted. If we have a stored
      // refresh token + user, optimistically treat the session as valid on
      // reload; App bootstrap then exchanges it for a fresh access token.
      onRehydrateStorage: () => (state) => {
        if (state?.refreshToken && state.user) {
          state.isAuthenticated = true
        }
      },
    },
  ),
)
