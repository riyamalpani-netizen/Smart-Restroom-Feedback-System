import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import api from '../services/api'
import { ROLES, ROLE_LABELS } from '../utils/constants'

// ─── Role helpers ─────────────────────────────────────────────────────────────

function getRoleContext(role) {
  switch (role) {
    case ROLES.SUPER_ADMIN:      return 'As Super Admin you have full system control — create organisations, configure sites, manage users, register devices, and oversee everything end-to-end.'
    case ROLES.VENDOR_ADMIN:     return 'As Vendor Admin you manage everything inside your organisation — sites, floors, restrooms, devices, users, alerts, and notifications.'
    case ROLES.REGIONAL_MANAGER: return 'As Regional Manager you oversee all sites in your region, monitor live feedback, review device health, and configure site layouts.'
    case ROLES.VENDOR_MANAGER:   return 'As Vendor Manager you manage infrastructure and operational data for your assigned sites.'
    case ROLES.SITE_INCHARGE:    return 'As Site In-Charge you monitor live feedback, manage devices and gateways, and handle alerts for your site.'
    case ROLES.FACILITY_MANAGER: return 'As Facility Manager you configure site layouts, manage restrooms, and respond to operational alerts.'
    case ROLES.VIEWER:           return 'As Viewer you have read-only access to dashboards, live feedback, reports, and device status.'
    default:                     return 'This walkthrough will show you how the full system works — from device setup to real-time alerts.'
  }
}

// ─── Shared layout primitives (match real app exactly) ────────────────────────
// Sidebar bg: #0b1419   Surface: #162329   Muted surface: #1a2830
// Top bar bg: #0f1c22   Primary: #0891b2   Accent: #14b8a6
// Success: #10b981   Warning: #f59e0b   Danger: #ef4444   Info: #6366f1
// Text-h: #e8f0f2   Text-muted: #8ba3ad   Border: rgba(255,255,255,0.08)

// Full app shell — sidebar + top bar — used as backdrop in all slides
function AppShell({ activeNav = '/dashboard', children, pageTitle = 'Dashboard', pageSubtitle = 'Overview of restroom feedback and device health' }) {
  const navItems = [
    { path: '/dashboard',    label: 'Dashboard',          group: 'Overview' },
    { path: '/live-feedback',label: 'Live Feedback',       group: 'Monitoring' },
    { path: '/sidemap',      label: 'Floor Map',           group: 'Monitoring' },
    { path: '/reports',      label: 'Reports',             group: 'Monitoring' },
    { path: '/site-config',  label: 'Site Configuration',  group: 'Infrastructure' },
    { path: '/gateways',     label: 'Gateway Management',  group: 'Infrastructure' },
    { path: '/devices',      label: 'Device Management',   group: 'Infrastructure' },
    { path: '/restrooms',    label: 'Restroom Management', group: 'Restroom Ops' },
    { path: '/alerts',       label: 'Alert Management',    group: 'Alerts & Safety' },
    { path: '/users',        label: 'User Management',     group: 'Administration' },
    { path: '/settings',     label: 'Settings',            group: 'Administration' },
  ]
  return (
    <svg viewBox="0 0 560 320" xmlns="http://www.w3.org/2000/svg" className="ob-slide__illustration">
      {/* Sidebar */}
      <rect x="0" y="0" width="112" height="320" fill="#0b1419"/>
      {/* Brand bar */}
      <rect x="0" y="0" width="112" height="44" fill="#0b1419"/>
      {/* AtlasIED logo area */}
      <rect x="10" y="10" width="22" height="22" rx="5" fill="#0891b220" stroke="#0891b240" strokeWidth="1"/>
      <rect x="12" y="12" width="18" height="18" rx="3" fill="#0891b230"/>
      <rect x="14" y="14" width="14" height="14" rx="2" fill="#0891b2" opacity=".5"/>
      <rect x="36" y="13" width="64" height="5" rx="2" fill="#e8f0f2" opacity=".8"/>
      <rect x="36" y="22" width="48" height="3.5" rx="1.5" fill="#0891b2" opacity=".7"/>
      {/* Divider */}
      <line x1="0" y1="44" x2="112" y2="44" stroke="rgba(255,255,255,0.06)" strokeWidth="1"/>

      {/* Nav groups */}
      {(() => {
        let groups = []
        let seen = new Set()
        navItems.forEach(item => { if (!seen.has(item.group)) { seen.add(item.group); groups.push(item.group) } })
        let yOffset = 50
        return groups.map(group => {
          const items = navItems.filter(i => i.group === group)
          const groupEl = (
            <g key={group}>
              {/* Group heading */}
              <rect x="8" y={yOffset} width="55" height="4" rx="1.5" fill="#8ba3ad" opacity=".5"/>
              {items.map((item, ii) => {
                const isActive = item.path === activeNav
                const y = yOffset + 8 + ii * 22
                return (
                  <g key={item.path} transform={`translate(6,${y})`}>
                    {isActive && <rect width="100" height="18" rx="4" fill="#0891b218" stroke="#0891b240" strokeWidth=".5"/>}
                    {isActive && <rect width="3" height="18" rx="1.5" fill="#0891b2"/>}
                    <rect x="6" y="4" width="8" height="8" rx="2" fill={isActive ? '#0891b2' : '#8ba3ad'} opacity={isActive ? 1 : .5}/>
                    <rect x="18" y="5.5" width={item.label.length * 3.8} height="4" rx="1.5" fill={isActive ? '#e8f0f2' : '#8ba3ad'} opacity={isActive ? .9 : .5} style={{maxWidth: 76}}/>
                  </g>
                )
              })}
              {(() => { yOffset += 8 + items.length * 22 + 6; return null })()}
            </g>
          )
          return groupEl
        })
      })()}

      {/* Top navbar */}
      <rect x="112" y="0" width="448" height="50" fill="#0f1c22"/>
      <line x1="112" y1="50" x2="560" y2="50" stroke="rgba(255,255,255,0.06)" strokeWidth="1"/>
      {/* Breadcrumb + subtitle */}
      <rect x="124" y="10" width="50" height="4" rx="2" fill="#8ba3ad" opacity=".6"/>
      <rect x="178" y="9" width="6" height="6" fill="none"/>
      <text x="180" y="14" fill="#8ba3ad" fontSize="8" fontFamily="system-ui" opacity=".6">›</text>
      <rect x="188" y="10" width={pageTitle.length * 4.5} height="5" rx="2" fill="#e8f0f2" opacity=".85"/>
      <rect x="124" y="20" width={pageSubtitle.length * 2.8} height="3.5" rx="1.5" fill="#8ba3ad" opacity=".5"/>
      {/* Spacer then actions */}
      {/* Tour button */}
      <rect x="370" y="15" width="56" height="20" rx="6" fill="#0891b212" stroke="#0891b235" strokeWidth=".8"/>
      <circle cx="382" cy="25" r="3.5" fill="#0891b2"/>
      <rect x="389" y="22.5" width="30" height="4" rx="2" fill="#7dd3fc" opacity=".8"/>
      {/* Avatar */}
      <circle cx="450" cy="25" r="12" fill="linear-gradient(135deg,#0891b2,#14b8a6)"/>
      <circle cx="450" cy="25" r="12" fill="#0891b2" opacity=".8"/>
      <rect x="446" y="21" width="8" height="8" rx="4" fill="#fff" opacity=".8"/>
      {/* Logout */}
      <rect x="468" y="15" width="44" height="20" rx="6" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" strokeWidth=".7"/>
      <rect x="476" y="22" width="28" height="4" rx="2" fill="#8ba3ad" opacity=".7"/>

      {/* Page content area */}
      <rect x="112" y="50" width="448" height="270" fill="#0d161b"/>
      {children}
    </svg>
  )
}

// ─── Individual page illustrations ────────────────────────────────────────────

