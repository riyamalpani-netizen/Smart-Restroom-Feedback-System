import PageHeader from '../components/common/PageHeader'
import StatusBadge from '../components/common/StatusBadge'
import { formatDateTime } from '../utils/formatters'
import { disasterStatus } from '../services/mockData'

function SystemStatus({ label, status }) {
  return (
    <div className={`system-status system-status--${status}`}>
      <span className="system-status__indicator" />
      <div>
        <strong>{label}</strong>
        <span>{status === 'online' ? 'Operational' : 'Down'}</span>
      </div>
    </div>
  )
}

export default function DisasterManagement() {
  const { gateway, network, server, offlineDevices, lowBatteryDevices, communicationFailures, incidents, auditLog } = disasterStatus

  return (
    <div className="page">
      <PageHeader
        title="Disaster Management"
        subtitle="Monitor system health and incident recovery"
        action={<button type="button" className="btn btn--danger">Manual Closure</button>}
      />

      <div className="disaster-status-grid">
        <SystemStatus label="Gateway" status={gateway} />
        <SystemStatus label="Network" status={network} />
        <SystemStatus label="Server" status={server} />
      </div>

      <div className="disaster-metrics">
        <div className="card disaster-metric">
          <span className="disaster-metric__value">{offlineDevices}</span>
          <span className="disaster-metric__label">Offline Devices</span>
        </div>
        <div className="card disaster-metric">
          <span className="disaster-metric__value">{lowBatteryDevices}</span>
          <span className="disaster-metric__label">Low Battery</span>
        </div>
        <div className="card disaster-metric">
          <span className="disaster-metric__value">{communicationFailures}</span>
          <span className="disaster-metric__label">Communication Failures</span>
        </div>
      </div>

      <div className="card">
        <h3 className="card__title">Incident Log</h3>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Type</th>
                <th>Device</th>
                <th>Recovery Status</th>
                <th>Teams Notification</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((incident) => (
                <tr key={incident.id}>
                  <td>{formatDateTime(incident.time)}</td>
                  <td>{incident.type}</td>
                  <td><code>{incident.device}</code></td>
                  <td><StatusBadge status={incident.status === 'investigating' ? 'acknowledged' : 'open'} variant="alert" /></td>
                  <td><span className="status-badge" style={{ '--badge-color': '#22c55e' }}>Sent</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3 className="card__title">Audit Log</h3>
        <ul className="audit-log">
          {auditLog.map((entry) => (
            <li key={entry.id}>{entry.message} — {formatDateTime(entry.time)}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
