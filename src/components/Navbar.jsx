import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const PAGE_TITLES = {
  '/dashboard': 'Dashboard',
  '/live-feedback': 'Live Feedback',
  '/sidemap': 'Floor Map',
  '/reports': 'Reports',
  '/site-config': 'Site Configuration',
  '/gateways': 'Gateway Management',
  '/devices': 'Device Management',
  '/restrooms': 'Restroom Management',
  '/alerts': 'Alert Management',
  '/disaster': 'Disaster Management',
  '/users': 'User Management',
  '/settings': 'Settings',
  '/audit-history': 'Audit History',
  '/profile': 'Profile',
}

const PAGE_SUBTITLES = {
  '/dashboard': 'Overview of restroom feedback and device health',
  '/live-feedback': 'Real-time feedback from restroom devices',
  '/sidemap': 'Interactive restroom monitoring, heatmap analytics and real-time site status',
  '/reports': 'Generate and export feedback and device reports',
  '/site-config': 'Map and configure sites, floors, zones, and devices',
  '/gateways': 'Monitor and manage LoRaWAN gateways and their connected devices',
  '/devices': 'Monitor badge devices, battery, and connectivity',
  '/restrooms': 'Add, edit, and manage restroom locations',
  '/alerts': 'Track, acknowledge, and resolve restroom alerts',
  '/disaster': 'Monitor system health and incident recovery',
  '/users': 'Manage users, roles, and access',
  '/settings': 'Configure office, alerts, and notification preferences',
  '/audit-history': 'Track all user actions and configuration changes in your organisation',
  '/profile': 'Your account information',
}

// Maps each route to its breadcrumb trail — mirrors the sidebar groups exactly
const BREADCRUMBS = {
  // Overview
  '/dashboard':      [{ label: 'Overview' }, { label: 'Dashboard' }],
  // Monitoring
  '/live-feedback':  [{ label: 'Monitoring' }, { label: 'Live Feedback' }],
  '/sidemap':        [{ label: 'Monitoring' }, { label: 'Sidemap' }],
  '/reports':        [{ label: 'Monitoring' }, { label: 'Reports' }],
  // Infrastructure
  '/site-config':    [{ label: 'Infrastructure' }, { label: 'Site Configuration' }],
  '/gateways':       [{ label: 'Infrastructure' }, { label: 'Gateway Management' }],
  '/devices':        [{ label: 'Infrastructure' }, { label: 'Device Management' }],
  // Restroom Operations
  '/restrooms':      [{ label: 'Restroom Operations' }, { label: 'Restroom Management' }],
  // Alerts & Safety
  '/alerts':         [{ label: 'Alerts & Safety' }, { label: 'Alert Management' }],
  '/disaster':       [{ label: 'Alerts & Safety' }, { label: 'Disaster Management' }],
  // Administration
  '/users':          [{ label: 'Administration' }, { label: 'User Management' }],
  '/audit-history':  [{ label: 'Administration' }, { label: 'Audit History' }],
  '/settings':       [{ label: 'Administration' }, { label: 'Settings' }],
  '/profile':        [{ label: 'Administration' }, { label: 'Profile' }],
}

export default function Navbar({ onMenuToggle }) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const normalizedPath = location.pathname === '/' ? '/dashboard' : location.pathname
  const pageSubtitle = PAGE_SUBTITLES[normalizedPath] ?? PAGE_SUBTITLES['/dashboard']
  const breadcrumbs = BREADCRUMBS[normalizedPath] ?? BREADCRUMBS['/dashboard']

  function openTour() {
    window.dispatchEvent(new CustomEvent('srfs-tour-restart'))
  }

  return (
    <header className="navbar" data-tour="navbar">
      <button
        type="button"
        className="navbar__menu-btn"
        onClick={onMenuToggle}
        aria-label="Toggle menu"
      >
        ☰
      </button>

      <div className="navbar__title">
        <nav className="navbar__breadcrumb" aria-label="Breadcrumb">
          {breadcrumbs.map((crumb, index) => (
            <span key={index} className="navbar__breadcrumb-item">
              {index < breadcrumbs.length - 1 ? (
                <>
                  <span className="navbar__breadcrumb-parent">{crumb.label}</span>
                  <span className="navbar__breadcrumb-sep" aria-hidden="true">›</span>
                </>
              ) : (
                <span className="navbar__breadcrumb-current">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
        <span className="navbar__pagesubtitle">{pageSubtitle}</span>
      </div>

      <div className="navbar__spacer" />

      <div className="navbar__actions">
        <div className="navbar__tour-wrap">
          <button
            type="button"
            className="navbar__tour-btn"
            onClick={openTour}
            aria-label="Open application walkthrough"
          >
            Take a tour
          </button>
        </div>
        <Link to="/profile" className="navbar__profile" data-tour="navbar-profile">
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
