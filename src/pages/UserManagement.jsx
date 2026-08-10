import { useEffect, useState } from 'react'
import PageHeader from '../components/common/PageHeader'
import StatusBadge from '../components/common/StatusBadge'
import api from '../services/api'
import { ROLE_LABELS } from '../utils/constants'

export default function UserManagement() {
  const [users, setUsers] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'viewer', organizationId: '' })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      try {
        const data = await api.get('/api/users')
        if (mounted) setUsers(data.users || [])
      } catch (e) {
        console.error('UserManagement load error:', e)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  async function handleAdd(e) {
    e.preventDefault()
    try {
      const data = await api.post('/api/users', form)
      setUsers([...users, data.user])
      setForm({ name: '', email: '', password: '', role: 'viewer', organizationId: '' })
      setShowForm(false)
    } catch (err) {
      alert(err.message)
    }
  }

  async function toggleActive(id) {
    try {
      const user = users.find((u) => u.id === id)
      if (!user) return
      const data = await api.put(`/api/users/${id}`, { active: !user.active })
      setUsers(users.map((u) => u.id === id ? data.user : u))
    } catch (err) {
      alert(err.message)
    }
  }

  async function handleDelete(id) {
    try {
      await api.delete(`/api/users/${id}`)
      setUsers(users.filter((u) => u.id !== id))
    } catch (err) {
      alert(err.message)
    }
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
            Password
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
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
              <option value="super_admin">Super Admin</option>
              <option value="vendor_admin">Vendor Admin</option>
              <option value="facility_manager">Facility Manager</option>
              <option value="viewer">Viewer</option>
            </select>
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
          <button type="submit" className="btn btn--primary">Save User</button>
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
                    <td>{ROLE_LABELS[user.role] || user.role}</td>
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
                {users.length === 0 && (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', color: '#64748b' }}>
                      No users found
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
