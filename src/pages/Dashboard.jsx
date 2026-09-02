import { useEffect, useState, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import DashboardCards from '../components/DashboardCards'
import FeedbackChart from '../components/FeedbackChart'
import RestroomMap from '../components/RestroomMap'
import AlertWidget from '../components/AlertWidget'
import DeviceHealthCard from '../components/DeviceHealthCard'
import BatterySummary from '../components/BatterySummary'
import RestroomGeoMap from '../components/RestroomGeoMap'
import UnhappyEventsPanel from '../components/UnhappyEventsPanel'
import { formatDateTime } from '../utils/formatters'
import api from '../services/api'
import { alertAPI } from '../services/api'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

// Colour helpers for site performance table
function perfColor(score) {
  if (score >= 80) return '#22c55e'
  if (score >= 50) return '#f59e0b'
  return '#ef4444'
}

function perfLabel(score) {
  if (score >= 80) return 'Good'
  if (score >= 50) return 'Fair'
  return 'Poor'
}

export default function Dashboard() {
  const [dashboardData, setDashboardData] = useState({
    stats: { totalRestrooms: 0, totalDevices: 0, todayFeedback: 0, activeAlerts: 0, onlineDevices: 0, offlineDevices: 0, happyFeedback: 0, okayFeedback: 0, unhappyFeedback: 0 },
    feedbackTrend: [],
    restrooms: [],
    devices: [],
    alerts: [],
    recentActivity: [],
  })
  const [loading, setLoading] = useState(true)
  const [locations, setLocations] = useState([])
  const [floors, setFloors] = useState([])
  const [zones, setZones] = useState([])
  const [filters, setFilters] = useState({ locationId: '', floorId: '', zoneId: '' })
  const [allRestroomsForMap, setAllRestroomsForMap] = useState([])
  const [mapConfig, setMapConfig] = useState(null)
  const [aggregatedComplaints, setAggregatedComplaints] = useState([])
  const [sitePerformance, setSitePerformance] = useState([])

  // Derived filter lists
  const filteredFloors = useMemo(
    () => (filters.locationId ? floors.filter((f) => f.locationId === filters.locationId) : floors),
    [floors, filters.locationId],
  )
  const filteredZones = useMemo(
    () => (filters.floorId ? zones.filter((z) => z.floorId === filters.floorId) : zones),
    [zones, filters.floorId],
  )

  const loadFilters = useCallback(async () => {
    try {
      const [locRes, floorRes, zoneRes] = await Promise.all([
        api.get('/api/locations'),
        api.get('/api/floors'),
        api.get('/api/zones'),
      ])
      setLocations(locRes.locations || [])
      setFloors(floorRes.floors || [])
      setZones(zoneRes.zones || [])
    } catch (e) {
      console.error('Dashboard filters load error:', e)
    }
  }, [])

  const loadAggregated = useCallback(async () => {
    try {
      const res = await alertAPI.getUnhappyAggregated()
      setAggregatedComplaints(res.aggregated || [])
    } catch (e) {
      console.error('Aggregated complaints load error:', e)
    }
  }, [])

  const loadSitePerformance = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filters.locationId) params.set('locationId', filters.locationId)
      if (filters.floorId) params.set('floorId', filters.floorId)
      if (filters.zoneId) params.set('zoneId', filters.zoneId)
      const res = await api.get(`/api/dashboard/site-performance?${params.toString()}`)
      setSitePerformance(res.sites || [])
    } catch (e) {
      console.error('Site performance load error:', e)
    }
  }, [filters.locationId, filters.floorId, filters.zoneId])

  const loadMapData = useCallback(async () => {
    try {
      const token = localStorage.getItem('srfs_token')
      const params = new URLSearchParams()
      params.set('period', 'today')
      if (filters.locationId) params.set('locationId', filters.locationId)
      if (filters.floorId) params.set('floorId', filters.floorId)

      const response = await fetch(`${API_URL}/api/dashboard/heatmap?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) throw new Error('Failed to fetch map data')
      const data = await response.json()
      setAllRestroomsForMap(data.restrooms || [])
      setMapConfig(data.mapConfig || null)
    } catch (error) {
      console.error('Dashboard map error:', error)
    }
  }, [filters.locationId, filters.floorId])

  const loadDashboard = useCallback(async () => {
    try {
      const token = localStorage.getItem('srfs_token')
      const params = new URLSearchParams()
      if (filters.locationId) params.set('locationId', filters.locationId)
      if (filters.floorId) params.set('floorId', filters.floorId)
      if (filters.zoneId) params.set('zoneId', filters.zoneId)

      const response = await fetch(`${API_URL}/api/dashboard?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) throw new Error('Failed to fetch dashboard')
      const data = await response.json()
      setDashboardData(data)
    } catch (error) {
      console.error('Dashboard error:', error)
    } finally {
      setLoading(false)
    }
  }, [filters.locationId, filters.floorId, filters.zoneId])

  useEffect(() => {
    loadFilters()
    loadAggregated()
  }, [loadFilters, loadAggregated])

  useEffect(() => { loadMapData() }, [loadMapData])

  useEffect(() => {
    loadDashboard()
    loadSitePerformance()
    const interval = setInterval(() => { loadDashboard(); loadSitePerformance() }, 30000)
    return () => clearInterval(interval)
  }, [loadDashboard, loadSitePerformance])

  const handleFilterChange = useCallback((field) => (e) => {
    setFilters((prev) => {
      const next = { ...prev, [field]: e.target.value }
      // cascade resets
      if (field === 'locationId') { next.floorId = ''; next.zoneId = '' }
      if (field === 'floorId') { next.zoneId = '' }
      return next
    })
  }, [])

  const clearFilters = useCallback(() => {
    setFilters({ locationId: '', floorId: '', zoneId: '' })
  }, [])

  const handleAcknowledge = useCallback(() => {
    loadDashboard()
    loadAggregated()
  }, [loadDashboard, loadAggregated])

  const handleResolve = useCallback(() => {
    loadDashboard()
    loadAggregated()
  }, [loadDashboard, loadAggregated])

  const hasActiveFilters = filters.locationId || filters.floorId || filters.zoneId

  if (loading) {
    return (
      <div className="page dashboard-page">
        <div className="loader">
          <div className="loader__spinner" />
        </div>
      </div>
    )
  }

  return (
    <div className="page dashboard-page">
      {/* ── Filters ── */}
      <div className="filters card dashboard-filters" data-tour="dashboard-filters">
        <div className="dashboard-filters__title">
          <span style={{ fontWeight: 600, color: 'white', fontSize: 13 }}>Filters</span>
          {hasActiveFilters && (
            <button type="button" className="btn btn--ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={clearFilters}>
              Clear
            </button>
          )}
        </div>

        <label>
          Region / Site
          <select value={filters.locationId} onChange={handleFilterChange('locationId')} className="select">
            <option value="">All Sites</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>{loc.officeName || loc.city}</option>
            ))}
          </select>
        </label>

        <label>
          Floor
          <select
            value={filters.floorId}
            onChange={handleFilterChange('floorId')}
            className="select"
            disabled={!filters.locationId}
          >
            <option value="">All Floors</option>
            {filteredFloors.map((f) => (
              <option key={f.id} value={f.id}>{f.floorName}</option>
            ))}
          </select>
        </label>

        <label>
          Zone / Restroom
          <select
            value={filters.zoneId}
            onChange={handleFilterChange('zoneId')}
            className="select"
            disabled={!filters.floorId}
          >
            <option value="">All Zones</option>
            {filteredZones.map((z) => (
              <option key={z.id} value={z.id}>{z.name}</option>
            ))}
          </select>
        </label>
      </div>

      {/* ── Map + Unhappy Events ── */}
      <div className="dashboard-top">
        <div className="dashboard-map">
          <RestroomGeoMap restrooms={allRestroomsForMap} mapConfig={mapConfig} />
        </div>
        <UnhappyEventsPanel
          aggregatedComplaints={aggregatedComplaints}
          onAcknowledge={handleAcknowledge}
          onResolve={handleResolve}
        />
      </div>

      {/* ── KPI Cards ── */}
      <div data-tour="dashboard-kpi-cards">
        <DashboardCards stats={dashboardData.stats} />
      </div>

      {/* ── Feedback Trend + Battery ── */}
      <div className="dashboard-grid dashboard-grid--overview">
        <FeedbackChart data={dashboardData.feedbackTrend} />
        <BatterySummary devices={dashboardData.devices} />
      </div>

      {/* ── Restroom Map + Alerts ── */}
      <div className="dashboard-grid">
        <RestroomMap restrooms={dashboardData.restrooms} />
        <div data-tour="dashboard-alerts">
          <AlertWidget alerts={dashboardData.alerts} onAcknowledge={handleAcknowledge} onResolve={handleResolve} />
        </div>
      </div>

      {/* ── Device Health + Site Performance ── */}
      <div className="dashboard-grid">
        <DeviceHealthCard devices={dashboardData.devices} />

        {/* Site Performance Widget */}
        <div className="card">
          <div className="card__header">
            <h3 className="card__title">Site Performance</h3>
            <Link to="/reports" className="card__link">View all</Link>
          </div>
          {sitePerformance.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: 13, padding: '8px 0' }}>No site data available</p>
          ) : (
            <>
              <div className="table-wrapper">
                <table className="data-table" style={{ fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th>Site</th>
                      <th>Restrooms</th>
                      <th>Feedback</th>
                      <th>Happy %</th>
                      <th>Alerts</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sitePerformance.slice(0, 5).map((site) => (
                      <tr key={site.id}>
                        <td>{site.name}</td>
                        <td>{site.restrooms}</td>
                        <td>{site.todayFeedback}</td>
                        <td>{site.happyPct}%</td>
                        <td>{site.activeAlerts}</td>
                        <td>
                          <span style={{ color: perfColor(site.happyPct), fontWeight: 600, fontSize: 12 }}>
                            {perfLabel(site.happyPct)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {sitePerformance.length > 5 && (
                <div className="card__footer">
                  <Link to="/reports" className="card__footer-link">
                    +{sitePerformance.length - 5} more sites — Full report →
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Recent Activity ── */}
      <div className="card recent-activity" style={{ marginTop: 16 }}>
        <div className="card__header">
          <h3 className="card__title">Recent Activity</h3>
          <Link to="/reports" className="card__link">View all</Link>
        </div>
        <ul className="recent-activity__list">
          {dashboardData.recentActivity.slice(0, 5).map((item) => (
            <li key={item.id} className={`recent-activity__item recent-activity__item--${item.type}`}>
              <p>{item.message}</p>
              <time>{formatDateTime(item.time)}</time>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
