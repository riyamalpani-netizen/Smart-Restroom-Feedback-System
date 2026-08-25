import { useEffect, useState, useCallback } from 'react'
import PageHeader from '../components/common/PageHeader'
import StatusBadge from '../components/common/StatusBadge'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'

export default function RestroomManagement() {
  const { user } = useAuth()
  const [rooms, setRooms] = useState([])
  const [floors, setFloors] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ name: '', floorId: '', organizationId: '', gender: '', status: 'good' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const canEdit = user?.role !== 'viewer'

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [roomData, floorData] = await Promise.all([
        api.get('/api/restrooms'),
        api.get('/api/floors'),
      ])
      setRooms(roomData.restrooms || [])
      setFloors(floorData.floors || [])
    } catch (e) {
      console.error('RestroomManagement load error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  function startEdit(room) {
    setEditingId(room.id)
    setForm({
      name: room.name || '',
      floorId: room.floorId || '',
      organizationId: room.organizationId || user?.organizationId || '',
      gender: room.gender || '',
      status: room.status || 'good',
    })
    setShowForm(true)
    // Scroll form into view
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm({ name: '', floorId: '', organizationId: '', gender: '', status: 'good' })
    setShowForm(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      if (editingId) {
        const data = await api.put(`/api/restrooms/${editingId}`, {
          name: form.name,
          floorId: form.floorId,
          organizationId: form.organizationId,
          gender: form.gender,
          status: form.status,
        })
        // Update in-place immediately so the table reflects the new name without reload
        setRooms((prev) => prev.map((r) => r.id === editingId ? { ...r, ...data.restroom } : r))
      } else {
        const data = await api.post('/api/restrooms', {
          name: form.name,
          floorId: form.floorId,
          organizationId: form.organizationId || user?.organizationId,
          gender: form.gender,
          status: form.status,
        })
        setRooms((prev) => [data.restroom, ...prev])
      }
      cancelEdit()
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this restroom?')) return
    try {
      await api.delete(`/api/restrooms/${id}`)
      setRooms((prev) => prev.filter((r) => r.id !== id))
    } catch (err) {
      alert(err.message)
    }
  }

  // Group floors by site for the dropdown
  const floorsBySite = floors.reduce((acc, f) => {
    const siteLabel = f.location
      ? `${f.location.city} — ${f.location.officeName}`
      : f.locationId || 'Unknown site'
    if (!acc[siteLabel]) acc[siteLabel] = []
    acc[siteLabel].push(f)
    return acc
  }, {})

  return (
    <div className="page">
      <PageHeader
        action={
          canEdit ? (
            <div style={{ display: 'flex', gap: 8 }}>
              {editingId && (
                <button type="button" className="btn btn--ghost" onClick={cancelEdit}>
                  Cancel Edit
                </button>
              )}
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => {
                  if (showForm && !editingId) { cancelEdit(); return }
                  setEditingId(null)
                  setForm({ name: '', floorId: '', organizationId: user?.organizationId || '', gender: '', status: 'good' })
                  setShowForm(true)
                }}
              >
                {showForm && !editingId ? 'Cancel' : 'Add Restroom'}
              </button>
            </div>
          ) : null
        }
      />

      {canEdit && showForm && (
        <form className="card form-grid" onSubmit={handleSubmit} style={{ marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 15, gridColumn: '1 / -1' }}>
            {editingId ? 'Edit Restroom' : 'Add Restroom'}
          </h3>

          <label>
            Name *
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Restroom 101"
              required
            />
          </label>

          <label>
            Floor *
            <select
              value={form.floorId}
              onChange={(e) => setForm({ ...form, floorId: e.target.value })}
              className="select"
              required
            >
              <option value="">Select a floor…</option>
              {Object.entries(floorsBySite).map(([site, siteFloors]) => (
                <optgroup key={site} label={site}>
                  {siteFloors.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.floorName}{f.floorNumber != null ? ` (Floor ${f.floorNumber})` : ''}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          <label>
            Gender
            <select
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
              className="select"
            >
              <option value="">All / Unisex</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="unisex">Unisex</option>
            </select>
          </label>

          <label>
            Status
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="select"
            >
              <option value="good">Good</option>
              <option value="alert">Alert</option>
              <option value="offline">Offline</option>
            </select>
          </label>

          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Update Restroom' : 'Save Restroom'}
            </button>
            <button type="button" className="btn btn--ghost" onClick={cancelEdit}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="card">
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
                  <th>Gender</th>
                  <th>Status</th>
                  {canEdit && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {rooms.map((room) => {
                  const siteName = room.floor?.location
                    ? `${room.floor.location.city} — ${room.floor.location.officeName}`
                    : '—'
                  return (
                    <tr key={room.id} className={editingId === room.id ? 'data-table__row--selected' : ''}>
                      <td style={{ fontWeight: editingId === room.id ? 600 : 400 }}>{room.name}</td>
                      <td>{siteName}</td>
                      <td>{room.floor?.floorName || room.floorId}</td>
                      <td>{room.gender || '—'}</td>
                      <td><StatusBadge status={room.status || 'good'} variant="restroom" /></td>
                      {canEdit && (
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              type="button"
                              className="btn btn--secondary btn--sm"
                              onClick={() => startEdit(room)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn btn--danger btn--sm"
                              onClick={() => handleDelete(room.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
                {rooms.length === 0 && (
                  <tr>
                    <td colSpan={canEdit ? 6 : 5} style={{ textAlign: 'center', color: '#64748b' }}>
                      No restrooms found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
