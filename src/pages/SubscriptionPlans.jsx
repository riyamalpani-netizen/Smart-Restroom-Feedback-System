import { useEffect, useState, useCallback } from 'react'
import PageHeader from '../components/common/PageHeader'
import api from '../services/api'
import { useToast } from '../context/ToastContext'
import './VendorManagement.css'

const EMPTY_PLAN = {
  name: '', description: '',
  maxSites: 1, maxGateways: 5, maxDevices: 20, maxUsers: 10,
  features: '', isActive: true,
}

const FEATURE_SUGGESTIONS = [
  'reports', 'live-feedback', 'audit-history', 'notifications',
  'disaster-management', 'site-config', 'api-access',
]

function parsedFeatures(p) {
  try { return JSON.parse(p.features || '[]') } catch { return [] }
}

export default function SubscriptionPlans() {
  const toast = useToast()
  const [plans,   setPlans]   = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm,setShowForm]= useState(false)
  const [editing, setEditing] = useState(null)
  const [form,    setForm]    = useState(EMPTY_PLAN)
  const [saving,  setSaving]  = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get('/api/subscription-plans')
      setPlans(r.plans || [])
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }, [toast])

  useEffect(() => { load() }, [load])

  function openCreate() { setEditing(null); setForm(EMPTY_PLAN); setShowForm(true) }

  function openEdit(p) {
    setEditing(p)
    let featStr = ''
    try { featStr = JSON.parse(p.features || '[]').join(', ') } catch {}
    setForm({
      name: p.name, description: p.description || '',
      maxSites: p.maxSites, maxGateways: p.maxGateways,
      maxDevices: p.maxDevices, maxUsers: p.maxUsers,
      features: featStr, isActive: p.isActive,
    })
    setShowForm(true)
  }

  async function save() {
    if (!form.name.trim()) { toast.error('Plan name is required'); return }
    setSaving(true)
    const payload = {
      ...form,
      features: form.features ? form.features.split(',').map(s => s.trim()).filter(Boolean) : [],
    }
    try {
      editing
        ? await api.put(`/api/subscription-plans/${editing.id}`, payload)
        : await api.post('/api/subscription-plans', payload)
      toast.success(editing ? 'Plan updated' : 'Plan created')
      setShowForm(false); load()
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  async function deletePlan(p) {
    if (!confirm(`Delete plan "${p.name}"?`)) return
    try { await api.delete(`/api/subscription-plans/${p.id}`); toast.success('Plan deleted'); load() }
    catch (err) { toast.error(err.message) }
  }

  async function toggleActive(p) {
    try {
      await api.put(`/api/subscription-plans/${p.id}`, { isActive: !p.isActive })
      toast.success(`Plan ${p.isActive ? 'deactivated' : 'activated'}`)
      load()
    } catch (err) { toast.error(err.message) }
  }

  return (
    <div className="page-content">
      <PageHeader
        title="Subscription Plans"
        subtitle="Define resource limits and feature access for each vendor tier"
        action={<button className="btn btn--primary" data-tour="plans-add-btn" onClick={openCreate}>+ New Plan</button>}
      />

      {loading ? (
        <div className="loading-state"><div className="spinner" />Loading plans…</div>
      ) : plans.length === 0 ? (
        <div className="empty-state">
          <p>No subscription plans yet.</p>
          <p style={{ fontSize: 13, color: '#8ba3ad', marginTop: 6 }}>Create a plan to assign resource limits to vendors.</p>
        </div>
      ) : (
        <div data-tour="plans-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {plans.map(p => {
            const features = parsedFeatures(p)
            return (
              <div key={p.id} style={{
                background: 'var(--surface, #162329)',
                border: '1px solid var(--border, rgba(255,255,255,0.08))',
                borderTop: `3px solid ${p.isActive ? 'var(--primary,#0891b2)' : '#334155'}`,
                borderRadius: 10, padding: '14px 16px',
                opacity: p.isActive ? 1 : 0.6,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#e8f0f2' }}>{p.name}</div>
                    {p.description && <div style={{ fontSize: 12, color: '#8ba3ad', marginTop: 2 }}>{p.description}</div>}
                  </div>
                  <span style={{
                    fontSize: 11, padding: '2px 9px', borderRadius: 10, fontWeight: 700,
                    background: p.isActive ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)',
                    color: p.isActive ? '#10b981' : '#64748b',
                  }}>
                    {p.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
                  {[['Sites', p.maxSites], ['Gateways', p.maxGateways], ['Devices', p.maxDevices], ['Users', p.maxUsers]].map(([label, val]) => (
                    <div key={label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: '7px 10px' }}>
                      <div style={{ fontSize: 10, color: '#8ba3ad', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</div>
                      <div style={{ fontWeight: 800, fontSize: 18, color: '#e8f0f2' }}>{val}</div>
                    </div>
                  ))}
                </div>

                {features.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, color: '#8ba3ad', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>Features</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {features.map(f => (
                        <span key={f} style={{ background: 'rgba(8,145,178,0.15)', color: '#0891b2', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600 }}>{f}</span>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ fontSize: 11, color: '#8ba3ad', marginBottom: 10 }}>
                  {p._count?.organizations ?? 0} vendor(s) assigned
                </div>

                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="vm-btn vm-btn--edit" onClick={() => openEdit(p)}>Edit</button>
                  <button className="vm-btn vm-btn--detail" onClick={() => toggleActive(p)}>
                    {p.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  {(p._count?.organizations ?? 0) === 0 && (
                    <button className="vm-btn vm-btn--danger" onClick={() => deletePlan(p)}>Delete</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Plan Form Modal ── */}
      {showForm && (
        <div className="vm-overlay" onClick={() => setShowForm(false)}>
          <div className="vm-modal" onClick={e => e.stopPropagation()}>
            <div className="vm-modal-header">
              <div className="vm-modal-title">
                <span className="vm-modal-icon">📋</span>
                {editing ? 'Edit Plan' : 'New Subscription Plan'}
              </div>
              <button type="button" className="vm-modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="vm-modal-body">
              <div className="vm-form-grid">
                <div className="vm-field vm-field--full">
                  <label className="vm-label">Plan Name <span className="vm-req">*</span></label>
                  <input className="vm-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Starter, Professional, Enterprise" />
                </div>
                <div className="vm-field vm-field--full">
                  <label className="vm-label">Description</label>
                  <input className="vm-input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Short description" />
                </div>
                {[['Max Sites', 'maxSites'], ['Max Gateways', 'maxGateways'], ['Max Devices', 'maxDevices'], ['Max Users', 'maxUsers']].map(([label, key]) => (
                  <div key={key} className="vm-field">
                    <label className="vm-label">{label}</label>
                    <input className="vm-input" type="number" min={0} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
                  </div>
                ))}
                <div className="vm-field vm-field--full">
                  <label className="vm-label">Features <span className="vm-optional">(comma-separated)</span></label>
                  <input className="vm-input" value={form.features} onChange={e => setForm(f => ({ ...f, features: e.target.value }))} placeholder={FEATURE_SUGGESTIONS.join(', ')} />
                  <p className="vm-hint">Suggestions: {FEATURE_SUGGESTIONS.join(', ')}</p>
                </div>
                <div className="vm-field vm-field--full" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" id="spActive" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
                  <label htmlFor="spActive" style={{ fontSize: 13, cursor: 'pointer', color: '#e8f0f2' }}>Active (available for assignment to vendors)</label>
                </div>
              </div>
              <div className="vm-modal-footer">
                <button type="button" className="vm-btn vm-btn--cancel" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="button" className="vm-btn vm-btn--primary" disabled={saving} onClick={save}>
                  {saving ? 'Saving…' : editing ? 'Update Plan' : 'Create Plan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
