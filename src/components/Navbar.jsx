import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const PAGE_TITLES = {
  '/dashboard': 'Dashboard',
  '/live-feedback': 'Live Feedback',
  '/sidemap': 'Floor Map',
  '/reports': 'Reports',
  '/devices': 'Device Management',
  '/restrooms': 'Restroom Management',
  '/alerts': 'Alert Management',
  '/disaster': 'Disaster Management',
  '/users': 'User Management',
  '/settings': 'Settings',
  '/profile': 'Profile',
}

const PAGE_SUBTITLES = {
  '/dashboard': 'Overview of restroom feedback and device health',
  '/live-feedback': 'Real-time feedback from restroom devices',
  '/sidemap': 'Interactive restroom monitoring, heatmap analytics and real-time site status',
  '/reports': 'Generate and export feedback and device reports',
  '/devices': 'Monitor badge devices, battery, and connectivity',
  '/restrooms': 'Add, edit, and manage restroom locations',
  '/alerts': 'Track, acknowledge, and resolve restroom alerts',
  '/disaster': 'Monitor system health and incident recovery',
  '/users': 'Manage users, roles, and access',
  '/settings': 'Configure office, alerts, and notification preferences',
  '/profile': 'Your account information',
}

export default function Navbar({ onMenuToggle }) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const pageTitle = PAGE_TITLES[location.pathname] ?? 'Dashboard'
  const pageSubtitle = PAGE_SUBTITLES[location.pathname] ?? ''

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

      <div className="navbar__title">
        <span className="navbar__pagetitle">{pageTitle}</span>
        <span className="navbar__pagesubtitle">{pageSubtitle}</span>
      </div>

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
