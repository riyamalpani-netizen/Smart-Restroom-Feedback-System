import { createContext, useContext, useState, useCallback } from 'react'
import { DEMO_USERS } from '../utils/constants'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('srfs_user')
    return stored ? JSON.parse(stored) : null
  })

  const login = useCallback((email, password) => {
    const found = DEMO_USERS.find(
      (u) => u.email === email && u.password === password,
    )
    if (!found) return { success: false, error: 'Invalid email or password' }

    const session = { email: found.email, name: found.name, role: found.role }
    localStorage.setItem('srfs_user', JSON.stringify(session))
    setUser(session)
    return { success: true }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('srfs_user')
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
