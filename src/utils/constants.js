export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  VENDOR_ADMIN: 'vendor_admin',
  FACILITY_MANAGER: 'facility_manager',
  VIEWER: 'viewer',
}

export const ROLE_LABELS = {
  [ROLES.SUPER_ADMIN]: 'Super Admin',
  [ROLES.VENDOR_ADMIN]: 'Vendor Admin',
  [ROLES.FACILITY_MANAGER]: 'Facility Manager',
  [ROLES.VIEWER]: 'Viewer',
}

export const FEEDBACK_TYPES = {
  happy: { label: 'Happy', color: '#10b981' },
  neutral: { label: 'Neutral', color: '#f59e0b' },
  unhappy: { label: 'Unhappy', color: '#ef4444' },
}

export const DEVICE_STATUS = {
  online: { label: 'Online', color: '#10b981' },
  offline: { label: 'Offline', color: '#94a3b8' },
  low_battery: { label: 'Low Battery', color: '#f59e0b' },
  healthy: { label: 'Healthy', color: '#10b981' },
  warning: { label: 'Warning', color: '#f59e0b' },
  critical: { label: 'Critical', color: '#ef4444' },
}

export const ALERT_STATUS = {
  open: { label: 'Open', color: '#ef4444' },
  assigned: { label: 'Assigned', color: '#f59e0b' },
  in_progress: { label: 'In Progress', color: '#f59e0b' },
  closed: { label: 'Closed', color: '#10b981' },
}

/**
 * Roles a Vendor Admin is allowed to assign when creating/editing users.
 * Vendor Admin must not see or set super_admin or vendor_admin roles.
 */
export const VENDOR_MANAGEABLE_ROLES = [ROLES.FACILITY_MANAGER, ROLES.VIEWER]

/**
 * Navigation items shown in the sidebar.
 * - `group`  : section heading label
 * - `roles`  : if set, only these roles see the item (omit = all roles)
 */
export const NAV_ITEMS = [
  // ── Overview ──────────────────────────────────────────────────────────
  {
    path: '/dashboard',
    label: 'Dashboard',
    icon: '🏠',
    group: 'Overview',
  },

  // ── Monitoring ────────────────────────────────────────────────────────
  {
    path: '/live-feedback',
    label: 'Live Feedback',
    icon: '💬',
    group: 'Monitoring',
  },
  {
    path: '/sidemap',
    label: 'Sidemap',
    icon: '🗺️',
    group: 'Monitoring',
  },
  {
    path: '/reports',
    label: 'Reports',
    icon: '📈',
    group: 'Monitoring',
  },

  // ── Infrastructure ────────────────────────────────────────────────────
  {
    path: '/site-config',
    label: 'Site Configuration',
    icon: '🏢',
    group: 'Infrastructure',
    roles: [ROLES.SUPER_ADMIN, ROLES.VENDOR_ADMIN, ROLES.FACILITY_MANAGER],
  },
  {
    path: '/gateways',
    label: 'Gateway Management',
    icon: '📡',
    group: 'Infrastructure',
  },
  {
    path: '/devices',
    label: 'Device Management',
    icon: '📱',
    group: 'Infrastructure',
  },

  // ── Restroom Operations ───────────────────────────────────────────────
  {
    path: '/restrooms',
    label: 'Restroom Management',
    icon: '🚻',
    group: 'Restroom Operations',
  },

  // ── Alerts & Safety ───────────────────────────────────────────────────
  {
    path: '/alerts',
    label: 'Alert Management',
    icon: '🔔',
    group: 'Alerts & Safety',
  },
  {
    path: '/disaster',
    label: 'Disaster Management',
    icon: '⚠️',
    group: 'Alerts & Safety',
    roles: [ROLES.SUPER_ADMIN],
  },

  // ── Administration ────────────────────────────────────────────────────
  {
    path: '/users',
    label: 'User Management',
    icon: '👥',
    group: 'Administration',
    roles: [ROLES.SUPER_ADMIN, ROLES.VENDOR_ADMIN],
  },
  {
    path: '/audit-history',
    label: 'Audit History',
    icon: '📋',
    group: 'Administration',
    roles: [ROLES.SUPER_ADMIN, ROLES.VENDOR_ADMIN],
  },
  {
    path: '/settings',
    label: 'Settings',
    icon: '⚙️',
    group: 'Administration',
    roles: [ROLES.SUPER_ADMIN, ROLES.VENDOR_ADMIN],
  },
]

/**
 * Flat list of routes each role is allowed to navigate to.
 * Used by ProtectedRoute and canAccessRoute().
 */
export const ROLE_ROUTE_ACCESS = {
  [ROLES.SUPER_ADMIN]: [
    '/dashboard',
    '/live-feedback',
    '/sidemap',
    '/reports',
    '/site-config',
    '/gateways',
    '/devices',
    '/restrooms',
    '/alerts',
    '/disaster',
    '/users',
    '/settings',
    '/audit-history',
    '/profile',
  ],
  [ROLES.VENDOR_ADMIN]: [
    '/dashboard',
    '/live-feedback',
    '/sidemap',
    '/reports',
    '/site-config',
    '/gateways',
    '/devices',
    '/restrooms',
    '/alerts',
    // No /disaster — Vendor Admin does not manage disaster events
    '/users',
    '/settings',
    '/audit-history',
    '/profile',
  ],
  [ROLES.FACILITY_MANAGER]: [
    '/dashboard',
    '/live-feedback',
    '/sidemap',
    '/reports',
    '/site-config',
    '/gateways',
    '/devices',
    '/restrooms',
    '/alerts',
    '/disaster',
    '/profile',
  ],
  [ROLES.VIEWER]: [
    '/dashboard',
    '/live-feedback',
    '/sidemap',
    '/reports',
    '/gateways',
    '/devices',
    '/restrooms',
    '/alerts',
    '/disaster',
    '/profile',
  ],
}

export function canAccessRoute(role, path) {
  const allowedRoutes = ROLE_ROUTE_ACCESS[role] ?? []
  return allowedRoutes.includes(path)
}

export function getRoleLabel(role) {
  return ROLE_LABELS[role] ?? 'User'
}

/**
 * Returns the list of roles a given actor is permitted to assign.
 * Used in User Management forms to restrict the Role dropdown.
 */
export function getAssignableRoles(actorRole) {
  if (actorRole === ROLES.SUPER_ADMIN) {
    return [ROLES.SUPER_ADMIN, ROLES.VENDOR_ADMIN, ROLES.FACILITY_MANAGER, ROLES.VIEWER]
  }
  if (actorRole === ROLES.VENDOR_ADMIN) {
    return VENDOR_MANAGEABLE_ROLES
  }
  return []
}

export const DEMO_USERS = [
  { email: 'superadmin@smartrestroom.com', password: 'SuperAdmin@123', role: ROLES.SUPER_ADMIN, name: 'Super Admin' },
  { email: 'vendor@smartrestroom.com', password: 'Vendor@123', role: ROLES.VENDOR_ADMIN, name: 'Vendor Admin' },
  { email: 'facility@smartrestroom.com', password: 'Facility@123', role: ROLES.FACILITY_MANAGER, name: 'Facility Manager' },
  { email: 'viewer@smartrestroom.com', password: 'Viewer@123', role: ROLES.VIEWER, name: 'Viewer' },
]
