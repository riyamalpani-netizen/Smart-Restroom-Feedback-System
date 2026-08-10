import DashboardCards from '../components/DashboardCards'
import FeedbackChart from '../components/FeedbackChart'
import RestroomMap from '../components/RestroomMap'
import AlertWidget from '../components/AlertWidget'
import DeviceHealthCard from '../components/DeviceHealthCard'
import BatterySummary from '../components/BatterySummary'
import PageHeader from '../components/common/PageHeader'
import { formatDateTime } from '../utils/formatters'
import {
  dashboardStats,
  feedbackTrend,
  restrooms,
  devices,
  alerts,
  recentActivity,
} from '../services/mockData'

export default function Dashboard() {
  return (
    <div className="page dashboard-page">
      <PageHeader
        title="Dashboard"
        subtitle="Overview of restroom feedback and device health"
      />

      <DashboardCards stats={dashboardStats} />

      <div className="dashboard-grid">
        <FeedbackChart data={feedbackTrend} />
        <BatterySummary devices={devices} />
      </div>

      <div className="dashboard-grid">
        <RestroomMap restrooms={restrooms} />
        <AlertWidget alerts={alerts} />
      </div>

      <div className="dashboard-grid">
        <DeviceHealthCard devices={devices} />

        <div className="card recent-activity">
          <h3 className="card__title">Recent Activity</h3>
          <ul className="recent-activity__list">
            {recentActivity.map((item) => (
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
