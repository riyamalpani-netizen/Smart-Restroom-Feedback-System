import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import api from '../services/api'
import { useToast } from '../context/ToastContext'

export default function Profile() {
  const { user, updateUser } = useAuth()
  const toast = useToast()

  // ── Profile section state ─────────────────────────────────────────────
  const [editingName, setEditingName] = useState(false)
  const [nameVal, setNameVal] = useState(user?.name ?? '')
  const [savingName, setSavingName] = useState(false)

  // ── Password section state ────────────────────────────────────────────
  const [pwOpen, setPwOpen] = useState(false)
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [savingPw, setSavingPw] = useState(false)

  // ── Save name ─────────────────────────────────────────────────────────
  async function handleSaveName(e) {
    e.preventDefault()
    const trimmed = nameVal.trim()
    if (!trimmed) return
    if (trimmed === user?.name) { setEditingName(false); return }
    setSavingName(true)
    try {
      const data = await api.put('/api/auth/profile', { name: trimmed })
      updateUser({ name: data.user.name })
      toast.success('Name updated successfully.')
      setEditingName(false)
    } catch (err) {
      toast.error(err.message || 'Failed to update name.')
    } finally {
      setSavingName(false)
    }
  }

  function handleCancelName() {
    setNameVal(user?.name ?? '')
    setEditingName(false)
  }

  // ── Save password ─────────────────────────────────────────────────────
  async function handleSavePassword(e) {
    e.preventDefault()
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      toast.error('New passwords do not match.')
      return
    }
    if (pwForm.newPassword.length < 8) {
      toast.error('New password must be at least 8 characters.')
      return
    }
    setSavingPw(true)
    try {
      await api.put('/api/auth/profile', {
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      })
      toast.success('Password changed successfully.')
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setPwOpen(false)
    } catch (err) {
      toast.error(err.message || 'Failed to change password.')
    } finally {
      setSavingPw(false)
    }
  }

  function handleCancelPassword() {
    setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    setShowCurrent(false); setShowNew(false); setShowConfirm(false)
    setPwOpen(false)
  }

  const ROLE_LABELS = {
    super_admin: 'Super Admin',
    vendor_admin: 'Vendor Admin',
    regional_manager: 'Regional Manager',
    vendor_manager: 'Vendor Manager',
    site_incharge: 'Site Incharge',
    facility_manager: 'Facility Manager',
    viewer: 'Viewer',
  }

  return (
    <div className="page">
      <div className="profile-card card" style={{ maxWidth: 560 }}>

        {/* ── Avatar + role badge ── */}
        <div className="profile-card__avatar">
          {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
        </div>

        {/* ── Name row ── */}
        <div style={{ width: '100%', marginTop: 20 }}>
          {editingName ? (
            <form onSubmit={handleSaveName} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="text"
                value={nameVal}
                onChange={(e) => setNameVal(e.target.value)}
                autoFocus
                required
                style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 14 }}
              />
              <button type="submit" className="btn btn--primary btn--sm" disabled={savingName}>
                {savingName ? 'Saving…' : 'Save'}
              </button>
              <button type="button" className="btn btn--secondary btn--sm" onClick={handleCancelName}>
                Cancel
              </button>
            </form>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 20, fontWeight: 700 }}>{user?.name}</span>
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() => { setNameVal(user?.name ?? ''); setEditingName(true) }}
              >
                Edit Name
              </button>
            </div>
          )}
        </div>

        {/* ── Details ── */}
        <dl className="profile-card__details" style={{ width: '100%', marginTop: 20 }}>
          <dt>Email</dt>
          <dd>{user?.email}</dd>
          <dt>Role</dt>
          <dd>{ROLE_LABELS[user?.role] ?? user?.role}</dd>
        </dl>

        {/* ── Change password ── */}
        <div style={{ width: '100%', marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
          {!pwOpen ? (
            <button type="button" className="btn btn--secondary" onClick={() => setPwOpen(true)}>
              Change Password
            </button>
          ) : (
            <form onSubmit={handleSavePassword}>
              <p style={{ fontWeight: 600, marginBottom: 14, fontSize: 14 }}>Change Password</p>

              {/* Current password */}
              <label style={{ display: 'block', marginBottom: 12 }}>
                <span style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>Current password</span>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showCurrent ? 'text' : 'password'}
                    value={pwForm.currentPassword}
                    onChange={(e) => setPwForm((f) => ({ ...f, currentPassword: e.target.value }))}
                    required
                    autoComplete="current-password"
                    style={{ width: '100%', padding: '7px 36px 7px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 14, boxSizing: 'border-box' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent((v) => !v)}
                    style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, padding: 0 }}
                    aria-label={showCurrent ? 'Hide password' : 'Show password'}
                  >
                    {showCurrent ? '🙈' : '👁'}
                  </button>
                </div>
              </label>

              {/* New password */}
              <label style={{ display: 'block', marginBottom: 12 }}>
                <span style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>New password <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(min. 8 characters)</span></span>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={pwForm.newPassword}
                    onChange={(e) => setPwForm((f) => ({ ...f, newPassword: e.target.value }))}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    style={{ width: '100%', padding: '7px 36px 7px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 14, boxSizing: 'border-box' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((v) => !v)}
                    style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, padding: 0 }}
                    aria-label={showNew ? 'Hide password' : 'Show password'}
                  >
                    {showNew ? '🙈' : '👁'}
                  </button>
                </div>
              </label>

              {/* Confirm new password */}
              <label style={{ display: 'block', marginBottom: 16 }}>
                <span style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>Confirm new password</span>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={pwForm.confirmPassword}
                    onChange={(e) => setPwForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                    required
                    autoComplete="new-password"
                    style={{ width: '100%', padding: '7px 36px 7px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 14, boxSizing: 'border-box' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, padding: 0 }}
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  >
                    {showConfirm ? '🙈' : '👁'}
                  </button>
                </div>
              </label>

              {/* Password match hint */}
              {pwForm.newPassword && pwForm.confirmPassword && pwForm.newPassword !== pwForm.confirmPassword && (
                <p style={{ color: '#ef4444', fontSize: 12, margin: '-8px 0 12px' }}>Passwords do not match.</p>
              )}

              <div className="btn-group">
                <button type="button" className="btn btn--secondary" onClick={handleCancelPassword}>Cancel</button>
                <button type="submit" className="btn btn--primary" disabled={savingPw}>
                  {savingPw ? 'Saving…' : 'Change Password'}
                </button>
              </div>
            </form>
          )}
        </div>

      </div>
    </div>
  )
}
