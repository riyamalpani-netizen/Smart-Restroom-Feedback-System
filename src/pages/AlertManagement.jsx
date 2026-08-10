import { useState } from 'react'
import PageHeader from '../components/common/PageHeader'
import StatusBadge from '../components/common/StatusBadge'
import { formatDateTime } from '../utils/formatters'
import { alerts as initialAlerts, getRestroomName } from '../services/mockData'

export default function AlertManagement() {
  const [alerts, setAlerts] = useState(initialAlerts)

  function updateStatus(id, status) {
    setAlerts(alerts.map((a) =>
      a.id === id
        ? {
            ...a,
            status,
            acknowledgedBy: status === 'acknowledged' ? 'Current User' : a.acknowledgedBy,
            resolvedTime: status === 'resolved' ? Date.now() : a.resolvedTime,
          }
        : a,
    ))
  }

  return (
    <div className="page">
      <PageHeader
        title="Alert Management"
        subtitle="Track, acknowledge, and resolve restroom alerts"
      />

      <div className="card">
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Alert Time</th>
                <th>Restroom</th>
                <th>Type</th>
                <th>Status</th>
                <th>Assigned To</th>
                <th>Acknowledged By</th>
                <th>Resolved Time</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert) => (
                <tr key={alert.id}>
                  <td>{formatDateTime(alert.time)}</td>
                  <td>{getRestroomName(alert.restroomId)}</td>
                  <td>{alert.type}</td>
                  <td><StatusBadge status={alert.status} variant="alert" /></td>
                  <td>{alert.assignedTo}</td>
                  <td>{alert.acknowledgedBy ?? '—'}</td>
                  <td>{alert.resolvedTime ? formatDateTime(alert.resolvedTime) : '—'}</td>
                  <td>
                    <div className="btn-group btn-group--inline">
                      {alert.status === 'open' && (
                        <button
                          type="button"
                          className="btn btn--sm btn--secondary"
                          onClick={() => updateStatus(alert.id, 'acknowledged')}
                        >
                          Acknowledge
                        </button>
                      )}
                      {alert.status !== 'resolved' && (
                        <button
                          type="button"
                          className="btn btn--sm btn--primary"
                          onClick={() => updateStatus(alert.id, 'resolved')}
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
