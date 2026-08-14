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

export const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: '📊' },
  { path: '/live-feedback', label: 'Live Feedback', icon: '💬' },
  { path: '/sidemap', label: 'Sidemap', icon: '🗺️' },
   { path: '/reports', label: 'Reports', icon: '📈' },
   { path: '/site-config', label: 'Site Configuration', icon: '🗺️' },
   { path: '/devices', label: 'Device Management', icon: '📱' },
  { path: '/restrooms', label: 'Restroom Management', icon: '🚻' },
  { path: '/alerts', label: 'Alert Management', icon: '🔔' },
  { path: '/disaster', label: 'Disaster Management', icon: '⚠️' },
  { path: '/users', label: 'User Management', icon: '👥' },
  { path: '/settings', label: 'Settings', icon: '⚙️' },
]

export const ROLE_ROUTE_ACCESS = {
  [ROLES.SUPER_ADMIN]: ['/dashboard', '/live-feedback', '/sidemap', '/reports', '/site-config', '/devices', '/restrooms', '/alerts', '/disaster', '/users', '/settings', '/profile'],
  [ROLES.VENDOR_ADMIN]: ['/dashboard', '/live-feedback', '/sidemap', '/reports', '/site-config', '/devices', '/restrooms', '/alerts', '/disaster', '/users', '/settings', '/profile'],
  [ROLES.FACILITY_MANAGER]: ['/dashboard', '/live-feedback', '/sidemap', '/reports', '/site-config', '/devices', '/restrooms', '/alerts', '/disaster', '/profile'],
  [ROLES.VIEWER]: ['/dashboard', '/live-feedback', '/sidemap', '/reports', '/devices', '/restrooms', '/alerts', '/disaster', '/profile'],
}

export function canAccessRoute(role, path) {
  const allowedRoutes = ROLE_ROUTE_ACCESS[role] ?? []
  return allowedRoutes.includes(path)
}

export function getRoleLabel(role) {
  return ROLE_LABELS[role] ?? 'User'
}

export const DEMO_USERS = [
  { email: 'superadmin@smartrestroom.com', password: 'SuperAdmin@123', role: ROLES.SUPER_ADMIN, name: 'Super Admin' },
  { email: 'vendor@smartrestroom.com', password: 'Vendor@123', role: ROLES.VENDOR_ADMIN, name: 'Vendor Admin' },
  { email: 'facility@smartrestroom.com', password: 'Facility@123', role: ROLES.FACILITY_MANAGER, name: 'Facility Manager' },
  { email: 'viewer@smartrestroom.com', password: 'Viewer@123', role: ROLES.VIEWER, name: 'Viewer' },
]
