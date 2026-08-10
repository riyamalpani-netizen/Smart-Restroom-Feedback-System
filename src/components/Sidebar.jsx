import { NavLink } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { NAV_ITEMS, canAccessRoute } from '../utils/constants'

export default function Sidebar({ collapsed, onToggle }) {
  const { user } = useAuth()

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (!user) return false
    return canAccessRoute(user.role, item.path)
  })

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>
      <div className="sidebar__brand">
        <span className="sidebar__logo" aria-hidden="true">🚻</span>
         {!collapsed && <span className="sidebar__title">AtlasIED Smart Restroom Feedback System</span>}
      </div>

      <nav className="sidebar__nav">
        {visibleItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
            }
            title={item.label}
          >
            <span className="sidebar__icon" aria-hidden="true">{item.icon}</span>
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <button
        type="button"
        className="sidebar__toggle"
        onClick={onToggle}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? '→' : '←'}
      </button>
    </aside>
  )
}
