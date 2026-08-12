import { Routes, Route, Navigate } from 'react-router-dom'
import MainLayout from './layouts/MainLayout'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import LiveFeedback from './pages/LiveFeedback'
import SideMap from './pages/SideMap'
import Reports from './pages/Reports'
import DeviceManagement from './pages/DeviceManagement'
import RestroomManagement from './pages/RestroomManagement'
import AlertManagement from './pages/AlertManagement'
import DisasterManagement from './pages/DisasterManagement'
import UserManagement from './pages/UserManagement'
import Settings from './pages/Settings'
import Profile from './pages/Profile'
import SiteConfiguration from './pages/SiteConfiguration'
import NotFound from './pages/NotFound'
import { ROLES } from './utils/constants'

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
        <Route path="dashboard" element={<ProtectedRoute path="/dashboard"><Dashboard /></ProtectedRoute>} />
        <Route path="live-feedback" element={<ProtectedRoute path="/live-feedback"><LiveFeedback /></ProtectedRoute>} />
        <Route path="sidemap" element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.VENDOR_ADMIN, ROLES.FACILITY_MANAGER, ROLES.VIEWER]} path="/sidemap"><SideMap /></ProtectedRoute>} />
        <Route path="reports" element={<ProtectedRoute path="/reports"><Reports /></ProtectedRoute>} />
        <Route path="devices" element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.VENDOR_ADMIN, ROLES.FACILITY_MANAGER, ROLES.VIEWER]} path="/devices"><DeviceManagement /></ProtectedRoute>} />
        <Route path="restrooms" element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.VENDOR_ADMIN, ROLES.FACILITY_MANAGER, ROLES.VIEWER]} path="/restrooms"><RestroomManagement /></ProtectedRoute>} />
        <Route path="alerts" element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.VENDOR_ADMIN, ROLES.FACILITY_MANAGER, ROLES.VIEWER]} path="/alerts"><AlertManagement /></ProtectedRoute>} />
        <Route path="disaster" element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.VENDOR_ADMIN, ROLES.FACILITY_MANAGER, ROLES.VIEWER]} path="/disaster"><DisasterManagement /></ProtectedRoute>} />
        <Route path="users" element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.VENDOR_ADMIN]} path="/users"><UserManagement /></ProtectedRoute>} />
        <Route path="settings" element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.VENDOR_ADMIN]} path="/settings"><Settings /></ProtectedRoute>} />
        <Route path="profile" element={<ProtectedRoute path="/profile"><Profile /></ProtectedRoute>} />
        <Route path="site-config" element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.VENDOR_ADMIN, ROLES.FACILITY_MANAGER]} path="/site-config"><SiteConfiguration /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
 