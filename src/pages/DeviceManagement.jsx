import { useState } from 'react'
import PageHeader from '../components/common/PageHeader'
import SearchBar from '../components/common/SearchBar'
import StatusBadge from '../components/common/StatusBadge'
import { formatDateTime } from '../utils/formatters'
import { devices, getRestroomName } from '../services/mockData'

export default function DeviceManagement() {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)

  const filtered = devices.filter(
    (d) =>
      !search ||
      d.badgeId.toLowerCase().includes(search.toLowerCase()) ||
      getRestroomName(d.restroomId).toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="page">
      <PageHeader
        title="Device Management"
        subtitle="Monitor badge devices, battery, and connectivity"
        action={<button type="button" className="btn btn--primary">Map New Badge</button>}
      />

      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="Search devices..."
      />

      <div className="device-layout">
        <div className="card">
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Badge ID</th>
                  <th>Restroom</th>
                  <th>Battery</th>
                  <th>Status</th>
                  <th>Health</th>
                  <th>Last Communication</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((device) => (
                  <tr
                    key={device.id}
                    className={selected?.id === device.id ? 'data-table__row--selected' : ''}
                    onClick={() => setSelected(device)}
                  >
                    <td><code>{device.badgeId}</code></td>
                    <td>{getRestroomName(device.restroomId)}</td>
                    <td>
                      <span className={`battery battery--${device.battery >= 30 ? 'ok' : 'low'}`}>
                        {device.battery}%
                      </span>
                    </td>
                    <td><StatusBadge status={device.status} variant="device" /></td>
                    <td><StatusBadge status={device.health} variant="health" /></td>
                    <td>{formatDateTime(device.lastCommunication)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {selected && (
          <aside className="card device-detail">
            <h3>Device Details</h3>
            <dl>
              <dt>Badge ID</dt>
              <dd><code>{selected.badgeId}</code></dd>
              <dt>Restroom</dt>
              <dd>{getRestroomName(selected.restroomId)}</dd>
              <dt>Battery</dt>
              <dd>{selected.battery}%</dd>
              <dt>Status</dt>
              <dd><StatusBadge status={selected.status} variant="device" /></dd>
              <dt>Health</dt>
              <dd><StatusBadge status={selected.health} variant="health" /></dd>
              <dt>Last Communication</dt>
              <dd>{formatDateTime(selected.lastCommunication)}</dd>
            </dl>
            <div className="btn-group">
              <button type="button" className="btn btn--secondary">Replace Badge</button>
              <button type="button" className="btn btn--secondary">Remap</button>
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
