import StatusBadge from './common/StatusBadge'
import { formatDateTime } from '../utils/formatters'
import { alertAPI } from '../services/api'

export default function UnhappyEventsPanel({ aggregatedComplaints = [], onAcknowledge, onResolve }) {
  async function handleAcknowledge(locationId, zoneId) {
    try {
      const updated = await alertAPI.acknowledgeGroup({ locationId, zoneId })
      onAcknowledge?.(updated)
    } catch (e) {
      console.error('Acknowledge group failed:', e)
    }
  }

  async function handleResolve(locationId, zoneId) {
    try {
      const updated = await alertAPI.resolveGroup({ locationId, zoneId })
      onResolve?.(updated)
    } catch (e) {
      console.error('Resolve group failed:', e)
    }
  }

  return (
    <div className="card unhappy-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 className="card__title" style={{ margin: 0 }}>Unhappy Complaints</h3>
        <span className="unhappy-panel__badge">{aggregatedComplaints.reduce((sum, c) => sum + (c.unhappyCount || 0), 0)}</span>
      </div>

      {aggregatedComplaints.length === 0 ? (
        <p style={{ color: '#64748b', fontSize: 13 }}>No unresolved unhappy complaints.</p>
      ) : (
        <div className="unhappy-panel__list">
          {aggregatedComplaints.map((complaint) => (
            <div key={`${complaint.locationId}-${complaint.zoneId}`} className="unhappy-panel__item">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-h)', fontSize: 13 }}>{complaint.locationName}</div>
                  <div style={{ fontSize: 11, color: 'var(--text)', marginTop: 2 }}>
                    {complaint.zoneName} · {(complaint.unhappyCount || 0).toLocaleString()} Unhappy
                  </div>
                </div>
                <StatusBadge status={complaint.statusDisplay || complaint.status} variant="alert" />
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 8 }}>
                Priority: {complaint.priority} · Last Reported: {complaint.lastReported ? formatDateTime(complaint.lastReported) : 'N/A'}
              </div>
              <div className="unhappy-panel__actions" style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {complaint.status === 'open' && (
                  <button
                    type="button"
                    className="btn btn--secondary"
                    onClick={() => handleAcknowledge(complaint.locationId, complaint.zoneId)}
                  >
                    Acknowledge
                  </button>
                )}
                {complaint.status !== 'closed' && (
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() => handleResolve(complaint.locationId, complaint.zoneId)}
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
