import { useEffect, useState } from 'react'
import PageHeader from '../components/common/PageHeader'
import api from '../services/api'
import { ROLE_LABELS, ROLES, getAssignableRoles } from '../utils/constants'
import { useAuth } from '../hooks/useAuth'

export default function UserManagement() {
  const { user: currentUser } = useAuth()
  const isVendorAdmin = currentUser?.role === ROLES.VENDOR_ADMIN
  const isSuperAdmin = currentUser?.role === ROLES.SUPER_ADMIN

  // Roles this actor is allowed to assign
  const assignableRoles = getAssignableRoles(currentUser?.role)

  const [users, setUsers] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: assignableRoles[0] ?? ROLES.VIEWER,
    organizationId: '',
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Vendor Admin users are always in their own org — prefill and lock the field
  const orgIdForNewUser = isVendorAdmin ? currentUser.organizationId : ''

  useEffect(() => {
    loadUsers()
  }, [])

  async function loadUsers() {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get('/api/users')
      setUsers(data.users || [])
    } catch (e) {
      console.error('UserManagement load error:', e)
      setError('Failed to load users. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function openAddForm() {
    setEditingUser(null)
    setForm({
      name: '',
      email: '',
      password: '',
      role: assignableRoles[0] ?? ROLES.VIEWER,
      organizationId: orgIdForNewUser,
    })
    setShowForm(true)
  }

  function openEditForm(u) {
    setEditingUser(u)
    setForm({
      name: u.name,
      email: u.email,
      password: '',
      role: u.role,
      organizationId: u.organizationId,
    })
    setShowForm(true)
  }

  function cancelForm() {
    setShowForm(false)
    setEditingUser(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      if (editingUser) {
        // Update
        const payload = {
          name: form.name,
          email: form.email,
          role: form.role,
          organizationId: form.organizationId,
        }
        if (form.password) payload.password = form.password
        const data = await api.put(`/api/users/${editingUser.id}`, payload)
        setUsers(users.map((u) => (u.id === editingUser.id ? data.user : u)))
      } else {
        // Create
        const payload = {
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
          organizationId: isVendorAdmin ? currentUser.organizationId : form.organizationId,
        }
        const data = await api.post('/api/users', payload)
        setUsers([data.user, ...users])
      }
      cancelForm()
    } catch (err) {
      alert(err.message)
    }
  }

  async function toggleActive(id) {
    try {
      const target = users.find((u) => u.id === id)
      if (!target) return
      const data = await api.put(`/api/users/${id}`, { active: !target.active })
      setUsers(users.map((u) => (u.id === id ? data.user : u)))
    } catch (err) {
      alert(err.message)
    }
  }

  async function handleDeactivate(id) {
    if (!window.confirm('Deactivate this user?')) return
    try {
      await api.delete(`/api/users/${id}`)
      // Reflect soft-delete — backend returns the deactivated user
      setUsers(users.map((u) => (u.id === id ? { ...u, active: false } : u)))
    } catch (err) {
      alert(err.message)
    }
  }

  // Determine whether the current user can act on a particular row
  function canManageRow(row) {
    if (isSuperAdmin) return true
    if (isVendorAdmin) {
      // Cannot touch super_admin or vendor_admin rows
      if (row.role === ROLES.SUPER_ADMIN || row.role === ROLES.VENDOR_ADMIN) return false
      // Must be same org
      if (row.organizationId !== currentUser.organizationId) return false
      return true
    }
    return false
  }

  return (
    <div className="page">
      <PageHeader
        action={
          <button type="button" className="btn btn--primary" onClick={openAddForm}>
            Add User
          </button>
        }
      />

      {/* Vendor Admin scope notice */}
      {isVendorAdmin && (
        <div className="info-banner" role="note">
          You can create and manage <strong>Facility Manager</strong> and <strong>Viewer</strong>{' '}
          accounts within your organisation.
        </div>
      )}

      {showForm && (
        <form className="card form-grid" onSubmit={handleSubmit}>
          <h3 className="form-grid__title">
            {editingUser ? 'Edit User' : 'Add New User'}
          </h3>

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
            Password {editingUser && <span className="form-hint">(leave blank to keep current)</span>}
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required={!editingUser}
              autoComplete="new-password"
            />
          </label>

          <label>
            Role
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="select"
            >
              {assignableRoles.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </label>

          {/* Super Admin can set any org; Vendor Admin is locked to their own */}
          {isSuperAdmin ? (
            <label>
              Organization ID
              <input
                value={form.organizationId}
                onChange={(e) => setForm({ ...form, organizationId: e.target.value })}
                placeholder="org-cuid"
                required
              />
            </label>
          ) : (
            <label>
              Organisation
              <input
                value={currentUser.organizationId}
                disabled
                className="input--locked"
                title="Users are created within your organisation"
              />
            </label>
          )}

          <div className="form-grid__actions">
            <button type="submit" className="btn btn--primary">
              {editingUser ? 'Save Changes' : 'Create User'}
            </button>
            <button type="button" className="btn btn--secondary" onClick={cancelForm}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="card">
        {loading ? (
          <div className="loader-wrap"><div className="loader" /></div>
        ) : error ? (
          <div className="error-message">{error}</div>
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
                {users.map((u) => {
                  const manageable = canManageRow(u)
                  return (
                    <tr key={u.id}>
                      <td>{u.name}</td>
                      <td>{u.email}</td>
                      <td>
                        <span className={`role-badge role-badge--${u.role}`}>
                          {ROLE_LABELS[u.role] || u.role}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`status-badge ${u.active ? '' : 'status-badge--inactive'}`}
                          style={{ '--badge-color': u.active ? '#22c55e' : '#94a3b8' }}
                        >
                          {u.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        {manageable ? (
                          <div className="btn-group">
                            <button
                              type="button"
                              className="btn btn--ghost btn--sm"
                              onClick={() => openEditForm(u)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn btn--ghost btn--sm"
                              onClick={() => toggleActive(u.id)}
                              title={u.active ? 'Deactivate user' : 'Activate user'}
                            >
                              {u.active ? 'Deactivate' : 'Activate'}
                            </button>
                            {/* Full delete only for super_admin */}
                            {isSuperAdmin && (
                              <button
                                type="button"
                                className="btn btn--ghost btn--sm btn--danger"
                                onClick={() => handleDeactivate(u.id)}
                                title="Permanently deactivate user"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
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
