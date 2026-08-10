import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { canAccessRoute } from '../utils/constants'

export default function ProtectedRoute({ children, allowedRoles, path }) {
  const { isAuthenticated, user } = useAuth()

  if (!isAuthenticated) return <Navigate to="/login" replace />

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />
  }

  if (path && user && !canAccessRoute(user.role, path)) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}