function IllustrationWelcome() {
  return (
    <AppShell activeNav="/dashboard" pageTitle="Dashboard" pageSubtitle="Overview of restroom feedback and device health">
      {/* Dashboard KPI cards — matches DashboardCards.jsx exactly */}
      {/* Row 1: Unhappy Reports, Active Alerts, Today's Feedback, Total Restrooms, Total Devices */}
      {[
        { icon: '⚠️', label: "Unhappy Reports Today", value: '8',    color: '#ef4444', x: 120 },
        { icon: '🔔', label: "Active Alerts",          value: '3',    color: '#f59e0b', x: 210 },
        { icon: '💬', label: "Today's Feedback",       value: '124',  color: '#0891b2', x: 300 },
        { icon: '🚻', label: "Total Restrooms",        value: '12',   color: '#14b8a6', x: 390 },
        { icon: '📱', label: "Total Devices",          value: '36',   color: '#6366f1', x: 480 },
      ].map((c, i) => (
        <g key={i} transform={`translate(${c.x}, 58)`}>
          <rect width="82" height="52" rx="6" fill="#162329" stroke="rgba(255,255,255,0.08)" strokeWidth=".8"/>
          <rect x="0" y="0" width="4" height="52" rx="3" fill={c.color} opacity=".7"/>
          <text x="14" y="22" fontSize="14" fontFamily="system-ui">{c.icon}</text>
          <rect x="14" y="28" width={c.label.length * 2.1} height="3.5" rx="1.5" fill="#8ba3ad" opacity=".7"/>
          <rect x="14" y="36" width="32" height="8" rx="2" fill="#e8f0f2" opacity=".8"/>
        </g>
      ))}

      {/* Row 2: Online Devices, Offline Devices, Happy, Okay */}
      {[
        { icon: '🟢', label: 'Online Devices',  value: '31', color: '#10b981', x: 120 },
        { icon: '🔴', label: 'Offline Devices', value: '5',  color: '#ef4444', x: 210 },
        { icon: '😊', label: 'Happy',           value: '96', color: '#10b981', x: 300 },
        { icon: '😐', label: 'Okay',            value: '20', color: '#f59e0b', x: 390 },
      ].map((c, i) => (
        <g key={i} transform={`translate(${c.x}, 116)`}>
          <rect width="82" height="52" rx="6" fill="#162329" stroke="rgba(255,255,255,0.08)" strokeWidth=".8"/>
          <rect x="0" y="0" width="4" height="52" rx="3" fill={c.color} opacity=".7"/>
          <text x="14" y="22" fontSize="14" fontFamily="system-ui">{c.icon}</text>
          <rect x="14" y="28" width={c.label.length * 2.1} height="3.5" rx="1.5" fill="#8ba3ad" opacity=".7"/>
          <rect x="14" y="36" width="28" height="8" rx="2" fill="#e8f0f2" opacity=".8"/>
        </g>
      ))}

      {/* Feedback chart */}
      <rect x="120" y="176" width="220" height="120" rx="6" fill="#162329" stroke="rgba(255,255,255,0.08)" strokeWidth=".8"/>
      <rect x="130" y="186" width="80" height="4.5" rx="2" fill="#e8f0f2" opacity=".7"/>
      {/* Legend */}
      <rect x="130" y="196" width="8" height="4" rx="2" fill="#10b981"/>
      <rect x="142" y="196" width="18" height="4" rx="2" fill="#8ba3ad" opacity=".5"/>
      <rect x="164" y="196" width="8" height="4" rx="2" fill="#f59e0b"/>
      <rect x="176" y="196" width="14" height="4" rx="2" fill="#8ba3ad" opacity=".5"/>
      <rect x="194" y="196" width="8" height="4" rx="2" fill="#ef4444"/>
      <rect x="206" y="196" width="22" height="4" rx="2" fill="#8ba3ad" opacity=".5"/>
      {/* bars */}
      {[0,1,2,3,4,5,6].map(i => {
        const h = [22,35,28,44,32,50,30][i]
        return (
          <g key={i} transform={`translate(${130+i*26},${290-h})`}>
            <rect width="8" height={h*.55} rx="2" fill="#10b98130"/>
            <rect y={h*.55} width="8" height={h*.3} rx="2" fill="#f59e0b25"/>
            <rect y={h*.85} width="8" height={h*.15} rx="2" fill="#ef444430"/>
          </g>
        )
      })}

      {/* Active Alerts widget */}
      <rect x="350" y="176" width="200" height="120" rx="6" fill="#162329" stroke="rgba(255,255,255,0.08)" strokeWidth=".8"/>
      <rect x="360" y="186" width="70" height="4.5" rx="2" fill="#e8f0f2" opacity=".7"/>
      <rect x="508" y="183" width="36" height="12" rx="4" fill="none" stroke="#0891b240" strokeWidth=".5"/>
      <rect x="514" y="186" width="24" height="4" rx="2" fill="#0891b260"/>
      {/* Alert rows */}
      {[
        { type: 'Unhappy Feedback', restroom: "Men's B2-F1", status: 'open',     statusColor: '#ef4444', time: '09:42 PM' },
        { type: 'Unhappy Feedback', restroom: "Women's A1",  status: 'assigned', statusColor: '#f59e0b', time: '09:38 PM' },
        { type: 'Unhappy Feedback', restroom: "Men's C3-F1", status: 'open',     statusColor: '#ef4444', time: '09:30 PM' },
      ].map((a, i) => (
        <g key={i} transform={`translate(360,${200+i*30})`}>
          <rect x="0" y="2" width="4" height="22" rx="2" fill={a.statusColor} opacity=".7"/>
          <rect x="8" y="5" width="80" height="4" rx="2" fill="#e8f0f2" opacity=".6"/>
          <rect x="8" y="13" width="60" height="3.5" rx="1.5" fill="#8ba3ad" opacity=".6"/>
          {/* status badge */}
          <rect x="152" y="4" width="36" height="14" rx="5" fill={a.statusColor + '20'} stroke={a.statusColor + '40'} strokeWidth=".5"/>
          <rect x="156" y="9" width="28" height="3.5" rx="1.75" fill={a.statusColor + '80'}/>
        </g>
      ))}
    </AppShell>
  )
}

function IllustrationOrgSetup() {
  return (
    <AppShell activeNav="/users" pageTitle="User Management" pageSubtitle="Manage users, roles, and access">
      {/* Hierarchy tree */}
      {/* Header action row */}
      <rect x="120" y="60" width="430" height="30" rx="6" fill="#162329" stroke="rgba(255,255,255,0.08)" strokeWidth=".8"/>
      <rect x="132" y="70" width="100" height="4.5" rx="2" fill="#e8f0f2" opacity=".7"/>
      <rect x="460" y="65" width="80" height="18" rx="6" fill="#0891b220" stroke="#0891b240" strokeWidth=".8"/>
      <rect x="470" y="72" width="58" height="4" rx="2" fill="#0891b270"/>

      {/* Hierarchy boxes */}
      {[
        { label: 'Super Admin',     sub: 'Full system control',        color: '#ef4444', depth: 0 },
        { label: 'Organisation',    sub: 'Vendor / client entity',     color: '#f59e0b', depth: 1 },
        { label: 'Vendor Admin',    sub: 'Manages org resources',      color: '#f97316', depth: 2 },
        { label: 'Site → Floor',    sub: 'Physical hierarchy',         color: '#0891b2', depth: 3 },
        { label: 'Restroom / Zone', sub: 'Mapped to devices',          color: '#14b8a6', depth: 4 },
        { label: 'Device (Badge)',  sub: 'Assigned to restroom',       color: '#10b981', depth: 5 },
      ].map((n, i) => (
        <g key={i} transform={`translate(${120 + n.depth * 14}, ${100 + i * 28})`}>
          {i > 0 && <line x1="-2" y1="-8" x2="-2" y2="10" stroke="rgba(255,255,255,0.1)" strokeWidth="1"/>}
          {i > 0 && <line x1="-2" y1="10" x2="8" y2="10" stroke="rgba(255,255,255,0.1)" strokeWidth="1"/>}
          <rect width={280 - n.depth * 14} height="22" rx="5" fill="#162329" stroke={n.color + '40'} strokeWidth=".8"/>
          <rect width="4" height="22" rx="2" fill={n.color} opacity=".7"/>
          <rect x="10" y="6" width={70} height="4" rx="2" fill="#e8f0f2" opacity=".75"/>
          <rect x="10" y="14" width={55} height="3" rx="1.5" fill="#8ba3ad" opacity=".6"/>
          {/* role badge */}
          <rect x="200" y="5" width="70" height="12" rx="5" fill={n.color + '15'} stroke={n.color + '30'} strokeWidth=".5"/>
          <rect x="206" y="8.5" width={50} height="3.5" rx="1.75" fill={n.color + '70'}/>
        </g>
      ))}

      {/* Right: action list */}
      <rect x="420" y="100" width="130" height="178" rx="6" fill="#0f1c22" stroke="rgba(255,255,255,0.08)" strokeWidth=".8"/>
      <rect x="430" y="110" width="80" height="4.5" rx="2" fill="#0891b260"/>
      {['Create Organisation','Add Sites','Configure Floors','Upload Floor Plans','Register Users','Assign Roles','Register Devices','Configure Settings'].map((t,i) => (
        <g key={i} transform={`translate(430,${120+i*20})`}>
          <circle cx="5" cy="5" r="3.5" fill="#0891b2" opacity=".6"/>
          <rect x="13" y="2" width={t.length * 2.8} height="4" rx="2" fill="#e8f0f2" opacity=".55"/>
        </g>
      ))}
    </AppShell>
  )
}

function IllustrationAuthFlow() {
  return (
    <AppShell activeNav="/dashboard" pageTitle="Dashboard" pageSubtitle="Secure JWT authentication">
      {/* Auth flow diagram */}
      {[
        { label: 'Login Form',      sub: 'Email + Password',          color: '#0891b2', x: 120, y: 65 },
        { label: 'POST /auth/login',sub: 'API call',                  color: '#8b5cf6', x: 230, y: 65 },
        { label: 'JWT Generated',   sub: 'Signed token',              color: '#f59e0b', x: 340, y: 65 },
        { label: 'Token Stored',    sub: 'localStorage',              color: '#10b981', x: 450, y: 65 },
        { label: 'API Request',     sub: 'Bearer JWT header',         color: '#0891b2', x: 120, y: 165 },
        { label: 'Role Check',      sub: 'Permission middleware',     color: '#f97316', x: 230, y: 165 },
        { label: 'API Response',    sub: 'Scoped to your org',        color: '#10b981', x: 340, y: 165 },
      ].map((n, i) => (
        <g key={i} transform={`translate(${n.x}, ${n.y})`}>
          <rect width="100" height="52" rx="7" fill="#162329" stroke={n.color + '45'} strokeWidth="1"/>
          <rect width="100" height="5" rx="4" fill={n.color} opacity=".5"/>
          <rect x="8" y="13" width="72" height="4.5" rx="2" fill="#e8f0f2" opacity=".75"/>
          <rect x="8" y="21" width="55" height="3.5" rx="1.75" fill="#8ba3ad" opacity=".6"/>
          <rect x="8" y="32" width="40" height="12" rx="4" fill={n.color + '18'} stroke={n.color + '35'} strokeWidth=".5"/>
          <circle cx="91" cy="11" r="5" fill={n.color} opacity=".8"/>
          {/* connector arrow */}
          {i < 3 && <line x1="100" y1="26" x2="110" y2="26" stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="3 2"/>}
          {i === 3 && <path d="M50 52 L50 90 L-220 90 L-220 140" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="3 2"/>}
          {i >= 4 && i < 6 && <line x1="100" y1="26" x2="110" y2="26" stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="3 2"/>}
        </g>
      ))}
      {/* JWT token anatomy */}
      <rect x="120" y="235" width="430" height="40" rx="6" fill="#0f1c22" stroke="rgba(255,255,255,0.08)"/>
      <rect x="130" y="243" width="80" height="5" rx="2.5" fill="#ef444435"/>
      <rect x="212" y="240" width="2" height="20" rx="1" fill="rgba(255,255,255,0.12)"/>
      <rect x="216" y="243" width="108" height="5" rx="2.5" fill="#8b5cf635"/>
      <rect x="326" y="240" width="2" height="20" rx="1" fill="rgba(255,255,255,0.12)"/>
      <rect x="330" y="243" width="118" height="5" rx="2.5" fill="#10b98135"/>
      <rect x="130" y="252" width="50" height="3.5" rx="1.5" fill="#ef444455"/>
      <rect x="216" y="252" width="75" height="3.5" rx="1.5" fill="#8b5cf655"/>
      <rect x="330" y="252" width="80" height="3.5" rx="1.5" fill="#10b98155"/>
    </AppShell>
  )
}

