import { useEffect, useState } from 'react'
import DashboardCards from '../components/DashboardCards'
import FeedbackChart from '../components/FeedbackChart'
import RestroomMap from '../components/RestroomMap'
import AlertWidget from '../components/AlertWidget'
import DeviceHealthCard from '../components/DeviceHealthCard'
import BatterySummary from '../components/BatterySummary'
import RestroomGeoMap from '../components/RestroomGeoMap'
import { formatDateTime } from '../utils/formatters'
import Loader from '../components/Loader'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export default function Dashboard() {
  const [dashboardData, setDashboardData] = useState({
    stats: { totalRestrooms: 0, totalDevices: 0, todayFeedback: 0, activeAlerts: 0, onlineDevices: 0, offlineDevices: 0 },
    feedbackTrend: [],
    restrooms: [],
    devices: [],
    alerts: [],
    recentActivity: [],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('srfs_token')

    async function loadDashboard() {
      try {
        const response = await fetch(`${API_URL}/api/dashboard`, {
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
    }

    loadDashboard()

    const interval = setInterval(loadDashboard, 30000)

    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="page dashboard-page">
        <DashboardCards stats={dashboardData.stats} />
        <div className="loader">
          <div className="loader__spinner" />
        </div>
      </div>
    )
  }

  return (
    <div className="page dashboard-page">
      <DashboardCards stats={dashboardData.stats} />

      <div className="dashboard-grid">
        <FeedbackChart data={dashboardData.feedbackTrend} />
        <BatterySummary devices={dashboardData.devices} />
      </div>

      <div className="dashboard-grid">
        <RestroomMap restrooms={dashboardData.restrooms} />
        <AlertWidget alerts={dashboardData.alerts} />
      </div>

      <div className="dashboard-grid">
        <DeviceHealthCard devices={dashboardData.devices} />

        <div className="card recent-activity">
          <h3 className="card__title">Recent Activity</h3>
          <ul className="recent-activity__list">
            {dashboardData.recentActivity.map((item) => (
              <li key={item.id} className={`recent-activity__item recent-activity__item--${item.type}`}>
                <p>{item.message}</p>
                <time>{formatDateTime(item.time)}</time>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <RestroomGeoMap restrooms={dashboardData.restrooms} />
    </div>
  )
}
