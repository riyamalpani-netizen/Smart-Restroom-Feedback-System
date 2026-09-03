import { createContext, useContext, useState, useCallback } from 'react'

const AuthContext = createContext(null)
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('srfs_user')
    return stored ? JSON.parse(stored) : null
  })

  const login = useCallback(async (email, password) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()
      console.log('Login response:', data)

      if (!response.ok) {
        console.error('Login failed:', data)
        return { success: false, error: data.message || 'Invalid email or password' }
      }

      const session = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
        role: data.user.role,
        organizationId: data.user.organizationId,
        tutorialStatus: data.user.tutorialStatus,
      }

      localStorage.setItem('srfs_user', JSON.stringify(session))
      localStorage.setItem('srfs_token', data.token)
      setUser(session)
      console.log('User signed in successfully:', session)

      return { success: true }
    } catch (error) {
      console.error('Login request failed:', error)
      return {
        success: false,
        error: 'Unable to connect to the server. Please start the backend.',
      }
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('srfs_user')
    localStorage.removeItem('srfs_token')
    setUser(null)
  }, [])

  const updateUser = useCallback((changes) => {
    setUser((current) => {
      if (!current) return current
      const next = { ...current, ...changes }
      localStorage.setItem('srfs_user', JSON.stringify(next))
      return next
    })
  }, [])

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
