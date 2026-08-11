import { useEffect, useState } from 'react'
import PageHeader from '../components/common/PageHeader'
import SearchBar from '../components/common/SearchBar'
import StatusBadge from '../components/common/StatusBadge'
import { formatDateTime } from '../utils/formatters'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'

export default function DeviceManagement() {
  const { user } = useAuth()
  const [devices, setDevices] = useState([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const canEdit = user?.role !== 'viewer'

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      try {
        const data = await api.get('/api/devices')
        if (mounted) setDevices(data.devices || [])
      } catch (e) {
        console.error('DeviceManagement load error:', e)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  const filtered = devices.filter(
    (d) =>
      !search ||
      d.badgeId?.toLowerCase().includes(search.toLowerCase()) ||
      d.restroomName?.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="page">
      <PageHeader
        action={canEdit ? <button type="button" className="btn btn--primary">Map New Badge</button> : null}
      />

      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="Search devices..."
      />

      <div className="device-layout">
        <div className="card">
          {loading ? (
            <div className="loader-wrap"><div className="loader" /></div>
          ) : (
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
                      <td>{device.restroomName}</td>
                      <td>
                        <span className={`battery battery--${(device.battery ?? 100) >= 30 ? 'ok' : 'low'}`}>
                          {device.battery ?? '—'}%
                        </span>
                      </td>
                      <td><StatusBadge status={device.status || 'offline'} variant="device" /></td>
                      <td><StatusBadge status={device.health || 'healthy'} variant="health" /></td>
                      <td>{device.lastCommunication ? formatDateTime(device.lastCommunication) : '—'}</td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', color: '#64748b' }}>
                        No devices found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {selected && (
          <aside className="card device-detail">
            <h3>Device Details</h3>
            <dl>
              <dt>Badge ID</dt>
              <dd><code>{selected.badgeId}</code></dd>
              <dt>Restroom</dt>
              <dd>{selected.restroomName}</dd>
              <dt>Battery</dt>
              <dd>{selected.battery ?? '—'}%</dd>
              <dt>Status</dt>
              <dd><StatusBadge status={selected.status || 'offline'} variant="device" /></dd>
              <dt>Health</dt>
              <dd><StatusBadge status={selected.health || 'healthy'} variant="health" /></dd>
              <dt>Last Communication</dt>
              <dd>{selected.lastCommunication ? formatDateTime(selected.lastCommunication) : '—'}</dd>
            </dl>
            <div className="btn-group">
              {canEdit ? (
                <>
                  <button type="button" className="btn btn--secondary">Replace Badge</button>
                  <button type="button" className="btn btn--secondary">Remap</button>
                </>
              ) : null}
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
