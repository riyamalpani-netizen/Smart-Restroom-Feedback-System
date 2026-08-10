import { Routes, Route, Navigate } from 'react-router-dom'
import MainLayout from './layouts/MainLayout'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import LiveFeedback from './pages/LiveFeedback'
import Reports from './pages/Reports'
import DeviceManagement from './pages/DeviceManagement'
import RestroomManagement from './pages/RestroomManagement'
import AlertManagement from './pages/AlertManagement'
import DisasterManagement from './pages/DisasterManagement'
import UserManagement from './pages/UserManagement'
import Settings from './pages/Settings'
import Profile from './pages/Profile'
import NotFound from './pages/NotFound'

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
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="live-feedback" element={<LiveFeedback />} />
        <Route path="reports" element={<Reports />} />
        <Route path="devices" element={<DeviceManagement />} />
        <Route path="restrooms" element={<RestroomManagement />} />
        <Route path="alerts" element={<AlertManagement />} />
        <Route path="disaster" element={<DisasterManagement />} />
        <Route path="users" element={<UserManagement />} />
        <Route path="settings" element={<Settings />} />
        <Route path="profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