function IllustrationSiteConfig() {
  return (
    <AppShell activeNav="/site-config" pageTitle="Site Configuration" pageSubtitle="Map and configure sites, floors, zones, and devices">
      {/* Wizard steps */}
      {['Organisation','Site','Floor','Zone','Devices'].map((s, i) => (
        <g key={i} transform={`translate(${120 + i * 86}, 60)`}>
          <rect width="78" height="22" rx="6" fill={i <= 1 ? '#0891b225' : '#162329'} stroke={i <= 1 ? '#0891b248' : 'rgba(255,255,255,0.08)'} strokeWidth=".8"/>
          <circle cx="12" cy="11" r="7" fill={i <= 1 ? '#0891b2' : 'rgba(255,255,255,0.08)'}/>
          <text x="12" y="14.5" textAnchor="middle" fill="#fff" fontSize="7" fontWeight="800" fontFamily="system-ui">{i+1}</text>
          <rect x="24" y="8" width={s.length * 3.6} height="4" rx="2" fill={i <= 1 ? '#e8f0f2' : '#8ba3ad'} opacity={i <= 1 ? .8 : .5}/>
          {i < 4 && <line x1="78" y1="11" x2="86" y2="11" stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="3 2"/>}
        </g>
      ))}
      {/* Site tree panel */}
      <rect x="120" y="92" width="110" height="196" rx="6" fill="#162329" stroke="rgba(255,255,255,0.08)" strokeWidth=".8"/>
      <rect x="130" y="102" width="60" height="4.5" rx="2" fill="#e8f0f2" opacity=".7"/>
      {[
        { label: 'Pune Mall', depth: 0, color: '#0891b2', active: true },
        { label: 'Ground Floor', depth: 12, color: '#10b981', active: false },
        { label: "Men's Restroom", depth: 24, color: '#8ba3ad', active: false },
        { label: "Women's Restroom", depth: 24, color: '#8ba3ad', active: false },
        { label: 'First Floor', depth: 12, color: '#10b981', active: false },
        { label: "Men's Restroom", depth: 24, color: '#8ba3ad', active: false },
        { label: 'Mumbai Site', depth: 0, color: '#0891b2', active: false },
      ].map((n, i) => (
        <g key={i} transform={`translate(${128 + n.depth}, ${114 + i * 22})`}>
          {n.active && <rect width={90 - n.depth} height="16" rx="3" fill="#0891b218"/>}
          <rect x="2" y="5" width="5" height="5" rx="2" fill={n.color} opacity=".8"/>
          <rect x="10" y="6" width={Math.min(n.label.length * 3.5, 68 - n.depth)} height="3.5" rx="1.5" fill={n.active ? '#e8f0f2' : '#8ba3ad'} opacity={n.active ? .85 : .6}/>
        </g>
      ))}

      {/* Floor plan canvas */}
      <rect x="240" y="92" width="310" height="196" rx="6" fill="#0a1620" stroke="#0891b228" strokeWidth="1"/>
      {/* Grid */}
      {[120,148,176,204,232,260].map(y => <line key={y} x1="240" y1={y} x2="550" y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth=".5"/>)}
      {[270,310,350,390,430,470,510].map(x => <line key={x} x1={x} y1="92" x2={x} y2="288" stroke="rgba(255,255,255,0.04)" strokeWidth=".5"/>)}
      {/* Zones */}
      <rect x="254" y="104" width="120" height="80" rx="6" fill="#0891b212" stroke="#0891b250" strokeWidth="1.2"/>
      <rect x="384" y="104" width="80" height="80" rx="6" fill="#10b98112" stroke="#10b98150" strokeWidth="1.2"/>
      <rect x="254" y="196" width="80" height="82" rx="6" fill="#f59e0b12" stroke="#f59e0b50" strokeWidth="1.2"/>
      <rect x="344" y="196" width="120" height="82" rx="6" fill="#ef444412" stroke="#ef444450" strokeWidth="1.2"/>
      {/* Zone labels */}
      <rect x="264" y="140" width="50" height="4" rx="2" fill="#0891b255"/>
      <rect x="394" y="140" width="44" height="4" rx="2" fill="#10b98155"/>
      <rect x="264" y="232" width="44" height="4" rx="2" fill="#f59e0b55"/>
      <rect x="354" y="232" width="54" height="4" rx="2" fill="#ef444455"/>
      {/* Device dots */}
      {[[268,116,'#10b981'],[292,112,'#10b981'],[318,120,'#10b981'],[396,116,'#f59e0b'],[422,112,'#10b981'],[264,210,'#ef4444'],[292,218,'#10b981'],[358,208,'#10b981'],[390,212,'#10b981']].map(([x,y,c],i) => (
        <g key={i}><circle cx={x} cy={y} r="6" fill={c} opacity=".15"/><circle cx={x} cy={y} r="3.5" fill={c} opacity=".9"/></g>
      ))}
    </AppShell>
  )
}

function IllustrationDeviceSetup() {
  return (
    <AppShell activeNav="/devices" pageTitle="Device Management" pageSubtitle="Monitor badge devices, battery, and connectivity">
      {/* Summary cards — match DashboardCards style */}
      {[
        { icon: '📱', label: 'Total Devices',  value: '36',  color: '#6366f1', x: 120 },
        { icon: '🟢', label: 'Online',         value: '31',  color: '#10b981', x: 230 },
        { icon: '⚡', label: 'Low Battery',    value: '4',   color: '#f59e0b', x: 340 },
        { icon: '🔴', label: 'Offline',        value: '1',   color: '#ef4444', x: 450 },
      ].map((c, i) => (
        <g key={i} transform={`translate(${c.x}, 60)`}>
          <rect width="100" height="52" rx="6" fill="#162329" stroke="rgba(255,255,255,0.08)" strokeWidth=".8"/>
          <rect width="4" height="52" rx="2" fill={c.color} opacity=".7"/>
          <text x="14" y="22" fontSize="14" fontFamily="system-ui">{c.icon}</text>
          <rect x="14" y="28" width={c.label.length * 2.6} height="3.5" rx="1.5" fill="#8ba3ad" opacity=".7"/>
          <rect x="14" y="36" width="28" height="8" rx="2" fill="#e8f0f2" opacity=".8"/>
        </g>
      ))}
      {/* Device table — columns: EUI / Location / Status / Battery / Last Seen / Actions */}
      {/* Header */}
      <rect x="120" y="122" width="430" height="20" rx="4" fill="#0f1c22" stroke="rgba(255,255,255,0.08)" strokeWidth=".8"/>
      {['Device EUI','Location','Status','Battery','Last Seen','Actions'].map((h,i) => (
        <rect key={i} x={128 + [0,84,164,226,298,378][i]} y="128" width={[72,68,50,60,68,46][i]} height="4" rx="2" fill="#8ba3ad" opacity=".6"/>
      ))}
      {/* Rows */}
      {[
        { eui:'AC12-34AB-EF56', loc:'Pune - GF',   status:'online',      statusColor:'#10b981', bat:88 },
        { eui:'AC12-34AB-EF57', loc:'Pune - GF',   status:'online',      statusColor:'#10b981', bat:74 },
        { eui:'AC12-34AB-EF58', loc:'Mumbai - 1F', status:'low_battery', statusColor:'#f59e0b', bat:13 },
        { eui:'AC12-34AB-EF59', loc:'Pune - 1F',   status:'offline',     statusColor:'#ef4444', bat:0  },
        { eui:'AC12-34AB-EF60', loc:'Pune - GF',   status:'online',      statusColor:'#10b981', bat:95 },
        { eui:'AC12-34AB-EF61', loc:'Mumbai - GF', status:'online',      statusColor:'#10b981', bat:62 },
      ].map((d, i) => (
        <g key={i} transform={`translate(120, ${144+i*24})`}>
          <rect width="430" height="22" rx="3" fill={i%2===0?'#162329':'#1a2830'} stroke="rgba(255,255,255,0.05)" strokeWidth=".5"/>
          {/* EUI */}
          <rect x="8" y="7" width="72" height="4" rx="2" fill="#e8f0f2" opacity=".6"/>
          {/* Location */}
          <rect x="92" y="7" width="62" height="4" rx="2" fill="#8ba3ad" opacity=".6"/>
          {/* Status badge — matches StatusBadge component */}
          <rect x="164" y="4.5" width="52" height="13" rx="5" fill={d.statusColor + '20'}/>
          <circle cx="173" cy="11" r="3.5" fill={d.statusColor} opacity=".9"/>
          <rect x="180" y="8" width="28" height="4" rx="2" fill={d.statusColor + '80'}/>
          {/* Battery bar */}
          <rect x="226" y="7" width="60" height="7" rx="3.5" fill="rgba(255,255,255,0.08)"/>
          <rect x="226" y="7" width={Math.max(4, d.bat * 0.6)} height="7" rx="3.5" fill={d.bat > 30 ? '#10b981' : d.bat > 10 ? '#f59e0b' : '#ef4444'} opacity=".75"/>
          {/* Last Seen */}
          <rect x="298" y="7" width="66" height="4" rx="2" fill="#8ba3ad" opacity=".5"/>
          {/* Actions */}
          <rect x="378" y="5" width="20" height="12" rx="4" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" strokeWidth=".5"/>
          <rect x="402" y="5" width="20" height="12" rx="4" fill="#0891b215" stroke="#0891b235" strokeWidth=".5"/>
        </g>
      ))}
    </AppShell>
  )
}

