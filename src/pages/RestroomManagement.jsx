import { useState } from 'react'
import PageHeader from '../components/common/PageHeader'
import StatusBadge from '../components/common/StatusBadge'
import { restrooms } from '../services/mockData'

export default function RestroomManagement() {
  const [rooms, setRooms] = useState(restrooms)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', floor: 1, location: '', badgeId: '' })

  function handleAdd(e) {
    e.preventDefault()
    const newRoom = {
      id: `r${Date.now()}`,
      ...form,
      floor: Number(form.floor),
      status: 'good',
    }
    setRooms([...rooms, newRoom])
    setForm({ name: '', floor: 1, location: '', badgeId: '' })
    setShowForm(false)
  }

  function handleDelete(id) {
    setRooms(rooms.filter((r) => r.id !== id))
  }

  return (
    <div className="page">
      <PageHeader
        title="Restroom Management"
        subtitle="Add, edit, and manage restroom locations"
        action={
          <button type="button" className="btn btn--primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : 'Add Restroom'}
          </button>
        }
      />

      {showForm && (
        <form className="card form-grid" onSubmit={handleAdd}>
          <label>
            Name
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Floor 1 - Men"
              required
            />
          </label>
          <label>
            Floor
            <input
              type="number"
              min="1"
              value={form.floor}
              onChange={(e) => setForm({ ...form, floor: e.target.value })}
              required
            />
          </label>
          <label>
            Location
            <input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="East Wing"
              required
            />
          </label>
          <label>
            Badge ID
            <input
              value={form.badgeId}
              onChange={(e) => setForm({ ...form, badgeId: e.target.value })}
              placeholder="B006"
              required
            />
          </label>
          <button type="submit" className="btn btn--primary">Save Restroom</button>
        </form>
      )}

      <div className="card">
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Floor</th>
                <th>Location</th>
                <th>Badge ID</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((room) => (
                <tr key={room.id}>
                  <td>{room.name}</td>
                  <td>{room.floor}</td>
                  <td>{room.location}</td>
                  <td><code>{room.badgeId}</code></td>
                  <td><StatusBadge status={room.status} variant="restroom" /></td>
                  <td>
                    <button type="button" className="btn btn--ghost btn--sm">Edit</button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm btn--danger"
                      onClick={() => handleDelete(room.id)}
                    >
                      Delete
                    </button>
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
