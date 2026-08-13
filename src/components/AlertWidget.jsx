import { Link } from 'react-router-dom'
import StatusBadge from './common/StatusBadge'
import { formatDateTime } from '../utils/formatters'

export default function AlertWidget({ alerts, limit = 5 }) {
  const visible = alerts.slice(0, limit)

  return (
    <div className="alert-widget card">
      <div className="card__header">
        <h3 className="card__title">Alert Summary</h3>
        <Link to="/alerts" className="card__link">View all</Link>
      </div>
      <ul className="alert-widget__list">
        {visible.map((alert) => (
          <li key={alert.id} className="alert-widget__item">
            <div>
              <p className="alert-widget__type">{alert.type}</p>
              <p className="alert-widget__meta">
                {alert.restroomName || 'Unknown'} · {formatDateTime(alert.time)}
              </p>
            </div>
            <StatusBadge status={alert.status} variant="alert" />
          </li>
        ))}
      </ul>
    </div>
  )
}
