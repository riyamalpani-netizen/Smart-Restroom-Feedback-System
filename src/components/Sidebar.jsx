import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { NAV_ITEMS, ROLES, canAccessRoute } from '../utils/constants'

const GROUP_ICONS = {
  'Overview':             '🏠',
  'Monitoring':           '📊',
  'Infrastructure':       '⚙️',
  'Restroom Operations':  '🚻',
  'Alerts & Safety':      '🚨',
  'Administration':       '👥',
}

export default function Sidebar({ collapsed, onToggle }) {
  const { user } = useAuth()
  const location = useLocation()

  // Filter items visible to current user
  const visibleItems = NAV_ITEMS.filter((item) => {
    if (!user) return false
    if (item.roles && !item.roles.includes(user.role)) return false
    return canAccessRoute(user.role, item.path)
  })

  // Build ordered group list
  const groups = []
  const seen = new Set()
  for (const item of visibleItems) {
    if (!seen.has(item.group)) {
      seen.add(item.group)
      groups.push(item.group)
    }
  }

  // Track which groups are open.
  // Default: the group containing the active route is open; rest are collapsed.
  const activeGroup = visibleItems.find((i) => i.path === location.pathname)?.group ?? groups[0]
  const [openGroups, setOpenGroups] = useState(() => new Set([activeGroup]))

  function toggleGroup(group) {
    setOpenGroups((prev) => {
      const next = new Set(prev)
      next.has(group) ? next.delete(group) : next.add(group)
      return next
    })
  }

  const scopeLabel =
    user?.role === ROLES.VENDOR_ADMIN     ? 'Vendor Admin Portal'  :
    user?.role === ROLES.SUPER_ADMIN      ? 'Super Admin Portal'   :
    user?.role === ROLES.FACILITY_MANAGER ? 'Facility Manager'     :
    null

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>
      {/* ── Brand ── */}
      <div className="sidebar__brand">
        <span className="sidebar__logo" aria-hidden="true">🚻</span>
        {!collapsed && (
          <div className="sidebar__brand-text">
            <span className="sidebar__title">AtlasIED Smart Restroom</span>
            {scopeLabel && <span className="sidebar__scope-label">{scopeLabel}</span>}
          </div>
        )}
      </div>

      {/* ── Navigation ── */}
      <nav className="sidebar__nav" aria-label="Main navigation">
        {groups.map((group) => {
          const isOpen = collapsed || openGroups.has(group)
          const items = visibleItems.filter((i) => i.group === group)
          const hasActive = items.some((i) => i.path === location.pathname)

          return (
            <div key={group} className="sidebar__group">
              {/* Clickable group heading (hidden when sidebar is collapsed) */}
              {!collapsed && (
                <button
                  type="button"
                  className={`sidebar__group-heading ${hasActive ? 'sidebar__group-heading--active' : ''}`}
                  onClick={() => toggleGroup(group)}
                  aria-expanded={openGroups.has(group)}
                >
                  <span className="sidebar__group-icon">{GROUP_ICONS[group] ?? ''}</span>
                  <span className="sidebar__group-label">{group}</span>
                  <span
                    className="sidebar__group-chevron"
                    aria-hidden="true"
                    style={{ transform: openGroups.has(group) ? 'rotate(90deg)' : 'rotate(0deg)' }}
                  >
                    ›
                  </span>
                </button>
              )}

              {/* Items — hidden when group is collapsed (unless sidebar itself is collapsed) */}
              {isOpen && (
                <div className="sidebar__group-items">
                  {items.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      className={({ isActive }) =>
                        `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
                      }
                      title={collapsed ? `${group} › ${item.label}` : item.label}
                    >
                      <span className="sidebar__icon" aria-hidden="true">{item.icon}</span>
                      {!collapsed && <span>{item.label}</span>}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* ── Collapse toggle ── */}
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
