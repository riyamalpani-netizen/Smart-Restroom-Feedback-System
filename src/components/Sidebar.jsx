import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { NAV_ITEMS, ROLES, canAccessRoute } from '../utils/constants'
import {
  IconDashboard, IconLiveFeedback, Iconsidemap, IconReports,
  IconSiteConfig, IconGateway, IconDevice, IconRestroom,
  IconAlerts, IconDisaster, IconUsers, IconAudit, IconSettings,
  IconOverview, IconMonitoring, IconInfrastructure,
  IconRestroomOps, IconAlertsSafety, IconAdmin,
} from './SidebarIcons'

function NavIcon({ name }) {
  switch (name) {
    case 'dashboard':    return <IconDashboard />
    case 'livefeedback': return <IconLiveFeedback />
    case 'sidemap':      return <Iconsidemap />
    case 'reports':      return <IconReports />
    case 'siteconfig':   return <IconSiteConfig />
    case 'gateway':      return <IconGateway />
    case 'device':       return <IconDevice />
    case 'restroom':     return <IconRestroom />
    case 'alerts':       return <IconAlerts />
    case 'disaster':     return <IconDisaster />
    case 'users':        return <IconUsers />
    case 'audit':        return <IconAudit />
    case 'settings':     return <IconSettings />
    default:             return <span>{name}</span>
  }
}

function GroupIcon({ name }) {
  switch (name) {
    case 'Overview':            return <IconOverview />
    case 'Monitoring':          return <IconMonitoring />
    case 'Infrastructure':      return <IconInfrastructure />
    case 'Restroom Operations': return <IconRestroomOps />
    case 'Alerts & Safety':     return <IconAlertsSafety />
    case 'Administration':      return <IconAdmin />
    default:                    return null
  }
}

export default function Sidebar({ collapsed, onToggle }) {
  const { user } = useAuth()
  const location = useLocation()

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (!user) return false
    if (item.roles && !item.roles.includes(user.role)) return false
    return canAccessRoute(user.role, item.path)
  })

  const groups = []
  const seen = new Set()
  for (const item of visibleItems) {
    if (!seen.has(item.group)) { seen.add(item.group); groups.push(item.group) }
  }

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
        <span className="sidebar__logo" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </span>
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
              {!collapsed && (
                <button
                  type="button"
                  className={`sidebar__group-heading ${hasActive ? 'sidebar__group-heading--active' : ''}`}
                  onClick={() => toggleGroup(group)}
                  aria-expanded={openGroups.has(group)}
                >
                  <span className="sidebar__group-icon"><GroupIcon name={group} /></span>
                  <span className="sidebar__group-label">{group}</span>
                  <span
                    className="sidebar__group-chevron"
                    aria-hidden="true"
                    style={{ transform: openGroups.has(group) ? 'rotate(90deg)' : 'rotate(0deg)' }}
                  >›</span>
                </button>
              )}

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
                      <span className="sidebar__icon" aria-hidden="true">
                        <NavIcon name={item.icon} />
                      </span>
                      {!collapsed && <span className="sidebar__link-label">{item.label}</span>}
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
        {collapsed ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        )}
      </button>
    </aside>
  )
}
