import { useEffect, useState } from 'react'
import PageHeader from '../components/common/PageHeader'
import StatusBadge from '../components/common/StatusBadge'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'

export default function RestroomManagement() {
  const { user } = useAuth()
  const [rooms, setRooms] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ name: '', floorId: '', organizationId: '', gender: '', status: 'good' })
  const [loading, setLoading] = useState(true)
  const canEdit = user?.role !== 'viewer'

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      try {
        const data = await api.get('/api/restrooms')
        if (mounted) setRooms(data.restrooms || [])
      } catch (e) {
        console.error('RestroomManagement load error:', e)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  function startEdit(room) {
    setEditingId(room.id)
    setForm({
      name: room.name || '',
      floorId: room.floorId || '',
      organizationId: room.organizationId || '',
      gender: room.gender || '',
      status: room.status || 'good',
    })
    setShowForm(true)
  }

  function cancelEdit() {
    setEditingId(null)
    setForm({ name: '', floorId: '', organizationId: '', gender: '', status: 'good' })
    setShowForm(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      if (editingId) {
        const data = await api.put(`/api/restrooms/${editingId}`, form)
        setRooms(rooms.map((r) => (r.id === editingId ? data.restroom : r)))
      } else {
        const data = await api.post('/api/restrooms', form)
        setRooms([...rooms, data.restroom])
      }
      cancelEdit()
    } catch (err) {
      alert(err.message)
    }
  }

  async function handleDelete(id) {
    try {
      await api.delete(`/api/restrooms/${id}`)
      setRooms((prev) => prev.filter((r) => r.id !== id))
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div className="page">
      <PageHeader
        title="Restroom Management"
        subtitle="Add, edit, and manage restroom locations"
        action={
          canEdit ? (
            <button type="button" className="btn btn--primary" onClick={() => { setEditingId(null); setForm({ name: '', floorId: '', organizationId: '', gender: '', status: 'good' }); setShowForm(!showForm) }}>
              {showForm ? 'Cancel' : 'Add Restroom'}
            </button>
          ) : null
        }
      />

      {canEdit && showForm && (
        <form className="card form-grid" onSubmit={handleSubmit}>
          <label>
            Name
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Restroom 101"
              required
            />
          </label>
          <label>
            Floor ID
            <input
              value={form.floorId}
              onChange={(e) => setForm({ ...form, floorId: e.target.value })}
              placeholder="floor-1"
              required
            />
          </label>
          <label>
            Organization ID
            <input
              value={form.organizationId}
              onChange={(e) => setForm({ ...form, organizationId: e.target.value })}
              placeholder="org-demo"
              required
            />
          </label>
          <label>
            Gender
            <select
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
              className="select"
            >
              <option value="">Select</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="unisex">Unisex</option>
            </select>
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="btn btn--primary">{editingId ? 'Update Restroom' : 'Save Restroom'}</button>
            {editingId && (
              <button type="button" className="btn btn--ghost" onClick={cancelEdit}>Cancel</button>
            )}
          </div>
        </form>
      )}

      <div className="card">
        {loading ? (
          <div className="loader-wrap"><div className="loader" /></div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Floor</th>
                  <th>Gender</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((room) => (
                  <tr key={room.id}>
                    <td>{room.name}</td>
                    <td>{room.floor?.floorName || room.floorId}</td>
                    <td>{room.gender || '—'}</td>
                    <td><StatusBadge status={room.status || 'good'} variant="restroom" /></td>
                     <td>
                       {canEdit ? (
                         <>
                           <button type="button" className="btn btn--ghost btn--sm" onClick={() => startEdit(room)}>Edit</button>
                           <button
                             type="button"
                             className="btn btn--ghost btn--sm btn--danger"
                             onClick={() => handleDelete(room.id)}
                           >
                             Delete
                           </button>
                         </>
                       ) : '—'}
                     </td>
                  </tr>
                ))}
                {rooms.length === 0 && (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', color: '#64748b' }}>
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
