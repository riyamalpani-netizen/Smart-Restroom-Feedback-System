import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { DEMO_USERS } from '../utils/constants'

export default function Login() {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('vendor@smartrestroom.com')
  const [password, setPassword] = useState('Vendor@123')
  const [error, setError] = useState('')

  if (isAuthenticated) return <Navigate to="/dashboard" replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const result = await login(email, password)
    if (result.success) {
      navigate('/dashboard')
    } else {
      setError(result.error)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-card__header">
          <span className="login-card__logo" aria-hidden="true">🚻</span>
          <h1>Smart Restroom Feedback</h1>
          <p>Sign in to access the admin portal</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="login-form__error" role="alert">{error}</div>}

          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@smartrestroom.com"
              required
              autoComplete="email"
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
              autoComplete="current-password"
            />
          </label>

          <button type="submit" className="btn btn--primary btn--full">
            Sign In
          </button>
        </form>

        <div className="login-card__demo">
          <p>Demo accounts:</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {DEMO_USERS.map((user) => (
              <button
                key={user.email}
                type="button"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid #dbeafe',
                  background: '#f8fafc',
                  color: '#0f172a',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
                onClick={() => {
                  setEmail(user.email)
                  setPassword(user.password)
                }}
              >
                <span>{user.name}</span>
                <span style={{ fontSize: 12, color: '#475569' }}>{user.email}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
