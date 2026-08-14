import StatusBadge from './common/StatusBadge'
import { formatDateTime } from '../utils/formatters'
import api from '../services/api'

export default function AlertWidget({ alerts, limit = 5, onAcknowledge, onResolve }) {
  const visible = alerts.slice(0, limit)

  async function handleAcknowledge(id) {
    try {
      const updated = await api.post(`/api/alerts/${id}/acknowledge`)
      onAcknowledge?.(updated.alert)
    } catch (e) {
      console.error('Acknowledge failed:', e)
    }
  }

  async function handleResolve(id) {
    try {
      const updated = await api.post(`/api/alerts/${id}/resolve`)
      onResolve?.(updated.alert)
    } catch (e) {
      console.error('Resolve failed:', e)
    }
  }

  return (
    <div className="alert-widget card">
      <div className="card__header">
        <h3 className="card__title">Alert Summary</h3>
      </div>
      <ul className="alert-widget__list">
        {visible.map((alert) => (
          <li key={alert.id} className="alert-widget__item">
            <div style={{ flex: 1, minWidth: 0 }}>
              <p className="alert-widget__type">{alert.type}</p>
              <p className="alert-widget__meta">
                {alert.restroomName || 'Unknown'} · {formatDateTime(alert.time)}
              </p>
            </div>
            <StatusBadge status={alert.status} variant="alert" />
             <div className="alert-widget__actions">
               {alert.status === 'open' && (
                 <button
                   type="button"
                   className="btn btn--secondary"
                   onClick={() => handleAcknowledge(alert.id)}
                 >
                   Acknowledge
                 </button>
               )}
               {alert.status !== 'closed' && (
                 <button
                   type="button"
                   className="btn btn--primary"
                   onClick={() => handleResolve(alert.id)}
                 >
                   Resolve
                 </button>
               )}
             </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
