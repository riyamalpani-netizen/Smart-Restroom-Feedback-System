import { useEffect, useState } from 'react'
import DashboardCards from '../components/DashboardCards'
import FeedbackChart from '../components/FeedbackChart'
import RestroomMap from '../components/RestroomMap'
import AlertWidget from '../components/AlertWidget'
import DeviceHealthCard from '../components/DeviceHealthCard'
import BatterySummary from '../components/BatterySummary'
import { formatDateTime } from '../utils/formatters'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export default function Dashboard() {
  const [dashboardData, setDashboardData] = useState({
    stats: { totalRestrooms: 0, totalDevices: 0, todayFeedback: 0, activeAlerts: 0 },
    feedbackTrend: [],
    restrooms: [],
    devices: [],
    alerts: [],
    recentActivity: [],
  })

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
      }
    }

    loadDashboard()
  }, [])

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
    </div>
  )
}
