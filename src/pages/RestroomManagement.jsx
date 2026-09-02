import { useEffect, useState, useCallback } from 'react'
import PageHeader from '../components/common/PageHeader'
import StatusBadge from '../components/common/StatusBadge'
import { formatDateTime } from '../utils/formatters'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../context/ToastContext'

const DETAIL_TABS = ['feedback', 'devices']

export default function RestroomManagement() {
  const { user } = useAuth()
  const [rooms, setRooms] = useState([])
  const [floors, setFloors] = useState([])
  const [zones, setZones] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ name: '', floorId: '', organizationId: '', gender: '', status: 'good', zoneId: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Detail panel
  const [selected, setSelected] = useState(null)
  const [detailTab, setDetailTab] = useState('feedback')
  const [detailFeedback, setDetailFeedback] = useState([])
  const [detailDevices, setDetailDevices] = useState([])
  const [detailLoading, setDetailLoading] = useState(false)

  const canEdit = user?.role !== 'viewer'
  const toast = useToast()

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [roomData, floorData, zoneData] = await Promise.all([
        api.get('/api/restrooms'),
        api.get('/api/floors'),
        api.get('/api/zones'),
      ])
      setRooms(roomData.restrooms || [])
      setFloors(floorData.floors || [])
      setZones(zoneData.zones || [])
    } catch (e) {
      console.error('RestroomManagement load error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const loadDetail = useCallback(async (room) => {
    setSelected(room)
    setDetailLoading(true)
    try {
      const [fbData, devData] = await Promise.all([
        api.get(`/api/feedback?restroomId=${room.id}&limit=20`),
        api.get(`/api/devices?restroomId=${room.id}`),
      ])
      setDetailFeedback(fbData.feedback || [])
      setDetailDevices(devData.devices || [])
    } catch (e) {
      console.error('Restroom detail load error:', e)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  function startEdit(room) {
    setEditingId(room.id)
    setForm({
      name: room.name || '',
      floorId: room.floorId || '',
      organizationId: room.organizationId || user?.organizationId || '',
      gender: room.gender || '',
      status: room.status || 'good',
      zoneId: room.zones?.[0]?.id || '',
    })
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm({ name: '', floorId: '', organizationId: '', gender: '', status: 'good', zoneId: '' })
    setShowForm(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        name: form.name,
        floorId: form.floorId,
        organizationId: form.organizationId || user?.organizationId,
        gender: form.gender,
        status: form.status,
        zoneId: form.zoneId || null,
      }
      if (editingId) {
        const data = await api.put(`/api/restrooms/${editingId}`, payload)
        setRooms((prev) => prev.map((r) => r.id === editingId ? { ...r, ...data.restroom } : r))
        // Update selected panel if editing the currently selected room
        if (selected?.id === editingId) setSelected((prev) => ({ ...prev, ...data.restroom }))
      } else {
        const data = await api.post('/api/restrooms', payload)
        setRooms((prev) => [data.restroom, ...prev])
      }
      toast.success(editingId ? 'Restroom updated.' : 'Restroom created.')
      cancelEdit()
    } catch (err) {
      toast.error(err.message || 'Failed to save restroom.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this restroom?')) return
    try {
      await api.delete(`/api/restrooms/${id}`)
      setRooms((prev) => prev.filter((r) => r.id !== id))
      if (selected?.id === id) setSelected(null)
      toast.success('Restroom deleted.')
    } catch (err) {
      toast.error(err.message || 'Failed to delete restroom.')
    }
  }

  // Floors grouped by site for the dropdown
  const floorsBySite = floors.reduce((acc, f) => {
    const site = f.location ? `${f.location.city} — ${f.location.officeName}` : f.locationId || 'Unknown'
    if (!acc[site]) acc[site] = []
    acc[site].push(f)
    return acc
  }, {})

  // Zones filtered by selected floor
  const floorsZones = zones.filter((z) => !form.floorId || z.floorId === form.floorId)

  return (
    <div className="page">
      <PageHeader
        action={
          canEdit ? (
            <div style={{ display: 'flex', gap: 8 }}>
              {editingId && (
                <button type="button" className="btn btn--ghost" onClick={cancelEdit}>Cancel Edit</button>
              )}
              <button
                data-tour="restroom-add-btn"
                type="button"
                className="btn btn--primary"
                onClick={() => {
                  if (showForm && !editingId) { cancelEdit(); return }
                  setEditingId(null)
                  setForm({ name: '', floorId: '', organizationId: user?.organizationId || '', gender: '', status: 'good', zoneId: '' })
                  setShowForm(true)
                }}
              >
                {showForm && !editingId ? 'Cancel' : 'Add Restroom'}
              </button>
            </div>
          ) : null
        }
      />

      {/* ── Form ── */}
      {canEdit && showForm && (
        <form className="card form-grid" onSubmit={handleSubmit} style={{ marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 15, gridColumn: '1 / -1' }}>
            {editingId ? 'Edit Restroom' : 'Add Restroom'}
          </h3>

          <label>
            Name *
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Restroom 101" required />
          </label>

          <label>
            Floor *
            <select value={form.floorId} onChange={(e) => setForm({ ...form, floorId: e.target.value, zoneId: '' })} className="select" required>
              <option value="">Select a floor…</option>
              {Object.entries(floorsBySite).map(([site, siteFloors]) => (
                <optgroup key={site} label={site}>
                  {siteFloors.map((f) => (
                    <option key={f.id} value={f.id}>{f.floorName}{f.floorNumber != null ? ` (Floor ${f.floorNumber})` : ''}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          <label>
            Link to Zone
            <select value={form.zoneId} onChange={(e) => setForm({ ...form, zoneId: e.target.value })} className="select" disabled={!form.floorId}>
              <option value="">No zone linked</option>
              {floorsZones.map((z) => (
                <option key={z.id} value={z.id}>{z.name}</option>
              ))}
            </select>
          </label>

          <label>
            Gender
            <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} className="select">
              <option value="">All / Unisex</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="unisex">Unisex</option>
            </select>
          </label>

          <label>
            Status
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="select">
              <option value="good">Good</option>
              <option value="alert">Alert</option>
              <option value="offline">Offline</option>
            </select>
          </label>

          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', gridColumn: '1 / -1' }}>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Update Restroom' : 'Save Restroom'}
            </button>
            <button type="button" className="btn btn--ghost" onClick={cancelEdit}>Cancel</button>
          </div>
        </form>
      )}

      {/* ── Main layout: table + detail panel ── */}
      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap: 16 }}>
        {/* Table */}
        <div className="card" data-tour="restroom-table">
          {loading ? (
            <div className="loader"><div className="loader__spinner" /></div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Site</th>
                    <th>Floor</th>
                    <th>Zone</th>
                    <th>Gender</th>
                    <th>Status</th>
                    {canEdit && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((room) => {
                    const siteName = room.floor?.location
                      ? `${room.floor.location.city} — ${room.floor.location.officeName}` : '—'
                    const linkedZone = room.zones?.[0]?.name || '—'
                    return (
                      <tr
                        key={room.id}
                        className={`${editingId === room.id ? 'data-table__row--selected' : ''} ${selected?.id === room.id ? 'data-table__row--selected' : ''}`}
                        style={{ cursor: 'pointer' }}
                        onClick={() => loadDetail(room)}
                      >
                        <td style={{ fontWeight: 500 }}>{room.name}</td>
                        <td>{siteName}</td>
                        <td>{room.floor?.floorName || room.floorId}</td>
                        <td style={{ fontSize: 12, color: '#94a3b8' }}>{linkedZone}</td>
                        <td>{room.gender || '—'}</td>
                        <td><StatusBadge status={room.status || 'good'} variant="restroom" /></td>
                        {canEdit && (
                          <td onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button type="button" className="btn btn--secondary btn--sm" onClick={() => startEdit(room)}>Edit</button>
                              <button type="button" className="btn btn--danger btn--sm" onClick={() => handleDelete(room.id)}>Delete</button>
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                  {rooms.length === 0 && (
                    <tr>
                      <td colSpan={canEdit ? 7 : 6} style={{ textAlign: 'center', color: '#64748b' }}>No restrooms found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <aside className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{selected.name}</h3>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8' }}>
                  {selected.floor?.location ? `${selected.floor.location.city} — ${selected.floor.location.officeName}` : ''}
                  {selected.floor ? ` · ${selected.floor.floorName}` : ''}
                </p>
              </div>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setSelected(null)}>✕</button>
            </div>

            <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: 13, marginBottom: 12 }}>
              <dt style={{ color: '#64748b' }}>Status</dt>
              <dd><StatusBadge status={selected.status || 'good'} variant="restroom" /></dd>
              <dt style={{ color: '#64748b' }}>Gender</dt>
              <dd>{selected.gender || '—'}</dd>
              <dt style={{ color: '#64748b' }}>Linked Zone</dt>
              <dd style={{ fontSize: 12 }}>{selected.zones?.[0]?.name || '—'}</dd>
            </dl>

            {/* Tabs */}
            <div className="tabs" style={{ marginBottom: 10 }}>
              {DETAIL_TABS.map((t) => (
                <button key={t} type="button" className={`tab ${detailTab === t ? 'tab--active' : ''}`} onClick={() => setDetailTab(t)}>
                  {t === 'feedback' ? 'Feedback History' : 'Devices'}
                </button>
              ))}
            </div>

            {detailLoading ? (
              <div className="loader-wrap" style={{ height: 80 }}><div className="loader" /></div>
            ) : detailTab === 'feedback' ? (
              <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                {detailFeedback.length === 0 ? (
                  <p style={{ color: '#64748b', fontSize: 13 }}>No feedback recorded.</p>
                ) : (
                  <table className="data-table" style={{ fontSize: 12 }}>
                    <thead>
                      <tr><th>Time</th><th>Type</th><th>Battery</th></tr>
                    </thead>
                    <tbody>
                      {detailFeedback.map((fb) => (
                        <tr key={fb.id}>
                          <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(fb.timestamp)}</td>
                          <td><StatusBadge status={fb.feedbackType} variant="feedback" /></td>
                          <td>{fb.battery != null ? `${fb.battery}%` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ) : (
              <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                {detailDevices.length === 0 ? (
                  <p style={{ color: '#64748b', fontSize: 13 }}>No devices assigned.</p>
                ) : (
                  <table className="data-table" style={{ fontSize: 12 }}>
                    <thead>
                      <tr><th>Badge ID</th><th>Health</th><th>Battery</th><th>Last Seen</th></tr>
                    </thead>
                    <tbody>
                      {detailDevices.map((d) => (
                        <tr key={d.id}>
                          <td><code>{d.badgeId}</code></td>
                          <td><StatusBadge status={d.health || d.healthStatus || 'healthy'} variant="health" /></td>
                          <td>{d.battery != null ? `${d.battery}%` : '—'}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>{d.lastCommunication ? formatDateTime(d.lastCommunication) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  )
}
