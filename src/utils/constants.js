export const ROLES = {
  SUPER_ADMIN: 'Super Admin',
  VENDOR_ADMIN: 'Vendor Admin',
  FACILITY_MANAGER: 'Facility Manager',
  VIEWER: 'Viewer',
}

export const FEEDBACK_TYPES = {
  happy: { label: 'Happy', color: '#22c55e' },
  neutral: { label: 'Neutral', color: '#eab308' },
  unhappy: { label: 'Unhappy', color: '#ef4444' },
}

export const DEVICE_STATUS = {
  online: { label: 'Online', color: '#22c55e' },
  offline: { label: 'Offline', color: '#94a3b8' },
  low_battery: { label: 'Low Battery', color: '#f97316' },
}

export const ALERT_STATUS = {
  open: { label: 'Open', color: '#ef4444' },
  acknowledged: { label: 'Acknowledged', color: '#eab308' },
  resolved: { label: 'Resolved', color: '#22c55e' },
}

export const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: '📊' },
  { path: '/live-feedback', label: 'Live Feedback', icon: '💬' },
  { path: '/reports', label: 'Reports', icon: '📈' },
  { path: '/devices', label: 'Device Management', icon: '📱' },
  { path: '/restrooms', label: 'Restroom Management', icon: '🚻' },
  { path: '/alerts', label: 'Alert Management', icon: '🔔' },
  { path: '/disaster', label: 'Disaster Management', icon: '⚠️' },
  { path: '/users', label: 'User Management', icon: '👥' },
  { path: '/settings', label: 'Settings', icon: '⚙️' },
]

export const DEMO_USERS = [
  { email: 'admin@restroom.io', password: 'admin123', role: ROLES.SUPER_ADMIN, name: 'Super Admin' },
  { email: 'vendor@restroom.io', password: 'vendor123', role: ROLES.VENDOR_ADMIN, name: 'Vendor Admin' },
]
