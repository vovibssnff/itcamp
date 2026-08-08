import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore, type UserProfile } from './auth'

const user: UserProfile = { id: 'u1', username: 'op', displayName: 'Op', role: 'operator' }

describe('authStore', () => {
  beforeEach(() => useAuthStore.getState().logout())

  it('starts unauthenticated', () => {
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })

  it('sets tokens and marks authenticated', () => {
    useAuthStore.getState().setTokens('access', 'refresh')
    const state = useAuthStore.getState()
    expect(state.accessToken).toBe('access')
    expect(state.refreshToken).toBe('refresh')
    expect(state.isAuthenticated).toBe(true)
  })

  it('sets user profile', () => {
    useAuthStore.getState().setUser(user)
    expect(useAuthStore.getState().user?.role).toBe('operator')
  })

  it('logout clears everything', () => {
    const s = useAuthStore.getState()
    s.setTokens('a', 'r')
    s.setUser(user)
    s.logout()
    const state = useAuthStore.getState()
    expect(state.accessToken).toBeNull()
    expect(state.user).toBeNull()
    expect(state.isAuthenticated).toBe(false)
  })
})