function IllustrationButtonPress() {
  return (
    <AppShell activeNav="/live-feedback" pageTitle="Live Feedback" pageSubtitle="Real-time feedback from restroom devices">
      {/* Device physical mockup */}
      <rect x="380" y="65" width="150" height="200" rx="14" fill="#0f1c22" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5"/>
      <rect x="392" y="78" width="126" height="18" rx="4" fill="#0891b218"/>
      <rect x="400" y="83" width="80" height="4" rx="2" fill="#0891b250"/>
      <rect x="396" y="100" width="16" height="3" rx="1.5" fill="#8ba3ad" opacity=".4"/>
      {/* 3 buttons */}
      {[
        { y: 108, color:'#10b981', label:'😊 HAPPY' },
        { y: 152, color:'#f59e0b', label:'😐 OKAY' },
        { y: 196, color:'#ef4444', label:'😞 UNHAPPY', active: true },
      ].map((b) => (
        <g key={b.y} transform={`translate(394,${b.y})`}>
          {b.active && <rect width="112" height="38" rx="10" fill={b.color} opacity=".08"/>}
          <rect width="112" height="36" rx="10" fill={b.color + (b.active ? '28' : '15')} stroke={b.color + (b.active ? '80' : '40')} strokeWidth={b.active ? '2' : '1'}/>
          {b.active && <rect x="1" y="1" width="110" height="34" rx="9" fill="none" stroke={b.color} strokeWidth=".8" strokeOpacity=".5"/>}
          <rect x="12" y="14" width={b.label.length * 4.2} height="5" rx="2" fill={b.color} opacity={b.active ? .9 : .55}/>
          {b.active && <circle cx="98" cy="10" r="6" fill={b.color} opacity=".9"/>}
        </g>
      ))}
      {/* Signal waves */}
      {[1,2,3].map(r => (
        <ellipse key={r} cx="340" cy="165" rx={r*28} ry={r*16}
          fill="none" stroke="#8b5cf6" strokeWidth=".8" strokeOpacity={.4/r} strokeDasharray="4 3"/>
      ))}
      <circle cx="340" cy="165" r="8" fill="#8b5cf620" stroke="#8b5cf270" strokeWidth="1"/>
      <circle cx="340" cy="165" r="4" fill="#8b5cf6" opacity=".8"/>

      {/* Live table showing the incoming event */}
      <rect x="120" y="60" width="252" height="210" rx="6" fill="#162329" stroke="rgba(255,255,255,0.08)" strokeWidth=".8"/>
      {/* toolbar */}
      <rect x="130" y="70" width="50" height="14" rx="5" fill="#10b98118" stroke="#10b98140" strokeWidth=".5"/>
      <circle cx="140" cy="77" r="3" fill="#10b981"/>
      <rect x="147" y="74.5" width="22" height="4" rx="2" fill="#10b98170"/>
      {/* table header */}
      <rect x="130" y="92" width="232" height="16" rx="3" fill="#0f1c22"/>
      {['Time','Restroom','Floor','Type'].map((h,i) => (
        <rect key={i} x={136+[0,56,124,184][i]} y="98" width={[44,60,50,36][i]} height="3.5" rx="1.5" fill="#8ba3ad" opacity=".6"/>
      ))}
      {/* rows — first row highlighted as new unhappy event */}
      {[
        { type:'😞 Unhappy', restroom:"Men's B2-F1", floor:'GF',   color:'#ef4444', fresh:true },
        { type:'😊 Happy',   restroom:"Women's A1",  floor:'1F',   color:'#10b981', fresh:false },
        { type:'😐 Okay',    restroom:"Men's C3",    floor:'2F',   color:'#f59e0b', fresh:false },
        { type:'😊 Happy',   restroom:"Women's B1",  floor:'GF',   color:'#10b981', fresh:false },
        { type:'😞 Unhappy', restroom:"Men's A2",    floor:'1F',   color:'#ef4444', fresh:false },
      ].map((r, i) => (
        <g key={i} transform={`translate(130,${110+i*24})`}>
          <rect width="232" height="22" rx="3" fill={r.fresh ? '#ef444410' : (i%2===0?'#162329':'#1a2830')} stroke={r.fresh?'#ef444430':'rgba(255,255,255,0.05)'} strokeWidth=".5"/>
          <rect x="4" y="6" width="36" height="3.5" rx="1.5" fill="#8ba3ad" opacity=".6"/>
          <rect x="48" y="6" width="55" height="3.5" rx="1.5" fill="#e8f0f2" opacity={r.fresh?.8:.5}/>
          <rect x="116" y="6" width="22" height="3.5" rx="1.5" fill="#8ba3ad" opacity=".5"/>
          {/* type badge */}
          <rect x="152" y="3.5" width="56" height="14" rx="5" fill={r.color + '20'}/>
          <circle cx="161" cy="10.5" r="3.5" fill={r.color} opacity=".9"/>
          <rect x="168" y="7.5" width="32" height="4" rx="2" fill={r.color + '80'}/>
        </g>
      ))}
    </AppShell>
  )
}

function IllustrationTTN() {
  return (
    <AppShell activeNav="/devices" pageTitle="Device Management" pageSubtitle="LoRaWAN → TTN payload decoding">
      {/* TTN payload card */}
      <rect x="120" y="60" width="430" height="160" rx="8" fill="#162329" stroke="rgba(255,255,255,0.08)" strokeWidth=".8"/>
      <rect x="130" y="70" width="120" height="5" rx="2" fill="#f9731660"/>
      <rect x="130" y="79" width="180" height="3.5" rx="1.5" fill="#8ba3ad" opacity=".5"/>
      {/* Payload fields */}
      {[
        ['Device EUI',    'AC12-34AB-EF56-7890',  '#0891b2'],
        ['Button Value',  '3',                    '#ef4444'],
        ['Timestamp',     '2024-01-15 09:42:33',  '#8ba3ad'],
        ['Battery Level', '82%',                  '#10b981'],
        ['Gateway EUI',   'BB00-0000-0000-0001',  '#8b5cf6'],
        ['Signal RSSI',   '-87 dBm',              '#f59e0b'],
        ['Signal SNR',    '7.5 dB',               '#f59e0b'],
      ].map(([k,v,c], i) => (
        <g key={i} transform={`translate(130, ${92+i*17})`}>
          <rect width="412" height="14" rx="3" fill={i%2===0?'#0f1c22':'#162329'} stroke="rgba(255,255,255,0.05)" strokeWidth=".3"/>
          <rect x="4" y="4" width="5" height="5" rx="2" fill={c} opacity=".7"/>
          <rect x="12" y="4.5" width={k.length*3.8} height="4" rx="2" fill="#8ba3ad" opacity=".65"/>
          <rect x="160" y="4.5" width={v.length*3.5} height="4" rx="2" fill={c + 'bb'}/>
        </g>
      ))}

      {/* Mapping table */}
      <rect x="120" y="232" width="430" height="50" rx="6" fill="#0f1c22" stroke="rgba(255,255,255,0.08)" strokeWidth=".8"/>
      <rect x="130" y="240" width="110" height="4.5" rx="2" fill="#e8f0f2" opacity=".6"/>
      {[['1','😊 HAPPY','#10b981'],['2','😐 OKAY','#f59e0b'],['3','😞 UNHAPPY','#ef4444']].map(([n,l,c],i) => (
        <g key={i} transform={`translate(${130+i*144}, 250)`}>
          <rect width="134" height="22" rx="5" fill={c+'15'} stroke={c+'35'} strokeWidth=".7"/>
          <rect x="8" y="7" width="14" height="8" rx="3" fill={c+'25'} stroke={c+'45'}/>
          <rect x="10" y="10" width="10" height="4" rx="2" fill={c+'90'}/>
          <rect x="30" y="8" width="14" height="7" rx="2" fill="rgba(255,255,255,0.12)"/>
          <rect x="51" y="8" width="5" height="7" rx="1.5" fill="rgba(255,255,255,0.12)"/>
          <rect x="64" y="6" width="62" height="10" rx="4" fill={c+'20'} stroke={c+'40'} strokeWidth=".5"/>
          <rect x="70" y="9" width="48" height="4" rx="2" fill={c+'80'}/>
        </g>
      ))}
    </AppShell>
  )
}

function IllustrationMQTT() {
  return (
    <AppShell activeNav="/live-feedback" pageTitle="Live Feedback" pageSubtitle="MQTT → Payload Decoder → Feedback Service">
      {/* Pipeline boxes */}
      {[
        { label:'TTN MQTT Broker',      sub:'Receives LoRaWAN uplink',       color:'#f97316', x:120, y:65 },
        { label:'MQTT Service',         sub:'Subscribes to TTN topic',        color:'#8b5cf6', x:120, y:130 },
        { label:'Payload Decoder',      sub:'Parses button + EUI + battery',  color:'#0891b2', x:300, y:65 },
        { label:'Device Lookup',        sub:'Finds device → site → restroom', color:'#f59e0b', x:300, y:130 },
        { label:'Feedback Service',     sub:'Creates feedback record in DB',  color:'#10b981', x:300, y:195 },
        { label:'Socket.IO Emit',       sub:'Broadcasts to connected clients',color:'#14b8a6', x:120, y:195 },
      ].map((n, i) => (
        <g key={i} transform={`translate(${n.x}, ${n.y})`}>
          <rect width="168" height="52" rx="7" fill="#162329" stroke={n.color + '45'} strokeWidth="1"/>
          <rect width="168" height="5" rx="4" fill={n.color} opacity=".5"/>
          <rect x="8" y="13" width="130" height="4.5" rx="2" fill="#e8f0f2" opacity=".75"/>
          <rect x="8" y="21" width="105" height="3.5" rx="1.75" fill="#8ba3ad" opacity=".55"/>
          <rect x="8" y="30" width="50" height="14" rx="5" fill={n.color + '18'} stroke={n.color + '35'} strokeWidth=".5"/>
          <rect x="14" y="34.5" width="36" height="4" rx="2" fill={n.color + '70'}/>
        </g>
      ))}
      {/* Connecting lines */}
      <line x1="204" y1="91" x2="300" y2="91" stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="4 3"/>
      <line x1="204" y1="156" x2="300" y2="156" stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="4 3"/>
      <line x1="204" y1="221" x2="300" y2="221" stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="4 3"/>
      <line x1="384" y1="117" x2="384" y2="130" stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="4 3"/>
      <line x1="384" y1="182" x2="384" y2="195" stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="4 3"/>
      <line x1="204" y1="117" x2="204" y2="130" stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="4 3"/>
      <line x1="204" y1="182" x2="204" y2="195" stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="4 3"/>

      {/* Result row */}
      <rect x="120" y="260" width="430" height="36" rx="6" fill="#0f1c22" stroke="rgba(255,255,255,0.08)"/>
      {['Device','Gateway','Site','Floor','Restroom'].map((l,i) => (
        <g key={i} transform={`translate(${130+i*84},268)`}>
          <rect width="74" height="20" rx="5" fill="#162329" stroke="rgba(255,255,255,0.08)"/>
          <rect x="5" y="7.5" width={l.length*4.2} height="4" rx="2" fill="#e8f0f2" opacity=".6"/>
          {i<4 && <text x="77" y="13" fill="rgba(255,255,255,0.2)" fontSize="10" fontFamily="system-ui">→</text>}
        </g>
      ))}
    </AppShell>
  )
}

function IllustrationFeedbackStorage() {
  return (
    <AppShell activeNav="/live-feedback" pageTitle="Live Feedback" pageSubtitle="Feedback record saved to PostgreSQL">
      {/* DB cylinder visual */}
      <ellipse cx="220" cy="80" rx="60" ry="16" fill="#162329" stroke="#0891b240" strokeWidth="1.2"/>
      <rect x="160" y="80" width="120" height="55" fill="#162329" stroke="#0891b240" strokeWidth="1.2"/>
      <line x1="160" y1="96" x2="280" y2="96" stroke="#0891b220"/>
      <line x1="160" y1="112" x2="280" y2="112" stroke="#0891b220"/>
      <ellipse cx="220" cy="135" rx="60" ry="16" fill="#162329" stroke="#0891b240" strokeWidth="1.2"/>
      <rect x="168" y="88" width="55" height="4" rx="2" fill="#0891b255"/>
      <rect x="168" y="100" width="84" height="3.5" rx="1.5" fill="#8ba3ad" opacity=".5"/>
      <rect x="168" y="116" width="72" height="3.5" rx="1.5" fill="#8ba3ad" opacity=".4"/>

      {/* Record card */}
      <rect x="300" y="60" width="250" height="225" rx="8" fill="#162329" stroke="rgba(255,255,255,0.08)" strokeWidth=".8"/>
      <rect x="310" y="72" width="100" height="5" rx="2" fill="#0891b260"/>
      <rect x="310" y="80" width="70" height="3.5" rx="1.5" fill="#8ba3ad" opacity=".5"/>
      {[
        ['Device',   'DEVICE-001',        '#0891b2'],
        ['Site',     'Pune Mall',         '#10b981'],
        ['Floor',    'Ground Floor',      '#f59e0b'],
        ['Restroom', "Men's Restroom",    '#8b5cf6'],
        ['Feedback', 'UNHAPPY',           '#ef4444'],
        ['Time',     '09:42 PM',          '#94a3b8'],
        ['Battery',  '82%',               '#10b981'],
        ['Signal',   '-87 dBm / 7.5 dB', '#8ba3ad'],
      ].map(([k,v,c], i) => (
        <g key={i} transform={`translate(310, ${92+i*22})`}>
          <rect width="230" height="18" rx="4" fill={i%2===0?'#0f1c22':'#162329'} stroke="rgba(255,255,255,0.05)" strokeWidth=".3"/>
          <rect x="4" y="5" width="52" height="4" rx="2" fill="#8ba3ad" opacity=".6"/>
          <rect x="64" y="5" width={3} height="8" rx="1.5" fill="rgba(255,255,255,0.08)"/>
          <rect x="72" y="5" width={v.length * 3.5} height="4" rx="2" fill={c + 'cc'}/>
        </g>
      ))}
    </AppShell>
  )
}

