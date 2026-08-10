import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function Navbar({ onMenuToggle }) {
  const { user, logout } = useAuth()

  return (
    <header className="navbar">
      <button
        type="button"
        className="navbar__menu-btn"
        onClick={onMenuToggle}
        aria-label="Toggle menu"
      >
        ☰
      </button>

      <div className="navbar__spacer" />

      <div className="navbar__actions">
        <Link to="/profile" className="navbar__profile">
          <span className="navbar__avatar" aria-hidden="true">
            {user?.name?.charAt(0) ?? 'U'}
          </span>
          <div className="navbar__user-info">
            <span className="navbar__name">{user?.name}</span>
            <span className="navbar__role">{user?.role}</span>
          </div>
        </Link>
        <button type="button" className="btn btn--ghost" onClick={logout}>
          Logout
        </button>
      </div>
    </header>
  )
}
