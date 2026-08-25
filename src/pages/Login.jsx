import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import atlasLogo from '../assets/Solutions_logos_AtlasIED_Logo_2C.jpg'

export default function Login() {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('superadmin@smartrestroom.com')
  const [password, setPassword] = useState('SuperAdmin@123')
  const [showPassword, setShowPassword] = useState(false)
  const [keepSignedIn, setKeepSignedIn] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (isAuthenticated) return <Navigate to="/dashboard" replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await login(email, password)
    setLoading(false)
    if (result.success) {
      navigate('/dashboard')
    } else {
      setError(result.error)
    }
  }

  return (
    <div className="lp">
      {/* ── Left panel ── */}
      <div className="lp__left">
        <img src={atlasLogo} alt="AtlasIED" className="lp__left-logo" />

        <div className="lp__hero">
          <h1 className="lp__hero-title">
            <span className="lp__hero-bold">Smart Restroom</span>
            <br />Management Platform
          </h1>
          <p className="lp__hero-sub">
            Centralize control and maximize efficiency<br />for your facility.
          </p>
        </div>

        <div className="lp__features">
          <div className="lp__feature">
            <span className="lp__feature-icon">🔔</span>
            <span>Real-time<br />Alerts</span>
          </div>
          <div className="lp__feature">
            <span className="lp__feature-icon">📊</span>
            <span>Analytics<br />Dashboard</span>
          </div>
          <div className="lp__feature">
            <span className="lp__feature-icon">👥</span>
            <span>Occupancy<br />Tracking</span>
          </div>
        </div>
      </div>

      {/* ── Center card ── */}
      <div className="lp__center">
        <div className="lp__card">
          <div className="lp__card-header">
            <img src={atlasLogo} alt="AtlasIED" className="lp__card-logo" />
            <h2 className="lp__card-title">
              AtlasIED Smart Restroom<br />Feedback System
            </h2>
            <p className="lp__card-sub">Sign in to access the portal</p>
          </div>

          <form onSubmit={handleSubmit} className="lp__form" noValidate>
            {error && (
              <div className="lp__error" role="alert">{error}</div>
            )}

            {/* Email */}
            <div className="lp__field">
              <label className="lp__label" htmlFor="lp-email">
                <span className="lp__label-icon">✉</span>
                <span>Email</span>
                <button type="button" className="lp__label-link">Forgot your email?</button>
              </label>
              <input
                id="lp-email"
                className="lp__input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="superadmin@smartrestroom.com"
                required
                autoComplete="email"
              />
            </div>

            {/* Password */}
            <div className="lp__field">
              <label className="lp__label" htmlFor="lp-password">
                <span className="lp__label-icon">🔒</span>
                <span>Password</span>
              </label>
              <div className="lp__input-wrap">
                <input
                  id="lp-password"
                  className="lp__input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="lp__eye"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            {/* Remember + Forgot */}
            <div className="lp__row">
              <label className="lp__check">
                <input
                  type="checkbox"
                  checked={keepSignedIn}
                  onChange={(e) => setKeepSignedIn(e.target.checked)}
                />
                <span>Keep me signed in</span>
              </label>
              <button type="button" className="lp__label-link">Forgot Password?</button>
            </div>

            <button
              type="submit"
              className="lp__submit"
              disabled={loading}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>

            <p className="lp__register">Need to create an account?</p>
          </form>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="lp__right">
        {/* Status pill */}
        <div className="lp__status">
          <span className="lp__status-dot" />
          All Systems Operational
        </div>

        {/* Help links */}
        <div className="lp__help">
          <p className="lp__help-title">System Context &amp; Help</p>
          <p className="lp__help-sub">Quick-access text links:</p>
          <a href="#" className="lp__help-link">
            <span>💬</span> Contact IT Admin
          </a>
          <a href="#" className="lp__help-link">
            <span>📖</span> View Documentation
          </a>
        </div>

        {/* Portal preview thumbnail */}
        <div className="lp__preview">
          <div className="lp__preview-screen">
            {/* mini chart bars decorative */}
            <div className="lp__preview-bars">
              {[40, 65, 50, 80, 55, 70, 45, 75, 60, 85].map((h, i) => (
                <div key={i} className="lp__preview-bar" style={{ height: `${h}%` }} />
              ))}
            </div>
            <div className="lp__preview-dots">
              {[1,2,3].map((i) => <div key={i} className={`lp__preview-dot lp__preview-dot--${i}`} />)}
            </div>
          </div>
          <p className="lp__preview-label">Portal Overview</p>
        </div>

        {/* Security footer */}
        <div className="lp__security">
          <div className="lp__security-left">
            <span className="lp__security-icon">🔐</span>
            <div>
              <p className="lp__security-title">Security &amp; Compliance</p>
              <p className="lp__security-detail">256-bit Encrypted</p>
              <p className="lp__security-detail">SOC 2 Compliant</p>
            </div>
          </div>
          <div className="lp__security-badges">
            <div className="lp__badge">🔒</div>
            <div className="lp__badge">🌐</div>
          </div>
          <span className="lp__version">v2.4.0</span>
        </div>
      </div>
    </div>
  )
}
