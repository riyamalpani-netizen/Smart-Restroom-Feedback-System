import { useState } from 'react'
import PageHeader from '../components/common/PageHeader'
import { users as initialUsers } from '../services/mockData'

export default function UserManagement() {
  const [users, setUsers] = useState(initialUsers)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', role: 'Viewer' })

  function handleAdd(e) {
    e.preventDefault()
    setUsers([...users, { id: `u${Date.now()}`, ...form, active: true }])
    setForm({ name: '', email: '', role: 'Viewer' })
    setShowForm(false)
  }

  function toggleActive(id) {
    setUsers(users.map((u) => (u.id === id ? { ...u, active: !u.active } : u)))
  }

  function handleDelete(id) {
    setUsers(users.filter((u) => u.id !== id))
  }

  return (
    <div className="page">
      <PageHeader
        title="User Management"
        subtitle="Manage users, roles, and access"
        action={
          <button type="button" className="btn btn--primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : 'Add User'}
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
              required
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </label>
          <label>
            Role
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="select"
            >
              <option>Super Admin</option>
              <option>Vendor Admin</option>
              <option>Facility Manager</option>
              <option>Viewer</option>
            </select>
          </label>
          <button type="submit" className="btn btn--primary">Save User</button>
        </form>
      )}

      <div className="card">
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>{user.role}</td>
                  <td>
                    <span className={`status-badge ${user.active ? '' : 'status-badge--inactive'}`}
                      style={{ '--badge-color': user.active ? '#22c55e' : '#94a3b8' }}
                    >
                      {user.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <button type="button" className="btn btn--ghost btn--sm">Edit</button>
                    <button type="button" className="btn btn--ghost btn--sm">Reset Password</button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => toggleActive(user.id)}
                    >
                      {user.active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm btn--danger"
                      onClick={() => handleDelete(user.id)}
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
