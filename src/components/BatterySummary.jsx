import { Link } from 'react-router-dom'

export default function BatterySummary({ devices = [], limit = 4 }) {
  const online = devices.filter((d) => d.status === 'online').length
  const offline = devices.filter((d) => d.status === 'offline').length
  const lowBattery = devices.filter((d) => d.battery < 30).length
  const avgBattery = Math.round(
    devices.length ? devices.reduce((sum, d) => sum + d.battery, 0) / devices.length : 0,
  )

  return (
    <div className="battery-summary card">
      <div className="card__header">
        <h3 className="card__title">Battery & Connectivity</h3>
        <Link to="/devices" className="card__link">View all</Link>
      </div>
      <div className="battery-summary__stats">
        <div className="battery-summary__stat">
          <span className="battery-summary__value">{online}</span>
          <span className="battery-summary__label">Online</span>
        </div>
        <div className="battery-summary__stat">
          <span className="battery-summary__value">{offline}</span>
          <span className="battery-summary__label">Offline</span>
        </div>
        <div className="battery-summary__stat">
          <span className="battery-summary__value">{lowBattery}</span>
          <span className="battery-summary__label">Low Battery</span>
        </div>
        <div className="battery-summary__stat">
          <span className="battery-summary__value">{avgBattery}%</span>
          <span className="battery-summary__label">Avg Battery</span>
        </div>
      </div>
      <div className="battery-summary__bars">
        {devices.slice(0, limit).map((device) => (
          <div key={device.id} className="battery-summary__row">
            <span className="battery-summary__badge">{device.badgeId}</span>
            <div className="battery-summary__track">
              <div
                className={`battery-summary__fill battery-summary__fill--${device.battery >= 30 ? 'ok' : 'low'}`}
                style={{ width: `${device.battery}%` }}
              />
            </div>
            <span className="battery-summary__pct">{device.battery}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
