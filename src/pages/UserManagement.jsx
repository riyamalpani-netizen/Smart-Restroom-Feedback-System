import { useEffect, useState, useMemo } from 'react'
import PageHeader from '../components/common/PageHeader'
import StatusBadge from '../components/common/StatusBadge'
import api from '../services/api'
import { ROLE_LABELS, ROLES, getAssignableRoles } from '../utils/constants'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../context/ToastContext'

// Sub-sections the Vendor Admin manages, in order
const ROLE_SECTIONS = [
  {
    key: 'regional_manager',
    label: 'Regional Managers',
    desc: 'Oversee multiple sites within one or more regions.',
    scopeField: 'regions',
    scopeLabel: 'Assigned Regions',
    scopePlaceholder: 'e.g. North, South (comma-separated)',
  },
  {
    key: 'vendor_manager',
    label: 'Vendor Managers',
    desc: 'Manage day-to-day vendor operations across assigned sites.',
    scopeField: 'sites',
    scopeLabel: 'Operational Scope (Sites)',
    scopePlaceholder: 'e.g. Site A, Site B (comma-separated)',
  },
  {
    key: 'site_incharge',
    label: 'Site Incharges',
    desc: 'Responsible for a specific site. Cannot create new sites.',
    scopeField: 'sites',
    scopeLabel: 'Assigned Sites',
    scopePlaceholder: 'e.g. Site A (comma-separated)',
  },
  {
    key: 'facility_manager',
    label: 'Facility Managers',
    desc: 'Operational access to site devices, alerts and feedback.',
    scopeField: null,
  },
  {
    key: 'viewer',
    label: 'Viewers',
    desc: 'Read-only access to dashboards and reports.',
    scopeField: null,
  },
]

function emptyForm(role, orgId) {
  return { name: '', email: '', password: '', role, organizationId: orgId, scope: '' }
}

