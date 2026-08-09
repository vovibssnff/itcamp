import { useAuthStore } from '@/store/auth'

export function useAuth() {
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const logout = useAuthStore((s) => s.logout)

  return {
    user,
    isAuthenticated,
    logout,
    role: user?.role,
    isAdmin: user?.role === 'admin',
    isInstructor: user?.role === 'instructor' || user?.role === 'admin',
    isOperator: user?.role === 'operator',
  }
}