function IllustrationSocketIO() {
  return (
    <AppShell activeNav="/live-feedback" pageTitle="Live Feedback" pageSubtitle="Real-time updates via Socket.IO — no refresh needed">
      {/* Backend box */}
      <rect x="120" y="70" width="140" height="100" rx="8" fill="#162329" stroke="#0891b235" strokeWidth="1"/>
      <rect x="130" y="82" width="80" height="4.5" rx="2" fill="#0891b260"/>
      {['1. MQTT message received','2. Save to PostgreSQL','3. Emit Socket.IO event'].map((t,i) => (
        <g key={i} transform={`translate(130,${94+i*24})`}>
          <rect width="120" height="18" rx="4" fill={i===2?'#0891b218':'rgba(255,255,255,0.03)'} stroke={i===2?'#0891b235':'rgba(255,255,255,0.06)'}/>
          <circle cx="9" cy="9" r="4" fill={i===2?'#0891b2':'rgba(255,255,255,0.15)'}/>
          <rect x="18" y="6" width={t.length*2.5} height="4" rx="2" fill="#e8f0f2" opacity={i===2?.75:.45}/>
        </g>
      ))}

      {/* Socket.IO bolt */}
      <rect x="290" y="95" width="80" height="50" rx="8" fill="#162530" stroke="#f59e0b35" strokeWidth="1"/>
      <rect x="302" y="103" width="55" height="4.5" rx="2" fill="#f59e0b60"/>
      <polygon points="330,112 320,132 330,130 320,148 345,130 335,132" fill="#f59e0b" opacity=".7"/>

      {/* Frontend box */}
      <rect x="400" y="70" width="150" height="100" rx="8" fill="#162329" stroke="#10b98135" strokeWidth="1"/>
      <rect x="410" y="82" width="90" height="4.5" rx="2" fill="#10b98160"/>
      {['Live Feedback page','Dashboard KPIs','Alert Widget'].map((t,i) => (
        <g key={i} transform={`translate(410,${94+i*24})`}>
          <rect width="130" height="18" rx="4" fill={i===0?'#10b98118':'rgba(255,255,255,0.03)'} stroke={i===0?'#10b98135':'rgba(255,255,255,0.06)'}/>
          <circle cx="9" cy="9" r="4" fill={i===0?'#10b981':'rgba(255,255,255,0.15)'}/>
          <rect x="18" y="6" width={t.length*2.8} height="4" rx="2" fill="#e8f0f2" opacity={i===0?.75:.45}/>
        </g>
      ))}

      {/* Arrows */}
      <line x1="260" y1="120" x2="290" y2="120" stroke="#0891b240" strokeWidth="1.5" strokeDasharray="4 3"/>
      <line x1="370" y1="120" x2="400" y2="120" stroke="#10b98140" strokeWidth="1.5" strokeDasharray="4 3"/>

      {/* Full chain */}
      <rect x="120" y="188" width="430" height="46" rx="6" fill="#0f1c22" stroke="rgba(255,255,255,0.08)"/>
      <rect x="130" y="196" width="120" height="4.5" rx="2" fill="#e8f0f2" opacity=".5"/>
      {['MQTT','Backend','PostgreSQL','Socket.IO','Frontend'].map((l,i) => (
        <g key={i} transform={`translate(${130+i*84},206)`}>
          <rect width="74" height="20" rx="5" fill="#162329" stroke="rgba(255,255,255,0.08)"/>
          <rect x="5" y="7.5" width={l.length*4} height="4" rx="2" fill="#e8f0f2" opacity=".55"/>
          {i<4 && <text x="77" y="13" fill="rgba(255,255,255,0.2)" fontSize="10" fontFamily="system-ui">→</text>}
        </g>
      ))}
    </AppShell>
  )
}

function IllustrationLiveFeedback() {
  return (
    <AppShell activeNav="/live-feedback" pageTitle="Live Feedback" pageSubtitle="Real-time feedback from restroom devices">
      {/* Toolbar */}
      <rect x="120" y="60" width="430" height="36" rx="6" fill="#162329" stroke="rgba(255,255,255,0.08)" strokeWidth=".8"/>
      {/* Live badge */}
      <rect x="130" y="68" width="54" height="20" rx="7" fill="#10b98118" stroke="#10b98140" strokeWidth=".8"/>
      <circle cx="141" cy="78" r="4" fill="#10b981" opacity=".25"/>
      <circle cx="141" cy="78" r="2.5" fill="#10b981"/>
      <rect x="149" y="74.5" width="28" height="4" rx="2" fill="#10b98170"/>
      {/* Filter dropdowns */}
      {['All Types','All Locations','All Floors','All Zones'].map((f,i) => (
        <rect key={i} x={192+i*72} y="68" width="64" height="20" rx="5" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.1)" strokeWidth=".5"/>
      ))}
      <rect x="490" y="68" width="52" height="20" rx="5" fill="#0891b218" stroke="#0891b235" strokeWidth=".5"/>
      <rect x="498" y="74.5" width="36" height="4" rx="2" fill="#0891b260"/>
      {/* Table header */}
      <rect x="120" y="104" width="430" height="20" rx="4" fill="#0f1c22" stroke="rgba(255,255,255,0.08)" strokeWidth=".8"/>
      {['Time','Restroom','Floor','Feedback Type','Device','Source'].map((h,i) => (
        <rect key={i} x={128+[0,70,148,208,306,390][i]} y="111" width={[58,68,48,86,74,58][i]} height="4" rx="2" fill="#8ba3ad" opacity=".6"/>
      ))}
      {/* Data rows */}
      {[
        { type:'Unhappy', restroom:"Men's B2-F1",  floor:'GF',  color:'#ef4444', src:'device', time:'09:42 PM' },
        { type:'Happy',   restroom:"Women's A1",   floor:'1F',  color:'#10b981', src:'device', time:'09:40 PM' },
        { type:'Okay',    restroom:"Men's C3-F2",  floor:'2F',  color:'#f59e0b', src:'device', time:'09:38 PM' },
        { type:'Happy',   restroom:"Women's B1",   floor:'GF',  color:'#10b981', src:'test',   time:'09:35 PM' },
        { type:'Unhappy', restroom:"Men's A2-F1",  floor:'1F',  color:'#ef4444', src:'device', time:'09:30 PM' },
        { type:'Happy',   restroom:"Men's D1-F3",  floor:'3F',  color:'#10b981', src:'device', time:'09:28 PM' },
        { type:'Okay',    restroom:"Women's C2",   floor:'2F',  color:'#f59e0b', src:'device', time:'09:20 PM' },
      ].map((r, i) => (
        <g key={i} transform={`translate(120,${126+i*24})`}>
          <rect width="430" height="22" rx="3" fill={i%2===0?'#162329':'#1a2830'} stroke="rgba(255,255,255,0.04)" strokeWidth=".3"/>
          <rect x="8" y="7" width="56" height="4" rx="2" fill="#8ba3ad" opacity=".55"/>
          <rect x="70" y="7" width={r.restroom.length*3.8} height="4" rx="2" fill="#e8f0f2" opacity=".6"/>
          <rect x="148" y="7" width="28" height="4" rx="2" fill="#8ba3ad" opacity=".5"/>
          {/* feedback type badge — StatusBadge style */}
          <rect x="208" y="3.5" width="74" height="14" rx="5" fill={r.color + '20'}/>
          <circle cx="219" cy="10.5" r="3.5" fill={r.color} opacity=".9"/>
          <rect x="226" y="7.5" width={r.type.length*4} height="4" rx="2" fill={r.color + '80'}/>
          <rect x="306" y="7" width="68" height="4" rx="2" fill="#8ba3ad" opacity=".4"/>
          {/* source badge */}
          <rect x="390" y="3.5" width="34" height="14" rx="5" fill={r.src==='test'?'#6366f115':'rgba(255,255,255,0.05)'} stroke={r.src==='test'?'#6366f130':'rgba(255,255,255,0.08)'} strokeWidth=".5"/>
          <rect x="396" y="7.5" width="20" height="4" rx="2" fill={r.src==='test'?'#6366f170':'#8ba3ad'} opacity=".7"/>
        </g>
      ))}
    </AppShell>
  )
}

