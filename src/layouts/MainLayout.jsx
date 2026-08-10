import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import Navbar from '../components/Navbar'

export default function MainLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className={`app-layout ${sidebarCollapsed ? 'app-layout--collapsed' : ''}`}>
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((c) => !c)}
      />
      {mobileOpen && (
        <button
          type="button"
          className="sidebar-overlay"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <div className="app-layout__main">
        <Navbar onMenuToggle={() => setMobileOpen((o) => !o)} />
        <main className="app-layout__content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
