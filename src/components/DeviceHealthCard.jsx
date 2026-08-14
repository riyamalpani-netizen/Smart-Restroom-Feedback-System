import { Link } from 'react-router-dom'
import StatusBadge from './common/StatusBadge'
import { formatDateTime } from '../utils/formatters'

export default function DeviceHealthCard({ devices = [], limit = 3 }) {
  const summary = {
    healthy: devices.filter((d) => d.health === 'healthy').length,
    warning: devices.filter((d) => d.health === 'warning').length,
    critical: devices.filter((d) => d.health === 'critical').length,
  }

  return (
    <div className="device-health card">
      <div className="card__header">
        <h3 className="card__title">Device Health Status</h3>
        <Link to="/devices" className="card__link">View all</Link>
      </div>
      <div className="device-health__summary">
        <div className="device-health__stat device-health__stat--healthy">
          <span>{summary.healthy}</span>
          <small>Healthy</small>
        </div>
        <div className="device-health__stat device-health__stat--warning">
          <span>{summary.warning}</span>
          <small>Warning</small>
        </div>
        <div className="device-health__stat device-health__stat--critical">
          <span>{summary.critical}</span>
          <small>Critical</small>
        </div>
      </div>
      <ul className="device-health__list">
        {devices.slice(0, limit).map((device) => (
          <li key={device.id}>
            <div>
              <strong>{device.badgeId}</strong>
              <span>{device.restroomName || '—'}</span>
            </div>
            <div className="device-health__meta">
              <StatusBadge status={device.health} variant="health" />
              <span className="device-health__time">
                {device.lastCommunication ? formatDateTime(device.lastCommunication) : '—'}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
