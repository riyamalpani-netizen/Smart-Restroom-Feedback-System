import { Link } from 'react-router-dom'
import StatusBadge from './common/StatusBadge'
import { formatDateTime } from '../utils/formatters'
import api from '../services/api'

export default function AlertWidget({ alerts, limit = 4, onAcknowledge, onResolve }) {
  const visible = alerts.slice(0, limit)
  const hiddenCount = Math.max(0, alerts.length - limit)

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
        <h3 className="card__title">Active Alerts</h3>
        <Link to="/alerts" className="card__link">View all</Link>
      </div>

      {visible.length === 0 ? (
        <p style={{ color: '#94a3b8', fontSize: 13, padding: '12px 0' }}>No active alerts.</p>
      ) : (
        <ul className="alert-widget__list">
          {visible.map((alert) => (
            <li key={alert.id} className="alert-widget__item">
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="alert-widget__type">{alert.type}</p>
                <p className="alert-widget__meta">
                  {alert.restroomName || 'Unknown'} · {formatDateTime(alert.time)}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <StatusBadge status={alert.status} variant="alert" />
                {alert.status === 'open' && (
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    style={{ padding: '3px 10px', fontSize: 12 }}
                    onClick={() => handleAcknowledge(alert.id)}
                  >
                    Ack
                  </button>
                )}
                {alert.status !== 'closed' && (
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    style={{ padding: '3px 10px', fontSize: 12 }}
                    onClick={() => handleResolve(alert.id)}
                  >
                    Resolve
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {hiddenCount > 0 && (
        <div className="card__footer">
          <Link to="/alerts" className="card__footer-link">
            +{hiddenCount} more alert{hiddenCount !== 1 ? 's' : ''} — View all →
          </Link>
        </div>
      )}
    </div>
  )
}