function IllustrationAlert() {
  return (
    <AppShell activeNav="/alerts" pageTitle="Alert Management" pageSubtitle="Track, acknowledge, and resolve restroom alerts">
      {/* Stat cards */}
      {[
        { icon:'🔴', label:'Open Alerts',     value:'8',  color:'#ef4444', x:120 },
        { icon:'🟡', label:'In Progress',     value:'3',  color:'#f59e0b', x:240 },
        { icon:'🟢', label:'Resolved Today',  value:'22', color:'#10b981', x:360 },
      ].map((c) => (
        <g key={c.x} transform={`translate(${c.x},60)`}>
          <rect width="110" height="52" rx="6" fill="#162329" stroke="rgba(255,255,255,0.08)" strokeWidth=".8"/>
          <rect width="4" height="52" rx="2" fill={c.color} opacity=".7"/>
          <text x="14" y="22" fontSize="14" fontFamily="system-ui">{c.icon}</text>
          <rect x="14" y="28" width={c.label.length*2.3} height="3.5" rx="1.5" fill="#8ba3ad" opacity=".7"/>
          <rect x="14" y="36" width="28" height="8" rx="2" fill="#e8f0f2" opacity=".8"/>
        </g>
      ))}
      {/* Tab bar */}
      <rect x="120" y="120" width="430" height="28" rx="4" fill="#162329" stroke="rgba(255,255,255,0.08)"/>
      {['Active','History'].map((t,i) => (
        <g key={i} transform={`translate(${130+i*70},124)`}>
          <rect width="62" height="20" rx="4" fill={i===0?'#0891b220':'transparent'} stroke={i===0?'#0891b240':'transparent'}/>
          <rect x="6" y="8" width={t.length*4} height="4" rx="2" fill={i===0?'#0891b2':'#8ba3ad'} opacity={i===0?.9:.55}/>
          {i===0 && <rect x="0" y="20" width="62" height="2" rx="1" fill="#0891b2"/>}
        </g>
      ))}
      {/* Alert rows */}
      {[
        { p:'#ef4444', pl:'Critical', restroom:"Men's Restroom B2-F1",  age:'3 min ago',  status:'open',        statusColor:'#ef4444' },
        { p:'#f97316', pl:'High',     restroom:"Women's Restroom A1",   age:'12 min ago', status:'assigned',    statusColor:'#f59e0b' },
        { p:'#f59e0b', pl:'Medium',   restroom:"Men's Restroom C3-F1",  age:'28 min ago', status:'in_progress', statusColor:'#f59e0b' },
        { p:'#10b981', pl:'Low',      restroom:"Women's Restroom D1",   age:'1 hr ago',   status:'open',        statusColor:'#ef4444' },
      ].map((a, i) => (
        <g key={i} transform={`translate(120,${154+i*38})`}>
          <rect width="430" height="34" rx="6" fill="#162329" stroke="rgba(255,255,255,0.06)" strokeWidth=".6"/>
          <rect width="4" height="34" rx="2" fill={a.p} opacity=".8"/>
          {/* Priority badge */}
          <rect x="10" y="8" width="64" height="16" rx="6" fill={a.p+'18'} stroke={a.p+'35'} strokeWidth=".5"/>
          <circle cx="21" cy="16" r="4" fill={a.p} opacity=".9"/>
          <rect x="29" y="13" width={a.pl.length*4.5} height="4" rx="2" fill={a.p+'80'}/>
          {/* Restroom name */}
          <rect x="82" y="10" width={a.restroom.length*3.5} height="4.5" rx="2" fill="#e8f0f2" opacity=".65"/>
          {/* Age */}
          <rect x="82" y="18" width={a.age.length*3.5} height="3.5" rx="1.5" fill="#8ba3ad" opacity=".55"/>
          {/* Status badge */}
          <rect x="280" y="7" width="60" height="18" rx="6" fill={a.statusColor+'18'} stroke={a.statusColor+'35'} strokeWidth=".5"/>
          <rect x="286" y="13" width="46" height="4" rx="2" fill={a.statusColor+'70'}/>
          {/* Buttons: Acknowledge + Resolve */}
          <rect x="348" y="7" width="38" height="18" rx="5" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.1)" strokeWidth=".5"/>
          <rect x="354" y="13" width="24" height="4" rx="2" fill="#8ba3ad" opacity=".6"/>
          <rect x="392" y="7" width="30" height="18" rx="5" fill="#0891b220" stroke="#0891b240" strokeWidth=".5"/>
          <rect x="397" y="13" width="18" height="4" rx="2" fill="#0891b270"/>
        </g>
      ))}
    </AppShell>
  )
}

function IllustrationTeams() {
  return (
    <AppShell activeNav="/settings" pageTitle="Settings" pageSubtitle="Configure office, alerts, and notification preferences">
      {/* Settings layout — left nav + right form */}
      <rect x="120" y="60" width="90" height="230" rx="6" fill="#0f1c22" stroke="rgba(255,255,255,0.08)" strokeWidth=".8"/>
      {['Organisation','Alerts','Notifications','Security','Reports'].map((s,i) => (
        <g key={i} transform={`translate(128,${70+i*38})`}>
          <rect width="74" height="30" rx="5" fill={i===2?'#0891b218':'rgba(255,255,255,0.03)'} stroke={i===2?'#0891b235':'rgba(255,255,255,0.06)'}/>
          {i===2 && <rect width="3" height="30" rx="1.5" fill="#0891b2"/>}
          <rect x={i===2?7:5} y="11" width={s.length*3.8} height="4" rx="2" fill={i===2?'#e8f0f2':'#8ba3ad'} opacity={i===2?.8:.5}/>
        </g>
      ))}

      {/* Form area */}
      <rect x="220" y="60" width="330" height="230" rx="6" fill="#162329" stroke="rgba(255,255,255,0.08)" strokeWidth=".8"/>
      <rect x="232" y="72" width="100" height="5.5" rx="2.5" fill="#e8f0f2" opacity=".8"/>
      <rect x="232" y="82" width="160" height="3.5" rx="1.5" fill="#8ba3ad" opacity=".5"/>

      {/* Teams webhook field */}
      <rect x="232" y="96" width="100" height="4" rx="2" fill="#8ba3ad" opacity=".6"/>
      <rect x="232" y="104" width="308" height="28" rx="5" fill="#0f1c22" stroke="#0891b240" strokeWidth="1"/>
      <rect x="240" y="112" width="180" height="4" rx="2" fill="#8ba3ad" opacity=".4"/>
      <rect x="504" y="108" width="30" height="18" rx="4" fill="#0891b225" stroke="#0891b245" strokeWidth=".5"/>
      <rect x="509" y="114" width="20" height="4" rx="2" fill="#0891b265"/>

      {/* Teams Recipient */}
      <rect x="232" y="140" width="110" height="4" rx="2" fill="#8ba3ad" opacity=".6"/>
      <rect x="232" y="148" width="308" height="24" rx="5" fill="#0f1c22" stroke="rgba(255,255,255,0.08)" strokeWidth=".7"/>
      <rect x="240" y="157" width="150" height="4" rx="2" fill="#8ba3ad" opacity=".4"/>

      {/* Teams notification preview card */}
      <rect x="232" y="180" width="308" height="96" rx="8" fill="#0f1c22" stroke="#0891b228" strokeWidth="1"/>
      <rect x="232" y="180" width="308" height="30" rx="8" fill="#0891b218"/>
      <rect x="232" y="200" width="308" height="10" fill="#0891b210"/>
      <circle cx="252" cy="195" r="9" fill="#ef444428" stroke="#ef444445"/>
      <rect x="250" y="191" width="7" height="7" rx="2" fill="#ef4444" opacity=".7"/>
      <rect x="267" y="187" width="100" height="5" rx="2" fill="#e8f0f2" opacity=".5"/>
      <rect x="267" y="196" width="70" height="3.5" rx="1.5" fill="#8ba3ad" opacity=".4"/>
      {/* Notification fields */}
      {[['🏢 Site','Pune Mall'],['🚻 Restroom',"Men's Restroom GF"],['⏰ Time','09:42 PM'],['📟 Device','DEVICE-001']].map(([k,v],i) => (
        <g key={i} transform={`translate(240,${216+i*15})`}>
          <rect width="292" height="12" rx="2" fill={i%2===0?'#162329':'#0f1c22'}/>
          <rect x="4" y="3.5" width={k.length*4} height="4" rx="2" fill="#8ba3ad" opacity=".55"/>
          <rect x="100" y="3.5" width={v.length*3.8} height="4" rx="2" fill="#e8f0f2" opacity=".6"/>
        </g>
      ))}
    </AppShell>
  )
}

function IllustrationDashboard() {
  return <IllustrationWelcome />
}

function IllustrationSiteMap() {
  return (
    <AppShell activeNav="/sidemap" pageTitle="Floor Map" pageSubtitle="Interactive restroom monitoring, heatmap analytics and real-time site status">
      {/* Map canvas */}
      <rect x="120" y="60" width="310" height="240" rx="6" fill="#0a1620" stroke="#0891b228" strokeWidth="1"/>
      {/* Grid lines */}
      {[85,110,135,160,185,210,235,260,285].map(y => <line key={y} x1="120" y1={y} x2="430" y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth=".5"/>)}
      {[150,190,230,270,310,350,390].map(x => <line key={x} x1={x} y1="60" x2={x} y2="300" stroke="rgba(255,255,255,0.04)" strokeWidth=".5"/>)}
      {/* Floor zones */}
      <rect x="132" y="72" width="122" height="100" rx="6" fill="#0891b215" stroke="#0891b252" strokeWidth="1.2"/>
      <rect x="264" y="72" width="84" height="100" rx="6" fill="#10b98115" stroke="#10b98152" strokeWidth="1.2"/>
      <rect x="132" y="182" width="84" height="106" rx="6" fill="#f59e0b15" stroke="#f59e0b52" strokeWidth="1.2"/>
      <rect x="226" y="182" width="122" height="106" rx="6" fill="#ef444415" stroke="#ef444452" strokeWidth="1.2"/>
      {/* Zone labels */}
      <rect x="144" y="116" width="56" height="4" rx="2" fill="#0891b255"/>
      <rect x="276" y="116" width="48" height="4" rx="2" fill="#10b98155"/>
      <rect x="144" y="228" width="50" height="4" rx="2" fill="#f59e0b55"/>
      <rect x="240" y="228" width="60" height="4" rx="2" fill="#ef444455"/>
      {/* Device dots */}
      {[[148,82,'#10b981'],[168,78,'#10b981'],[192,88,'#10b981'],[274,80,'#f59e0b'],[300,86,'#10b981'],[144,196,'#ef4444'],[168,206,'#10b981'],[236,194,'#10b981'],[262,198,'#10b981'],[298,208,'#f59e0b']].map(([x,y,c],i)=>(
        <g key={i}><circle cx={x} cy={y} r="6" fill={c} opacity=".15"/><circle cx={x} cy={y} r="3.5" fill={c} opacity=".9"/></g>
      ))}
      {/* Heatmap bar */}
      <defs>
        <linearGradient id="hm3" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#10b981"/>
          <stop offset="50%" stopColor="#f59e0b"/>
          <stop offset="100%" stopColor="#ef4444"/>
        </linearGradient>
      </defs>
      <rect x="132" y="284" width="120" height="8" rx="4" fill="url(#hm3)" opacity=".7"/>

      {/* Right panel */}
      <rect x="442" y="60" width="108" height="240" rx="6" fill="#162329" stroke="rgba(255,255,255,0.08)" strokeWidth=".8"/>
      <rect x="452" y="70" width="80" height="4.5" rx="2" fill="#e8f0f2" opacity=".65"/>
      {[
        { r:"Men's GF",   c:'#10b981' },
        { r:"Women's GF", c:'#10b981' },
        { r:"Men's 1F",   c:'#f59e0b' },
        { r:"Women's 1F", c:'#ef4444' },
        { r:"Men's 2F",   c:'#10b981' },
        { r:"Women's 2F", c:'#10b981' },
      ].map((item,i) => (
        <g key={i} transform={`translate(452,${82+i*28})`}>
          <rect width="88" height="22" rx="4" fill={i%2===0?'#0f1c22':'#162329'} stroke="rgba(255,255,255,0.06)"/>
          <circle cx="10" cy="11" r="5" fill={item.c} opacity=".85"/>
          <rect x="20" y="7" width={item.r.length*3.5} height="4" rx="2" fill="#e8f0f2" opacity=".6"/>
          <rect x="20" y="14" width="30" height="3" rx="1.5" fill="#8ba3ad" opacity=".4"/>
        </g>
      ))}
    </AppShell>
  )
}

