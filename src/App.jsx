import { Routes, Route, Navigate } from 'react-router-dom'
import MainLayout from './layouts/MainLayout'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import LiveFeedback from './pages/LiveFeedback'
import SideMap from './pages/SideMap'
import Reports from './pages/Reports'
import GatewayManagement from './pages/GatewayManagement'
import DeviceManagement from './pages/DeviceManagement'
import RestroomManagement from './pages/RestroomManagement'
import AlertManagement from './pages/AlertManagement'
import DisasterManagement from './pages/DisasterManagement'
import UserManagement from './pages/UserManagement'
import Settings from './pages/Settings'
import Profile from './pages/Profile'
import SiteConfiguration from './pages/SiteConfiguration'
import AuditHistory from './pages/AuditHistory'
import NotFound from './pages/NotFound'
import { ROLES } from './utils/constants'

const ALL_ROLES = [ROLES.SUPER_ADMIN, ROLES.VENDOR_ADMIN, ROLES.FACILITY_MANAGER, ROLES.VIEWER]
const MGMT_ROLES = [ROLES.SUPER_ADMIN, ROLES.VENDOR_ADMIN]
const EDIT_ROLES = [ROLES.SUPER_ADMIN, ROLES.VENDOR_ADMIN, ROLES.FACILITY_MANAGER]

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />

        {/* ── Available to all authenticated roles ── */}
        <Route path="dashboard"
          element={<ProtectedRoute path="/dashboard"><Dashboard /></ProtectedRoute>} />
        <Route path="live-feedback"
          element={<ProtectedRoute path="/live-feedback"><LiveFeedback /></ProtectedRoute>} />
        <Route path="sidemap"
          element={<ProtectedRoute allowedRoles={ALL_ROLES} path="/sidemap"><SideMap /></ProtectedRoute>} />
        <Route path="reports"
          element={<ProtectedRoute path="/reports"><Reports /></ProtectedRoute>} />
        <Route path="gateways"
          element={<ProtectedRoute allowedRoles={ALL_ROLES} path="/gateways"><GatewayManagement /></ProtectedRoute>} />
        <Route path="devices"
          element={<ProtectedRoute allowedRoles={ALL_ROLES} path="/devices"><DeviceManagement /></ProtectedRoute>} />
        <Route path="restrooms"
          element={<ProtectedRoute allowedRoles={ALL_ROLES} path="/restrooms"><RestroomManagement /></ProtectedRoute>} />
        <Route path="alerts"
          element={<ProtectedRoute allowedRoles={ALL_ROLES} path="/alerts"><AlertManagement /></ProtectedRoute>} />
        <Route path="profile"
          element={<ProtectedRoute path="/profile"><Profile /></ProtectedRoute>} />

        {/* ── Site config: Super Admin, Vendor Admin, Facility Manager ── */}
        <Route path="site-config"
          element={<ProtectedRoute allowedRoles={EDIT_ROLES} path="/site-config"><SiteConfiguration /></ProtectedRoute>} />

        {/* ── Disaster Management: Super Admin only ── */}
        <Route path="disaster"
          element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN]} path="/disaster"><DisasterManagement /></ProtectedRoute>} />

        {/* ── User Management: Super Admin + Vendor Admin (scoped by controller) ── */}
        <Route path="users"
          element={<ProtectedRoute allowedRoles={MGMT_ROLES} path="/users"><UserManagement /></ProtectedRoute>} />

        {/* ── Settings: Super Admin + Vendor Admin (vendor scoped to own org) ── */}
        <Route path="settings"
          element={<ProtectedRoute allowedRoles={MGMT_ROLES} path="/settings"><Settings /></ProtectedRoute>} />

        {/* ── Audit History: Super Admin + Vendor Admin (vendor sees own org only) ── */}
        <Route path="audit-history"
          element={<ProtectedRoute allowedRoles={MGMT_ROLES} path="/audit-history"><AuditHistory /></ProtectedRoute>} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
