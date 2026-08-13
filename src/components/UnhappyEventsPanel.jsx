import { Link } from 'react-router-dom'
import StatusBadge from './common/StatusBadge'
import { formatDateTime } from '../utils/formatters'

export default function UnhappyEventsPanel({ alerts = [], onViewOnMap }) {
  const unhappyAlerts = alerts.filter((alert) => ['needs_cleaning', 'emergency'].includes(alert.type))

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
          {unhappyAlerts.map((alert) => (
            <div key={alert.id} className="unhappy-panel__item" onClick={() => onViewOnMap?.(alert.restroomId)} style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 13 }}>{alert.restroomName}</div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                    {alert.locationName || 'Location unavailable'} · {alert.type.replace(/_/g, ' ')}
                  </div>
                </div>
                <StatusBadge status={alert.status} variant="alert" />
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 8 }}>
                Assigned: {alert.assignedTo || 'Unassigned'} · Reported: {formatDateTime(alert.time)}
              </div>
              {alert.notes && <div style={{ fontSize: 11, color: '#334155', marginTop: 6 }}>Note: {alert.notes}</div>}
            </div>
          ))}
        </div>
      )}
      <Link to="/alerts" className="card__link" style={{ display: 'inline-block', marginTop: 12 }}>
        Assign, add notes, or resolve alerts
      </Link>
    </div>
  )
}
