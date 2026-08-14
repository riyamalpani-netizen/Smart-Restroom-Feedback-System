import { useEffect, useState, useCallback } from 'react'
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
import Loader from '../components/Loader'
import api from '../services/api'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

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
  const [filters, setFilters] = useState({ locationId: '' })
  const [allRestroomsForMap, setAllRestroomsForMap] = useState([])
  const [mapConfig, setMapConfig] = useState(null)

  const loadFilters = useCallback(async () => {
    try {
      const locRes = await api.get('/api/locations')
      setLocations(locRes.locations || [])
    } catch (e) {
      console.error('Dashboard filters load error:', e)
    }
  }, [])

  const loadMapData = useCallback(async () => {
    try {
      const token = localStorage.getItem('srfs_token')
      const params = new URLSearchParams()
      params.set('period', 'today')
      if (filters.locationId) params.set('locationId', filters.locationId)

      const response = await fetch(`${API_URL}/api/dashboard/heatmap?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch map data')
      }

      const data = await response.json()
      setAllRestroomsForMap(data.restrooms || [])
      setMapConfig(data.mapConfig || null)
    } catch (error) {
      console.error('Dashboard map error:', error)
    }
  }, [filters.locationId])

  const loadDashboard = useCallback(async () => {
    try {
      const token = localStorage.getItem('srfs_token')
      const params = new URLSearchParams()
      if (filters.locationId) params.set('locationId', filters.locationId)

      const response = await fetch(`${API_URL}/api/dashboard?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch dashboard')
      }

      const data = await response.json()
      setDashboardData(data)
    } catch (error) {
      console.error('Dashboard error:', error)
    } finally {
      setLoading(false)
    }
  }, [filters.locationId])

  useEffect(() => {
    loadFilters()
  }, [loadFilters])

  useEffect(() => {
    loadMapData()
  }, [loadMapData])

  useEffect(() => {
    loadDashboard()
    const interval = setInterval(loadDashboard, 30000)
    return () => clearInterval(interval)
  }, [loadDashboard])

  const handleFilterChange = useCallback((field) => (e) => {
    setFilters((f) => ({ ...f, [field]: e.target.value }))
  }, [])

  const clearFilters = useCallback(() => {
    setFilters({ locationId: '' })
  }, [])

  const handleAcknowledge = useCallback(() => {
    loadDashboard()
  }, [loadDashboard])

  const handleResolve = useCallback(() => {
    loadDashboard()
  }, [loadDashboard])

  const hasActiveFilters = filters.locationId

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
      <div className="filters card dashboard-filters">
        <div className="dashboard-filters__title">
          <span style={{ fontWeight: 600, color: '#334155', fontSize: 13 }}>Filters</span>
          {hasActiveFilters && (
            <button type="button" className="btn btn--ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={clearFilters}>
              Clear
            </button>
          )}
        </div>
        <label>
          Location
          <select value={filters.locationId} onChange={handleFilterChange('locationId')} className="select">
            <option value="">All Locations</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>{loc.officeName || loc.city}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="dashboard-top">
        <div className="dashboard-map">
          <RestroomGeoMap restrooms={allRestroomsForMap} mapConfig={mapConfig} />
        </div>
        <UnhappyEventsPanel
          alerts={dashboardData.alerts}
          onViewOnMap={(restroomId) => setFilters((current) => ({ ...current, restroomId }))}
          onAcknowledge={handleAcknowledge}
          onResolve={handleResolve}
          limit={10}
        />
      </div>

      <DashboardCards stats={dashboardData.stats} />

      <div className="dashboard-grid dashboard-grid--overview">
        <FeedbackChart data={dashboardData.feedbackTrend} />
        <BatterySummary devices={dashboardData.devices} />
      </div>

      <div className="dashboard-grid">
        <RestroomMap restrooms={dashboardData.restrooms} />
        <AlertWidget alerts={dashboardData.alerts} onAcknowledge={handleAcknowledge} onResolve={handleResolve} />
      </div>

      <div className="dashboard-grid">
        <DeviceHealthCard devices={dashboardData.devices} />

        <div className="card recent-activity">
          <div className="card__header">
            <h3 className="card__title">Recent Activity</h3>
            <Link to="/reports" className="card__link">View all</Link>
          </div>
          <ul className="recent-activity__list">
            {dashboardData.recentActivity.slice(0, 3).map((item) => (
              <li key={item.id} className={`recent-activity__item recent-activity__item--${item.type}`}>
                <p>{item.message}</p>
                <time>{formatDateTime(item.time)}</time>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
