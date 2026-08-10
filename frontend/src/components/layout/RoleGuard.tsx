import { Navigate } from 'react-router'
import { useAuthStore, type UserRole } from '@/store/auth'

interface RoleGuardProps {
  roles: UserRole[]
  children: React.ReactNode
}

export function RoleGuard({ roles, children }: RoleGuardProps) {
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />
  }

  if (!roles.includes(user.role)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