function IllustrationTestMode() {
  return (
    <AppShell activeNav="/devices" pageTitle="Device Management" pageSubtitle="Test Mode — simulate feedback without a physical device">
      {/* Device list with test mode enabled */}
      <rect x="120" y="60" width="230" height="230" rx="6" fill="#162329" stroke="rgba(255,255,255,0.08)" strokeWidth=".8"/>
      <rect x="130" y="70" width="90" height="4.5" rx="2" fill="#e8f0f2" opacity=".7"/>
      {/* column headers */}
      <rect x="130" y="82" width="200" height="14" rx="3" fill="#0f1c22"/>
      {['Device','EUI','Test Mode'].map((h,i) => (
        <rect key={i} x={136+[0,54,120][i]} y="86" width={[44,56,60][i]} height="4" rx="2" fill="#8ba3ad" opacity=".55"/>
      ))}
      {[
        { name:'DEVICE-001', eui:'AC12-34AB', active:true },
        { name:'DEVICE-002', eui:'AC12-34CD', active:false },
        { name:'DEVICE-003', eui:'AC12-34EF', active:false },
        { name:'DEVICE-004', eui:'AC12-34GH', active:false },
      ].map((d,i) => (
        <g key={i} transform={`translate(130,${98+i*26})`}>
          <rect width="210" height="22" rx="3" fill={i%2===0?'#162329':'#1a2830'} stroke="rgba(255,255,255,0.05)" strokeWidth=".3"/>
          <rect x="4" y="7" width="44" height="4" rx="2" fill="#e8f0f2" opacity=".6"/>
          <rect x="54" y="7" width="50" height="4" rx="2" fill="#8ba3ad" opacity=".5"/>
          {/* toggle switch */}
          <rect x="120" y="6" width="30" height="10" rx="5" fill={d.active?'#10b981':'rgba(255,255,255,0.08)'} stroke={d.active?'#10b98150':'rgba(255,255,255,0.12)'} strokeWidth=".5"/>
          <circle cx={d.active?142:128} cy="11" r="4.5" fill={d.active?'#fff':'rgba(255,255,255,0.4)'}/>
        </g>
      ))}

      {/* Test modal */}
      <rect x="360" y="60" width="190" height="200" rx="8" fill="#162329" stroke="#f59e0b35" strokeWidth="1.2"/>
      <rect x="370" y="72" width="100" height="5" rx="2" fill="#f59e0b60"/>
      <rect x="370" y="82" width="80" height="3.5" rx="1.5" fill="#8ba3ad" opacity=".5"/>
      <rect x="370" y="92" width="55" height="3.5" rx="1.5" fill="#8ba3ad" opacity=".4"/>
      {/* Simulate buttons */}
      {[['#10b981','😊 Simulate HAPPY'],['#f59e0b','😐 Simulate OKAY'],['#ef4444','😞 Simulate UNHAPPY']].map(([c,l],i) => (
        <g key={i} transform={`translate(370,${104+i*44})`}>
          <rect width="170" height="36" rx="8" fill={c+'18'} stroke={c+(i===2?'60':'38')} strokeWidth={i===2?'1.5':'1'}/>
          {i===2 && <rect width="170" height="36" rx="8" fill="none" stroke={c} strokeWidth=".7" strokeOpacity=".35"/>}
          <circle cx="18" cy="18" r="6" fill={c} opacity=".8"/>
          <rect x="30" y="15" width={l.length*3.6} height="5" rx="2" fill={c} opacity={i===2?.9:.65}/>
        </g>
      ))}
      {/* Count field */}
      <rect x="370" y="240" width="80" height="3.5" rx="1.5" fill="#8ba3ad" opacity=".5"/>
      <rect x="370" y="248" width="170" height="24" rx="5" fill="#0f1c22" stroke="rgba(255,255,255,0.1)"/>
      <rect x="378" y="256" width="20" height="5" rx="2" fill="#e8f0f2" opacity=".5"/>

      {/* Arrow → result */}
      <line x1="358" y1="160" x2="340" y2="160" stroke="#ef444440" strokeWidth="1.5" strokeDasharray="4 3"/>
      <rect x="290" y="152" width="50" height="16" rx="5" fill="#ef444415" stroke="#ef444435" strokeWidth=".5"/>
      <rect x="296" y="158" width="36" height="4" rx="2" fill="#ef444455"/>
    </AppShell>
  )
}

function IllustrationReady() {
  return (
    <AppShell activeNav="/dashboard" pageTitle="Dashboard" pageSubtitle="You're ready — start monitoring your facility">
      {/* Checkmark overlay on dashboard */}
      <rect x="120" y="60" width="430" height="240" rx="6" fill="#0d161b" fillOpacity=".7"/>
      {/* Success ring */}
      <circle cx="335" cy="175" r="72" fill="none" stroke="#10b981" strokeWidth=".8" strokeOpacity=".15" strokeDasharray="6 4"/>
      <circle cx="335" cy="175" r="54" fill="none" stroke="#10b981" strokeWidth=".8" strokeOpacity=".25" strokeDasharray="5 3"/>
      <circle cx="335" cy="175" r="40" fill="#10b98118" stroke="#10b98145" strokeWidth="2"/>
      <circle cx="335" cy="175" r="28" fill="#10b98125" stroke="#10b98165" strokeWidth="1.5"/>
      <polyline points="316,175 330,189 358,158" fill="none" stroke="#10b981" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
      {/* Feature chips */}
      {[
        { angle:-80, label:'Dashboard' },
        { angle:-35, label:'Live Feedback' },
        { angle:10,  label:'Alerts' },
        { angle:55,  label:'Reports' },
        { angle:100, label:'Devices' },
        { angle:148, label:'Site Map' },
        { angle:196, label:'Settings' },
        { angle:244, label:'Test Mode' },
      ].map((c,i) => {
        const r = c.angle*Math.PI/180
        const cx = 335+Math.cos(r)*90, cy = 175+Math.sin(r)*80
        return (
          <g key={i} transform={`translate(${cx-32},${cy-9})`}>
            <rect width="64" height="18" rx="8" fill="#162329" stroke="#0891b228" strokeWidth=".7"/>
            <rect x="7" y="6.5" width={c.label.length*3.6} height="4" rx="2" fill="#e8f0f2" opacity=".55"/>
          </g>
        )
      })}
      {/* CTA */}
      <rect x="235" y="268" width="200" height="28" rx="8" fill="#162329" stroke="#0891b230" strokeWidth="1"/>
      <rect x="252" y="278" width="130" height="4.5" rx="2" fill="#e8f0f2" opacity=".6"/>
      <rect x="252" y="287" width="96" height="3.5" rx="1.5" fill="#0891b260"/>
    </AppShell>
  )
}

// ─── Slide definitions ────────────────────────────────────────────────────────

