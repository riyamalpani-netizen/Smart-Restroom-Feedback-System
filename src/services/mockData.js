const now = Date.now()
const hour = 60 * 60 * 1000

export const restrooms = [
  { id: 'r1', name: 'Floor 1 - Men', floor: 1, location: 'East Wing', badgeId: 'B001', status: 'good' },
  { id: 'r2', name: 'Floor 1 - Women', floor: 1, location: 'East Wing', badgeId: 'B002', status: 'good' },
  { id: 'r3', name: 'Floor 2 - Men', floor: 2, location: 'West Wing', badgeId: 'B003', status: 'alert' },
  { id: 'r4', name: 'Floor 2 - Women', floor: 2, location: 'West Wing', badgeId: 'B004', status: 'good' },
  { id: 'r5', name: 'Floor 3 - Accessible', floor: 3, location: 'Central', badgeId: 'B005', status: 'offline' },
]

export const devices = [
  { id: 'd1', badgeId: 'B001', restroomId: 'r1', battery: 92, status: 'online', lastCommunication: now - 5 * 60 * 1000, health: 'healthy' },
  { id: 'd2', badgeId: 'B002', restroomId: 'r2', battery: 78, status: 'online', lastCommunication: now - 12 * 60 * 1000, health: 'healthy' },
  { id: 'd3', badgeId: 'B003', restroomId: 'r3', battery: 24, status: 'online', lastCommunication: now - 3 * 60 * 1000, health: 'warning' },
  { id: 'd4', badgeId: 'B004', restroomId: 'r4', battery: 65, status: 'online', lastCommunication: now - 8 * 60 * 1000, health: 'healthy' },
  { id: 'd5', badgeId: 'B005', restroomId: 'r5', battery: 8, status: 'offline', lastCommunication: now - 2 * hour, health: 'critical' },
]

export const feedbackEntries = [
  { id: 'f1', time: now - 10 * 60 * 1000, restroomId: 'r3', type: 'unhappy', badgeId: 'B003', battery: 24, deviceStatus: 'online' },
  { id: 'f2', time: now - 25 * 60 * 1000, restroomId: 'r1', type: 'happy', badgeId: 'B001', battery: 92, deviceStatus: 'online' },
  { id: 'f3', time: now - 45 * 60 * 1000, restroomId: 'r2', type: 'happy', badgeId: 'B002', battery: 78, deviceStatus: 'online' },
  { id: 'f4', time: now - hour, restroomId: 'r4', type: 'neutral', badgeId: 'B004', battery: 65, deviceStatus: 'online' },
  { id: 'f5', time: now - 2 * hour, restroomId: 'r3', type: 'unhappy', badgeId: 'B003', battery: 28, deviceStatus: 'online' },
  { id: 'f6', time: now - 3 * hour, restroomId: 'r1', type: 'happy', badgeId: 'B001', battery: 94, deviceStatus: 'online' },
]

export const alerts = [
  { id: 'a1', time: now - 10 * 60 * 1000, restroomId: 'r3', type: 'Unhappy Feedback', status: 'open', assignedTo: 'John Smith', acknowledgedBy: null, resolvedTime: null },
  { id: 'a2', time: now - 2 * hour, restroomId: 'r5', type: 'Device Offline', status: 'acknowledged', assignedTo: 'Jane Doe', acknowledgedBy: 'Jane Doe', resolvedTime: null },
  { id: 'a3', time: now - 5 * hour, restroomId: 'r3', type: 'Low Battery', status: 'resolved', assignedTo: 'John Smith', acknowledgedBy: 'John Smith', resolvedTime: now - 3 * hour },
]

export const users = [
  { id: 'u1', name: 'Super Admin', email: 'admin@restroom.io', role: 'Super Admin', active: true },
  { id: 'u2', name: 'Vendor Admin', email: 'vendor@restroom.io', role: 'Vendor Admin', active: true },
  { id: 'u3', name: 'John Smith', email: 'john@restroom.io', role: 'Facility Manager', active: true },
  { id: 'u4', name: 'Jane Doe', email: 'jane@restroom.io', role: 'Facility Manager', active: true },
  { id: 'u5', name: 'Viewer User', email: 'viewer@restroom.io', role: 'Viewer', active: false },
]

export const dashboardStats = {
  totalRestrooms: restrooms.length,
  totalDevices: devices.length,
  todayFeedback: feedbackEntries.filter((f) => f.time > now - 24 * hour).length,
  activeAlerts: alerts.filter((a) => a.status !== 'resolved').length,
}

export const feedbackTrend = [
  { day: 'Mon', happy: 42, neutral: 12, unhappy: 5 },
  { day: 'Tue', happy: 38, neutral: 15, unhappy: 8 },
  { day: 'Wed', happy: 45, neutral: 10, unhappy: 3 },
  { day: 'Thu', happy: 50, neutral: 8, unhappy: 6 },
  { day: 'Fri', happy: 48, neutral: 14, unhappy: 4 },
  { day: 'Sat', happy: 22, neutral: 6, unhappy: 2 },
  { day: 'Sun', happy: 18, neutral: 4, unhappy: 1 },
]

export const recentActivity = [
  { id: 1, message: 'Unhappy feedback received from Floor 2 - Men', time: now - 10 * 60 * 1000, type: 'alert' },
  { id: 2, message: 'Device B005 went offline', time: now - 2 * hour, type: 'warning' },
  { id: 3, message: 'Alert resolved for Floor 2 - Men', time: now - 3 * hour, type: 'success' },
  { id: 4, message: 'New feedback badge B006 mapped to Floor 3', time: now - 5 * hour, type: 'info' },
]

export const disasterStatus = {
  gateway: 'online',
  network: 'online',
  server: 'online',
  offlineDevices: 1,
  lowBatteryDevices: 2,
  communicationFailures: 1,
  incidents: [
    { id: 'i1', time: now - 2 * hour, type: 'Device Offline', device: 'B005', status: 'investigating' },
    { id: 'i2', time: now - 4 * hour, type: 'Low Battery', device: 'B003', status: 'monitoring' },
  ],
  auditLog: [
    { id: 'al1', message: 'Manual closure initiated by Admin', time: now - 86400000 },
    { id: 'al2', message: 'Teams webhook notification sent', time: now - 7200000 },
    { id: 'al3', message: 'Device B005 marked offline', time: now - 7200000 },
  ],
}

export const settings = {
  officeName: 'Acme Headquarters',
  timeZone: 'America/New_York',
  alertThreshold: 3,
  teamsWebhook: 'https://teams.webhook.example.com/...',
  reportFrequency: 'weekly',
  autoEmailReports: true,
  sessionTimeout: 30,
}

export function getRestroomName(id) {
  return restrooms.find((r) => r.id === id)?.name ?? 'Unknown'
}