export default function UserManagement() {
  const { user: currentUser } = useAuth()
  const isVendorAdmin = currentUser?.role === ROLES.VENDOR_ADMIN
  const isSuperAdmin = currentUser?.role === ROLES.SUPER_ADMIN
  const assignableRoles = getAssignableRoles(currentUser?.role)

  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Active section (role key) for Vendor Admin tabbed view
  const [activeSection, setActiveSection] = useState(ROLE_SECTIONS[0].key)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [form, setForm] = useState(emptyForm(assignableRoles[0] ?? ROLES.VIEWER, isVendorAdmin ? currentUser?.organizationId : ''))

  const orgIdForNew = isVendorAdmin ? currentUser?.organizationId : ''
  const toast = useToast()

  useEffect(() => { loadUsers() }, [])

  async function loadUsers() {
    setLoading(true); setError(null)
    try {
      const data = await api.get('/api/users')
      setUsers(data.users || [])
    } catch (e) {
      setError('Failed to load users.')
    } finally {
      setLoading(false)
    }
  }

  // Users for the currently visible section
  const sectionUsers = useMemo(
    () => (isVendorAdmin ? users.filter((u) => u.role === activeSection) : users),
    [users, activeSection, isVendorAdmin],
  )

  const currentSection = ROLE_SECTIONS.find((s) => s.key === activeSection) || ROLE_SECTIONS[0]

  function openAdd() {
    const role = isVendorAdmin ? activeSection : (assignableRoles[0] ?? ROLES.VIEWER)
    setEditingUser(null)
    setForm(emptyForm(role, orgIdForNew))
    setShowForm(true)
  }

  function openEdit(u) {
    setEditingUser(u)
    setForm({ name: u.name, email: u.email, password: '', role: u.role, organizationId: u.organizationId, scope: u.scope || '' })
    setShowForm(true)
  }

  function cancelForm() { setShowForm(false); setEditingUser(null) }

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      const payload = {
        name: form.name,
        email: form.email,
        role: form.role,
        organizationId: isVendorAdmin ? currentUser.organizationId : form.organizationId,
        scope: form.scope || undefined,
      }
      if (editingUser) {
        if (form.password) payload.password = form.password
        const data = await api.put(`/api/users/${editingUser.id}`, payload)
        setUsers((prev) => prev.map((u) => (u.id === editingUser.id ? data.user : u)))
      } else {
        payload.password = form.password
        const data = await api.post('/api/users', payload)
        setUsers((prev) => [data.user, ...prev])
      }
      cancelForm()
      toast.success(editingUser ? 'User updated.' : 'User created.')
    } catch (err) { toast.error(err.message || 'Failed to save user.') }
  }

  async function toggleActive(u) {
    try {
      const data = await api.put(`/api/users/${u.id}`, { active: !u.active })
      setUsers((prev) => prev.map((x) => (x.id === u.id ? data.user : x)))
      toast.success(`User ${u.active ? 'deactivated' : 'activated'}.`)
    } catch (err) { toast.error(err.message || 'Failed to update user.') }
  }

  function canManageRow(row) {
    if (isSuperAdmin) return true
    if (isVendorAdmin) {
      if (row.role === ROLES.SUPER_ADMIN || row.role === ROLES.VENDOR_ADMIN) return false
      if (row.organizationId !== currentUser.organizationId) return false
      return true
    }
    return false
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="page">
      <PageHeader
        action={
          <button data-tour="user-add-btn" type="button" className="btn btn--primary" onClick={openAdd}>
            Add User
          </button>
        }
      />

      {/* ── Vendor Admin role-section tabs ── */}
      {isVendorAdmin && (
        <div className="tabs" style={{ marginBottom: 12 }} data-tour="user-role-tabs">
          {ROLE_SECTIONS.map((s) => (
            <button
              key={s.key}
              type="button"
              className={`tab ${activeSection === s.key ? 'tab--active' : ''}`}
              onClick={() => { setActiveSection(s.key); setShowForm(false) }}
            >
              {s.label}
              <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.7 }}>
                ({users.filter((u) => u.role === s.key).length})
              </span>
            </button>
          ))}
        </div>
      )}

      {isVendorAdmin && (
        <p className="settings-section__desc" style={{ marginBottom: 12, color: '#94a3b8', fontSize: 13 }}>
          {currentSection.desc}
        </p>
      )}

      {/* ── Form ── */}
      {showForm && (
        <div className="um-form-card card">
          {/* Header */}
          <div className="um-form-card__header">
            <div className="um-form-card__header-icon">
              {editingUser ? '✏️' : '👤'}
            </div>
            <div>
              <h3 className="um-form-card__title">
                {editingUser
                  ? `Edit ${ROLE_LABELS[form.role] || 'User'}`
                  : `Add ${ROLE_LABELS[isVendorAdmin ? activeSection : form.role] || 'User'}`}
              </h3>
              <p className="um-form-card__subtitle">
                {editingUser ? 'Update the user details below.' : 'Fill in the details to create a new user account.'}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="um-form-grid">

              {/* Name */}
              <div className="um-field">
                <label className="um-label">Full Name <span className="um-required">*</span></label>
                <input
                  className="um-input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Jane Smith"
                  required
                />
              </div>

              {/* Email */}
              <div className="um-field">
                <label className="um-label">Email Address <span className="um-required">*</span></label>
                <input
                  className="um-input"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="jane@example.com"
                  required
                />
              </div>

              {/* Password */}
              <div className="um-field">
                <label className="um-label">
                  Password
                  {!editingUser && <span className="um-required"> *</span>}
                  {editingUser && <span className="um-hint"> — leave blank to keep current</span>}
                </label>
                <input
                  className="um-input"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required={!editingUser}
                  autoComplete="new-password"
                  placeholder={editingUser ? '••••••••' : 'Min 8 characters'}
                />
              </div>

              {/* Role */}
              {isSuperAdmin ? (
                <div className="um-field">
                  <label className="um-label">Role <span className="um-required">*</span></label>
                  <select
                    className="um-input"
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                  >
                    {assignableRoles.map((r) => (
                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="um-field">
                  <label className="um-label">Role</label>
                  <input
                    className="um-input um-input--locked"
                    value={ROLE_LABELS[activeSection] || activeSection}
                    disabled
                  />
                </div>
              )}

              {/* Scope */}
              {currentSection.scopeField && (
                <div className="um-field um-field--full">
                  <label className="um-label">{currentSection.scopeLabel}</label>
                  <input
                    className="um-input"
                    value={form.scope}
                    onChange={(e) => setForm({ ...form, scope: e.target.value })}
                    placeholder={currentSection.scopePlaceholder}
                  />
                  <span className="um-hint">Used for reference and filtering. Separate multiple values with commas.</span>
                </div>
              )}

              {/* Organisation */}
              {isSuperAdmin ? (
                <div className="um-field">
                  <label className="um-label">Organisation ID <span className="um-required">*</span></label>
                  <input
                    className="um-input"
                    value={form.organizationId}
                    onChange={(e) => setForm({ ...form, organizationId: e.target.value })}
                    placeholder="org-cuid"
                    required
                  />
                </div>
              ) : (
                <div className="um-field">
                  <label className="um-label">Organisation</label>
                  <input
                    className="um-input um-input--locked"
                    value={currentUser.organizationId}
                    disabled
                  />
                </div>
              )}

            </div>

            {/* Actions */}
            <div className="um-form-actions">
              <button type="button" className="btn btn--secondary" onClick={cancelForm}>
                Cancel
              </button>
              <button type="submit" className="btn btn--primary">
                {editingUser ? 'Save Changes' : 'Create User'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Table ── */}
      <div className="card" data-tour="user-table">
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
                  {isVendorAdmin && currentSection.scopeField && <th>{currentSection.scopeLabel}</th>}
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sectionUsers.map((u) => {
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
                      {isVendorAdmin && currentSection.scopeField && (
                        <td style={{ fontSize: 12, color: '#94a3b8' }}>{u.scope || '—'}</td>
                      )}
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
                            <button type="button" className="btn btn--ghost btn--sm" onClick={() => openEdit(u)}>Edit</button>
                            <button
                              type="button"
                              className="btn btn--ghost btn--sm"
                              onClick={() => toggleActive(u)}
                            >
                              {u.active ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {sectionUsers.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: '#64748b' }}>
                      No {isVendorAdmin ? currentSection.label.toLowerCase() : 'users'} found
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
