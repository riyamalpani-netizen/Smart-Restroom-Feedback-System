import { useEffect, useState, useCallback } from 'react'
import PageHeader from '../components/common/PageHeader'
import SearchBar from '../components/common/SearchBar'
import StatusBadge from '../components/common/StatusBadge'
import { formatDateTime } from '../utils/formatters'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'

export default function DeviceManagement() {
  const { user } = useAuth()
  const [devices, setDevices] = useState([])
  const [restrooms, setRestrooms] = useState([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [replaceOpen, setReplaceOpen] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ badgeId: '', deviceEui: '', restroomId: '' })
  const canEdit = user?.role !== 'viewer'

  const loadDevices = useCallback(async () => {
    try {
      const data = await api.get('/api/devices')
      setDevices(data.devices || [])
    } catch (e) {
      console.error('DeviceManagement load error:', e)
    }
  }, [])

  const loadRestrooms = useCallback(async () => {
    try {
      const data = await api.get('/api/restrooms')
      setRestrooms(data.restrooms || [])
    } catch (e) {
      console.error('Load restrooms error:', e)
    }
  }, [])

  useEffect(() => {
    let mounted = true
    async function init() {
      setLoading(true)
      await Promise.all([loadDevices(), loadRestrooms()])
      if (mounted) setLoading(false)
    }
    init()
    return () => { mounted = false }
  }, [loadDevices, loadRestrooms])

  useEffect(() => {
    const timer = setInterval(() => {
      loadDevices()
    }, 30000)
    return () => clearInterval(timer)
  }, [loadDevices])

  const filtered = devices.filter(
    (d) =>
      !search ||
      d.badgeId?.toLowerCase().includes(search.toLowerCase()) ||
      d.restroomName?.toLowerCase().includes(search.toLowerCase()),
  )

  const openReplace = (device) => {
    setSelected(device)
    setForm({ badgeId: device.badgeId || '', deviceEui: device.deviceEui || '', restroomId: device.restroomId || '' })
    setReplaceOpen(true)
  }

  const openMap = (device) => {
    setSelected(device)
    setForm({ badgeId: device.badgeId || '', deviceEui: device.deviceEui || '', restroomId: device.restroomId || '' })
    setMapOpen(true)
  }

  const handleSaveReplace = async (e) => {
    e.preventDefault()
    if (!selected) return
    setSaving(true)
    try {
      const data = await api.put(`/api/devices/${selected.id}`, {
        badgeId: form.badgeId,
        deviceEui: form.deviceEui,
      })
      setDevices((prev) => prev.map((d) => (d.id === selected.id ? { ...d, ...data.device } : d)))
      setSelected((prev) => ({ ...prev, ...data.device }))
      setReplaceOpen(false)
    } catch (e) {
      console.error('Replace badge error:', e)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveMap = async (e) => {
    e.preventDefault()
    if (!selected) return
    setSaving(true)
    try {
      const data = await api.put(`/api/devices/${selected.id}`, {
        restroomId: form.restroomId || null,
      })
      setDevices((prev) => prev.map((d) => (d.id === selected.id ? { ...d, ...data.device } : d)))
      setSelected((prev) => ({ ...prev, ...data.device }))
      setMapOpen(false)
    } catch (e) {
      console.error('Map badge error:', e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page">
      <PageHeader
        action={
          canEdit ? (
            <button type="button" className="btn btn--primary" onClick={() => setMapOpen(true)}>
              Map New Badge
            </button>
          ) : null
        }
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
              <dt>Device EUI</dt>
              <dd><code>{selected.deviceEui || '—'}</code></dd>
              <dt>Restroom</dt>
              <dd>{selected.restroomName}</dd>
              <dt>Floor</dt>
              <dd>{selected.floorName || '—'}</dd>
              <dt>Location</dt>
              <dd>{selected.locationName || '—'}</dd>
              <dt>Battery</dt>
              <dd>{selected.battery ?? '—'}%</dd>
              <dt>Status</dt>
              <dd><StatusBadge status={selected.status || 'offline'} variant="device" /></dd>
              <dt>Health</dt>
              <dd><StatusBadge status={selected.health || 'healthy'} variant="health" /></dd>
              <dt>Last Communication</dt>
              <dd>{selected.lastCommunication ? formatDateTime(selected.lastCommunication) : '—'}</dd>
            </dl>
            {canEdit && (
              <div className="btn-group">
                <button type="button" className="btn btn--secondary" onClick={() => openReplace(selected)}>
                  Replace Badge
                </button>
                <button type="button" className="btn btn--secondary" onClick={() => openMap(selected)}>
                  Map Badge
                </button>
              </div>
            )}
          </aside>
        )}
      </div>

      {replaceOpen && (
        <div className="modal-overlay" onClick={() => setReplaceOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Replace Badge</h3>
            <form onSubmit={handleSaveReplace}>
              <label>
                Badge ID
                <input
                  type="text"
                  value={form.badgeId}
                  onChange={(e) => setForm((f) => ({ ...f, badgeId: e.target.value }))}
                  required
                />
              </label>
              <label>
                Device EUI
                <input
                  type="text"
                  value={form.deviceEui}
                  onChange={(e) => setForm((f) => ({ ...f, deviceEui: e.target.value }))}
                  required
                />
              </label>
              <div className="btn-group">
                <button type="button" className="btn btn--secondary" onClick={() => setReplaceOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn--primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {mapOpen && (
        <div className="modal-overlay" onClick={() => setMapOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Map Badge</h3>
            <form onSubmit={handleSaveMap}>
              <label>
                Badge ID
                <input type="text" value={form.badgeId} disabled />
              </label>
              <label>
                Restroom
                <select
                  value={form.restroomId}
                  onChange={(e) => setForm((f) => ({ ...f, restroomId: e.target.value }))}
                  required
                >
                  <option value="">Unassigned</option>
                  {restrooms.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </label>
              <div className="btn-group">
                <button type="button" className="btn btn--secondary" onClick={() => setMapOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn--primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
