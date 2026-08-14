import StatusBadge from './common/StatusBadge'
import { formatDateTime } from '../utils/formatters'
import api from '../services/api'

export default function UnhappyEventsPanel({ alerts = [], onViewOnMap, limit = 3, onAcknowledge, onResolve }) {
  const unhappyAlerts = alerts.filter((alert) => ['needs_cleaning', 'emergency'].includes(alert.type))
  const visibleAlerts = unhappyAlerts.slice(0, limit)

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
    <div className="card unhappy-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 className="card__title" style={{ margin: 0 }}>Unhappy Events Requiring Action</h3>
        <span className="unhappy-panel__badge">{unhappyAlerts.length}</span>
      </div>

      {unhappyAlerts.length === 0 ? (
        <p style={{ color: '#64748b', fontSize: 13 }}>No unresolved unhappy events reported.</p>
      ) : (
        <div className="unhappy-panel__list">
          {visibleAlerts.map((alert) => (
            <div key={alert.id} className="unhappy-panel__item">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-h)', fontSize: 13 }}>{alert.restroomName}</div>
                  <div style={{ fontSize: 11, color: 'var(--text)', marginTop: 2 }}>
                    {alert.locationName || 'Location unavailable'} · {alert.type.replace(/_/g, ' ')}
                  </div>
                </div>
                <StatusBadge status={alert.status} variant="alert" />
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 8 }}>
                Assigned: {alert.assignedTo || 'Unassigned'} · Reported: {formatDateTime(alert.time)}
              </div>
              {alert.notes && <div style={{ fontSize: 11, color: '#334155', marginTop: 6 }}>Note: {alert.notes}</div>}
              <div className="unhappy-panel__actions" style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {alert.status === 'open' && (
                  <button
                    type="button"
                    className="btn btn--secondary"
                    onClick={(e) => { e.stopPropagation(); handleAcknowledge(alert.id) }}
                  >
                    Acknowledge
                  </button>
                )}
                {alert.status !== 'closed' && (
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={(e) => { e.stopPropagation(); handleResolve(alert.id) }}
                  >
                    Resolve
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
