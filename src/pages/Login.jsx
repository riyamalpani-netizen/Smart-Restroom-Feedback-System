import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function Login() {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  if (isAuthenticated) return <Navigate to="/dashboard" replace />

  function handleSubmit(e) {
    e.preventDefault()
    const result = login(email, password)
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
              placeholder="admin@restroom.io"
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
          <ul>
            <li><code>admin@restroom.io</code> / <code>admin123</code></li>
            <li><code>vendor@restroom.io</code> / <code>vendor123</code></li>
          </ul>
        </div>
      </div>
    </div>
  )
}