const BASE_SLIDES = [
  {
    id: 'welcome',
    tag: 'Getting Started',
    title: (u) => `Welcome, ${u?.name?.split(' ')[0] || 'there'}!`,
    subtitle: 'Smart Restroom Feedback System',
    body: (u) =>
      `You're logged in as ${ROLE_LABELS[u?.role] || u?.role}. ${getRoleContext(u?.role)} ` +
      `This walkthrough follows the complete end-to-end flow — from creating an organisation to receiving real-time alerts.`,
    illustration: <IllustrationWelcome />,
  },
  {
    id: 'org-setup',
    tag: 'Step 1 — Super Admin',
    title: () => 'Create the Organisation',
    subtitle: 'Top-down setup by Super Admin',
    body: () =>
      'The Super Admin starts by creating an organisation and its hierarchy: Organisation → Site → Floor → Restroom. ' +
      'They also create users, assign roles, register gateways and devices, and configure system-level settings. ' +
      'Once the organisation is set up, the Vendor Admin can log in and work within it.',
    illustration: <IllustrationOrgSetup />,
  },
  {
    id: 'auth-flow',
    tag: 'Step 2 — Authentication',
    title: () => 'Login & JWT Auth Flow',
    subtitle: 'Secure role-based access',
    body: () =>
      'When you log in, the backend validates your credentials and returns a JWT. ' +
      'The frontend stores that token and sends it with every API request. ' +
      'The backend verifies the JWT, checks your role and permissions, then returns only the data scoped to your organisation.',
    illustration: <IllustrationAuthFlow />,
  },
  {
    id: 'site-config',
    tag: 'Step 3 — Site Configuration',
    title: () => 'Configure Sites & Floors',
    subtitle: 'Map the physical location',
    body: () =>
      'Vendor Admins and authorised users set up the physical layout: add sites with GPS info, create floors, ' +
      'upload floor plans, draw restroom and zone boundaries on the canvas, and create restroom areas. ' +
      'The floor plan becomes the visual representation of the facility used across the Sitemap and Device Management.',
    illustration: <IllustrationSiteConfig />,
  },
  {
    id: 'device-setup',
    tag: 'Step 4 — Infrastructure',
    title: () => 'Gateway & Device Setup',
    subtitle: 'LoRaWAN → TTN → Backend',
    body: () =>
      'Physical badge devices communicate over LoRaWAN. The signal goes: Badge Device → LoRaWAN Gateway → ' +
      'The Things Network (TTN) → MQTT → Node.js Backend. ' +
      'Each device is registered with a Device EUI and associated to a gateway, site, floor, restroom, and exact position on the floor plan.',
    illustration: <IllustrationDeviceSetup />,
  },
  {
    id: 'button-press',
    tag: 'Step 5 — Visitor Interaction',
    title: () => 'User Presses a Button',
    subtitle: '3-button feedback device',
    body: () =>
      'The restroom has a 3-button device: Button 1 = Happy, Button 2 = Okay, Button 3 = Unhappy. ' +
      'When a visitor presses a button, the device sends a LoRaWAN uplink payload containing ' +
      'the Device EUI, button value, timestamp, battery level, gateway info, and signal strength.',
    illustration: <IllustrationButtonPress />,
  },
  {
    id: 'ttn',
    tag: 'Step 6 — TTN',
    title: () => 'TTN Receives the Message',
    subtitle: 'Payload decoded & mapped',
    body: () =>
      'TTN receives the LoRaWAN uplink. The backend maps the numeric value in the payload: ' +
      '1 → HAPPY, 2 → OKAY, 3 → UNHAPPY. ' +
      'The full payload includes the Device EUI, button value, timestamp, battery, gateway details, and signal metrics (RSSI/SNR).',
    illustration: <IllustrationTTN />,
  },
  {
    id: 'mqtt',
    tag: 'Step 7 — Backend Processing',
    title: () => 'MQTT → Feedback Service',
    subtitle: 'Message routed through the pipeline',
    body: () =>
      'Your Node.js backend is connected to TTN through MQTT. ' +
      'The MQTT Service receives the message, the Payload Decoder interprets it, ' +
      'the Device Lookup identifies which registered device triggered it, ' +
      'then maps it to its Gateway → Site → Floor → Restroom before passing it to the Feedback Service.',
    illustration: <IllustrationMQTT />,
  },
  {
    id: 'storage',
    tag: 'Step 8 — Data Storage',
    title: () => 'Feedback Stored in PostgreSQL',
    subtitle: 'Full context saved with every press',
    body: () =>
      'The Feedback Service creates a record containing the device, restroom, site, floor, feedback type, ' +
      'timestamp, battery level, signal strength, and source. ' +
      'For example: Device DEVICE-001, Site Pune Mall, Floor Ground Floor, Restroom Men\'s Restroom, Feedback UNHAPPY, Time 09:42 PM.',
    illustration: <IllustrationFeedbackStorage />,
  },
  {
    id: 'socketio',
    tag: 'Step 9 — Real-Time',
    title: () => 'Live Update via Socket.IO',
    subtitle: 'No page refresh needed',
    body: () =>
      'After saving the feedback, the backend emits a Socket.IO event. ' +
      'The full chain is: MQTT → Backend → Save to PostgreSQL → Socket.IO event → Frontend. ' +
      'The Live Feedback page and Dashboard update instantly — no manual refresh required.',
    illustration: <IllustrationSocketIO />,
  },
  {
    id: 'live-feedback',
    tag: 'Step 10 — Live Feedback',
    title: () => 'Live Feedback Page',
    subtitle: 'Every press, in real time',
    body: () =>
      'The Live Feedback page shows every button press as it happens — restroom, floor, feedback type, device, and timestamp. ' +
      'Use the filters to narrow down to a specific restroom or time window. ' +
      'A sudden cluster of Unhappy responses is your immediate cue to dispatch cleaning staff.',
    illustration: <IllustrationLiveFeedback />,
  },
  {
    id: 'alerts',
    tag: 'Step 11 — Alerts',
    title: () => 'Unhappy Feedback Triggers an Alert',
    subtitle: 'Automatic escalation pipeline',
    body: () =>
      'When feedback is UNHAPPY, the Alert Service fires automatically: it checks the alert settings, ' +
      'creates an alert with a priority level (Critical / High / Medium / Low), and sends a Teams notification. ' +
      'Acknowledge → Assign → Resolve to track every incident through to completion.',
    illustration: <IllustrationAlert />,
  },
  {
    id: 'teams',
    tag: 'Step 12 — Notifications',
    title: () => 'Microsoft Teams Notification',
    subtitle: 'Instant push to your ops channel',
    body: () =>
      'Configure the Teams webhook from Settings → Notifications. ' +
      'When an unhappy complaint occurs, the backend sends a notification to your Teams channel ' +
      'with the site, floor, restroom, device, and timestamp — so the responsible team can act immediately.',
    illustration: <IllustrationTeams />,
  },
  {
    id: 'dashboard',
    tag: 'Step 13 — Dashboard',
    title: () => 'Dashboard & Reports',
    subtitle: 'Your command centre',
    body: () =>
      'The Dashboard shows KPIs — Happy, Okay, Unhappy counts, active devices, alerts — all updating live via Socket.IO. ' +
      'The Sitemap gives a floor-plan heatmap view, and Reports let you generate time-range exports. ' +
      'Other modules — Restroom Management, Device Management, Gateway Management, User Management, Audit History, and Test Mode — ' +
      'each handle a specific part of the system.',
    illustration: <IllustrationDashboard />,
  },
  {
    id: 'sitemap',
    tag: 'Step 14 — Site Map',
    title: () => 'Site Map — Physical Visualisation',
    subtitle: 'Find problems by location',
    body: () =>
      'The Sitemap lets you drill down: Site → Floor → Floor Plan → Restroom Zone → Device dot. ' +
      'Zones are colour-coded by feedback sentiment. An Unhappy event highlights the exact restroom on the floor plan ' +
      'so you can instantly locate and address the issue.',
    illustration: <IllustrationSiteMap />,
  },
  {
    id: 'test-mode',
    tag: 'Step 15 — Test Mode',
    title: () => 'Test Mode',
    subtitle: 'Simulate without pressing a device',
    body: () =>
      'From Device Management, enable Test Mode to simulate Happy, Okay, or Unhappy feedback for any registered device. ' +
      'The simulated event flows through the full pipeline — Backend → PostgreSQL → Socket.IO → Live Feedback → Alert — ' +
      'so you can verify the entire flow without physically pressing a button.',
    illustration: <IllustrationTestMode />,
  },
  {
    id: 'ready',
    tag: "You're Ready",
    title: () => "You know the full flow!",
    subtitle: 'Start monitoring your facility',
    body: () =>
      'Head to the Dashboard to begin. Use the Sitemap to spot problem areas, Live Feedback to watch events in real time, ' +
      'and Alerts to track and resolve incidents. You can replay this walkthrough anytime using "Take a tour" in the top navigation bar.',
    illustration: <IllustrationReady />,
  },
]

function getSlidesForUser(user) {
  if (!user) return BASE_SLIDES
  if (user.role === ROLES.VIEWER) {
    return BASE_SLIDES.filter(s => !['org-setup','auth-flow','site-config','device-setup','teams','test-mode'].includes(s.id))
  }
  if ([ROLES.SITE_INCHARGE, ROLES.FACILITY_MANAGER].includes(user.role)) {
    return BASE_SLIDES.filter(s => !['org-setup','auth-flow'].includes(s.id))
  }
  return BASE_SLIDES
}

// ─── Modal component ──────────────────────────────────────────────────────────

export default function OnboardingModal() {
  const { user, updateUser } = useAuth()
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const [animDir, setAnimDir] = useState('forward')
  const [animating, setAnimating] = useState(false)
  const savingRef = useRef(false)
  const slides = getSlidesForUser(user)
  const total = slides.length

  useEffect(() => {
    let cancelled = false
    async function checkFirstOpen() {
      if (!user) return
      try {
        const { tutorialStatus } = await api.get('/api/auth/tutorial')
        if (cancelled) return
        updateUser({ tutorialStatus })
        if (tutorialStatus === 'pending') { setIndex(0); setOpen(true) }
      } catch (err) {
        console.warn('Unable to load tutorial status:', err)
      }
    }
    checkFirstOpen()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  useEffect(() => {
    // OnboardingModal only opens on first login (pending status).
    // The srfs-tour-restart event is handled exclusively by ProductTour (Driver.js).
    // Do NOT open the slideshow on restart — that would conflict with the contextual tour.
    const handler = () => { /* no-op: Driver.js tour handles restart */ }
    window.addEventListener('srfs-tour-restart', handler)
    return () => window.removeEventListener('srfs-tour-restart', handler)
  }, [])

  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goNext()
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   goBack()
      if (e.key === 'Escape') handleClose('skipped')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index, animating])

  const navigate = useCallback((dir) => {
    if (animating) return
    setAnimDir(dir)
    setAnimating(true)
    setTimeout(() => {
      setIndex(prev => prev + (dir === 'forward' ? 1 : -1))
      setAnimating(false)
    }, 220)
  }, [animating])

  function goNext() { if (index < total - 1) navigate('forward') }
  function goBack() { if (index > 0) navigate('back') }

  const handleClose = useCallback(async (status) => {
    if (savingRef.current) return
    savingRef.current = true
    setOpen(false)
    updateUser({ tutorialStatus: status })
    try {
      await api.put('/api/auth/tutorial', { tutorialStatus: status })
    } catch (err) {
      console.warn('Unable to save tutorial status:', err)
    } finally {
      savingRef.current = false
    }
    // After first-login slideshow closes, fire the contextual (Driver.js) tour
    window.dispatchEvent(new CustomEvent('srfs-onboarding-closed', { detail: { status } }))
  }, [updateUser])

  const handleFinish = useCallback(() => handleClose('completed'), [handleClose])
  const handleSkip   = useCallback(() => handleClose('skipped'),   [handleClose])

  if (!open || !user) return null

  const slide = slides[index]
  const isLast  = index === total - 1
  const isFirst = index === 0

  const slideClass = [
    'ob-slide',
    animating
      ? (animDir === 'forward' ? 'ob-slide--exit-left' : 'ob-slide--exit-right')
      : 'ob-slide--enter',
  ].join(' ')

  return (
    <div className="ob-overlay" role="dialog" aria-modal="true" aria-label="Application walkthrough">
      <div className="ob-header">
        <div className="ob-header__brand">
          <span className="ob-header__dot" aria-hidden="true"/>
          Smart Restroom Feedback System
        </div>
        <button type="button" className="ob-header__close" onClick={handleSkip} aria-label="Close walkthrough">✕</button>
      </div>

      <div className="ob-progress-bar" aria-hidden="true">
        <div className="ob-progress-bar__fill" style={{ width: `${((index + 1) / total) * 100}%` }}/>
      </div>

      <div className="ob-body">
        <div key={index} className={slideClass}>
          <div className="ob-slide__text">
            <span className="ob-slide__tag">{slide.tag}</span>
            <h1 className="ob-slide__title">
              {typeof slide.title === 'function' ? slide.title(user) : slide.title}
            </h1>
            <p className="ob-slide__subtitle">
              {typeof slide.subtitle === 'function' ? slide.subtitle(user) : slide.subtitle}
            </p>
            <p className="ob-slide__body">
              {typeof slide.body === 'function' ? slide.body(user) : slide.body}
            </p>
            <div className="ob-slide__steps">
              {slides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  className={`ob-step-dot${i === index ? ' ob-step-dot--active' : ''}`}
                  onClick={() => {
                    if (i === index || animating) return
                    setAnimDir(i > index ? 'forward' : 'back')
                    setAnimating(true)
                    setTimeout(() => { setIndex(i); setAnimating(false) }, 220)
                  }}
                  aria-label={`Go to slide ${i + 1}`}
                  aria-current={i === index ? 'step' : undefined}
                />
              ))}
            </div>
          </div>

          <div className="ob-slide__visual">
            <div className="ob-slide__screen">
              {slide.illustration}
            </div>
          </div>
        </div>
      </div>

      <div className="ob-footer">
        <div className="ob-footer__left">
          <span className="ob-footer__counter">{index + 1} / {total}</span>
          {!isLast && (
            <button type="button" className="ob-btn ob-btn--muted" onClick={handleSkip}>Skip tour</button>
          )}
        </div>
        <div className="ob-footer__right">
          {!isFirst && (
            <button type="button" className="ob-btn ob-btn--ghost" onClick={goBack}>← Back</button>
          )}
          {isLast ? (
            <button type="button" className="ob-btn ob-btn--primary" onClick={handleFinish}>Go to Dashboard →</button>
          ) : (
            <button type="button" className="ob-btn ob-btn--primary" onClick={goNext}>
              {index === 0 ? 'Start tour' : 'Next'} →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
