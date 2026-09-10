import { useEffect, useState, useCallback } from 'react'
import PageHeader from '../components/common/PageHeader'
import api from '../services/api'
import { useToast } from '../context/ToastContext'
import { TTN_FREQUENCY_PLANS } from '../utils/constants'
import './VendorManagement.css'

const TTN_BROKERS = [
  { value: 'eu1.cloud.thethings.network', label: 'EU1 — Europe' },
  { value: 'nam1.cloud.thethings.network', label: 'NAM1 — North America' },
  { value: 'au1.cloud.thethings.network', label: 'AU1 — Australia' },
]

const EMPTY_VENDOR = {
  name: '', address: '', timezone: 'UTC',
  subscriptionPlanId: '', vendorStatus: 'active',
  adminEmail: '', adminName: '', adminPassword: '',
}

const EMPTY_TTN = {
  ttnAppId: '', ttnApiKey: '', ttnGatewayApiKey: '',
  ttnApiBaseUrl: '', ttnMqttBroker: 'eu1.cloud.thethings.network',
  ttnMqttUsername: '', ttnMqttPassword: '', ttnMqttTopic: '',
  ttnFrequencyPlanId: 'EU_863_870_TTN',
  ttnGatewayOwnerType: 'user', ttnGatewayOwnerId: '',
  lnsAddress: '', lnsKey: '', cupsAddress: '', cupsKey: '',
  integrationEnabled: false,
}

const STATUS_COLORS = { active: '#10b981', inactive: '#f59e0b', suspended: '#ef4444' }
const CONN_COLORS = { connected: '#10b981', disconnected: '#f59e0b', disabled: '#94a3b8', error: '#ef4444' }

function Pill({ label, color }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
      background: color + '18', color,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
      {label}
    </span>
  )
}

function UsageBar({ used, limit, label }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0
  const color = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#10b981'
  return (
    <div className="vm-usage-row">
      <div className="vm-usage-meta">
        <span>{label}</span>
        <span style={{ color: limit && used >= limit ? '#ef4444' : 'inherit', fontWeight: 600 }}>
          {used}{limit ? ` / ${limit}` : ''}
        </span>
      </div>
      {limit > 0 && (
        <div className="vm-usage-track">
          <div className="vm-usage-fill" style={{ width: `${pct}%`, background: color }} />
        </div>
      )}
    </div>
  )
}

function SectionHeader({ icon, title, subtitle }) {
  return (
    <div className="vm-section-header">
      <span className="vm-section-icon">{icon}</span>
      <div>
        <div className="vm-section-title">{title}</div>
        {subtitle && <div className="vm-section-sub">{subtitle}</div>}
      </div>
    </div>
  )
}

export default function VendorManagement() {
  const toast = useToast()
  const [vendors, setVendors] = useState([])
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_VENDOR)
  const [formSaving, setFormSaving] = useState(false)

  const [ttnVendor, setTtnVendor] = useState(null)
  const [ttnForm, setTtnForm] = useState(EMPTY_TTN)
  const [ttnTab, setTtnTab] = useState('mqtt')
  const [ttnSaving, setTtnSaving] = useState(false)
  const [ttnTesting, setTtnTesting] = useState(false)
  const [ttnRegenerating, setTtnRegenerating] = useState(false)
  const [ttnTestResult, setTtnTestResult] = useState(null)

  const [detailVendor, setDetailVendor] = useState(null)
  const [usage, setUsage] = useState(null)
  const [integStatus, setIntegStatus] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [vr, pr] = await Promise.all([
        api.get('/api/vendors'),
        api.get('/api/subscription-plans?activeOnly=true'),
      ])
      setVendors(vr.vendors || [])
      setPlans(pr.plans || [])
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }, [toast])

  useEffect(() => { load() }, [load])

  const visible = vendors.filter(v => {
    if (filterStatus && v.vendorStatus !== filterStatus) return false
    if (search && !v.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // ── Vendor form ────────────────────────────────────────────────────────────
  function openCreate() { setEditing(null); setForm(EMPTY_VENDOR); setShowForm(true) }
  function openEdit(v) {
    setEditing(v)
    setForm({ name: v.name, address: v.address || '', timezone: v.timezone || 'UTC', subscriptionPlanId: v.subscriptionPlanId || '', vendorStatus: v.vendorStatus, adminEmail: '', adminName: '', adminPassword: '' })
    setShowForm(true)
  }

  async function saveVendor(e) {
    e.preventDefault(); setFormSaving(true)
    try {
      if (editing) {
        await api.put(`/api/vendors/${editing.id}`, form)
        toast.success('Vendor updated')
      } else {
        const result = await api.post('/api/vendors', form)
        if (result.ttn?.success) {
          toast.success(`Vendor created — TTN app "${result.ttn.ttnAppId}" auto-created ✓`)
        } else {
          toast.warning(`Vendor created. TTN auto-create failed: ${result.ttn?.error || 'unknown'}. Configure manually via ⚙ TTN.`)
        }
      }
      setShowForm(false); load()
    } catch (err) { toast.error(err.message) }
    finally { setFormSaving(false) }
  }

  async function suspendVendor(v) {
    if (!confirm(`Suspend "${v.name}"? Their integration will be disconnected.`)) return
    try { await api.delete(`/api/vendors/${v.id}`); toast.success('Vendor suspended'); load() }
    catch (err) { toast.error(err.message) }
  }

  // ── TTN panel ──────────────────────────────────────────────────────────────
  async function openTTN(v) {
    setTtnVendor(v); setTtnTab('mqtt'); setTtnTestResult(null)
    // Seed the form with env-var defaults so a fresh vendor gets working creds
    setTtnForm(EMPTY_TTN)
    try {
      const r = await api.get(`/api/vendors/${v.id}/ttn-config`)
      const c = r.ttnConfig || {}
      setTtnForm({
        ttnAppId: c.ttnAppId || '',
        // Masked secrets (••••) come back from the API — keep them blank so the
        // user knows they need to re-enter; the backend only updates fields that
        // are non-empty strings (undefined = leave unchanged)
        ttnApiKey: '',
        ttnGatewayApiKey: '',
        ttnApiBaseUrl: c.ttnApiBaseUrl || '',
        ttnMqttBroker: c.ttnMqttBroker || 'eu1.cloud.thethings.network',
        ttnMqttUsername: c.ttnMqttUsername || '',
        ttnMqttPassword: '',   // always blank — user must re-enter to change
        ttnMqttTopic: c.ttnMqttTopic || '',
        ttnFrequencyPlanId: c.ttnFrequencyPlanId || 'EU_863_870_TTN',
        ttnGatewayOwnerType: c.ttnGatewayOwnerType || 'user',
        ttnGatewayOwnerId: c.ttnGatewayOwnerId || '',
        lnsAddress: c.lnsAddress || '',
        lnsKey: '',
        cupsAddress: c.cupsAddress || '',
        cupsKey: '',
        integrationEnabled: c.integrationEnabled ?? false,
      })
    } catch { setTtnForm(EMPTY_TTN) }
  }

  async function saveTTN(e) {
    e.preventDefault(); setTtnSaving(true)
    // Only send secret fields if the user actually typed something
    // (blank = "keep existing value in DB")
    const payload = { ...ttnForm }
    if (!payload.ttnApiKey)        delete payload.ttnApiKey
    if (!payload.ttnGatewayApiKey) delete payload.ttnGatewayApiKey
    if (!payload.ttnMqttPassword)  delete payload.ttnMqttPassword
    if (!payload.lnsKey)           delete payload.lnsKey
    if (!payload.cupsKey)          delete payload.cupsKey
    try {
      await api.put(`/api/vendors/${ttnVendor.id}/ttn-config`, payload)
      toast.success('TTN configuration saved'); load()
    } catch (err) { toast.error(err.message) }
    finally { setTtnSaving(false) }
  }

  async function testTTN() {
    setTtnTesting(true); setTtnTestResult(null)
    try {
      // Use vendor's saved config for testing — no need to re-enter password
      await api.post(`/api/vendors/${ttnVendor.id}/test-ttn-connection`)
      setTtnTestResult({ ok: true, msg: 'Connection successful' })
    } catch (err) { setTtnTestResult({ ok: false, msg: err.message || 'Connection failed' }) }
    finally { setTtnTesting(false) }
  }

  async function regenerateApiKey() {
    if (!window.confirm(`Regenerate the TTN API key for "${ttnVendor.name}"?\n\nThis will create a new key with the correct rights (including simulate support), save it automatically, and reload the MQTT connection. The old key will remain in TTN but is no longer used.`)) return
    setTtnRegenerating(true); setTtnTestResult(null)
    try {
      await api.post(`/api/vendors/${ttnVendor.id}/regenerate-api-key`)
      setTtnTestResult({ ok: true, msg: 'API key regenerated — MQTT reconnected ✓' })
      load()
    } catch (err) { setTtnTestResult({ ok: false, msg: err.message || 'Regeneration failed' }) }
    finally { setTtnRegenerating(false) }
  }

  async function toggleIntegration(v, enabled) {
    try {
      await api.put(`/api/vendors/${v.id}/ttn-config`, { integrationEnabled: enabled })
      toast.success(`Integration ${enabled ? 'enabled' : 'disabled'}`); load()
    } catch (err) { toast.error(err.message) }
  }

  // ── Detail panel ──────────────────────────────────────────────────────────
  async function openDetail(v) {
    setDetailVendor(v); setUsage(null); setIntegStatus(null)
    try {
      const [ur, ir] = await Promise.all([
        api.get(`/api/vendors/${v.id}/resource-usage`),
        api.get(`/api/vendors/${v.id}/integration-status`),
      ])
      setUsage(ur.usage); setIntegStatus(ir.status)
    } catch {}
  }

  const f = (key, val) => setTtnForm(p => ({ ...p, [key]: val }))

  return (
    <div className="page-content">
      <PageHeader
        title="Vendor Management"
        subtitle="Provision vendors, assign subscription plans, and configure TTN/MQTT integrations"
        action={<button className="btn btn--primary" data-tour="vendor-add-btn" onClick={openCreate}>+ New Vendor</button>}
      />

      {/* ── Filters ── */}
      <div className="vm-filters" data-tour="vendor-filters">
        <input className="search-input" placeholder="Search vendors…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="suspended">Suspended</option>
        </select>
        <button className="btn btn--secondary" onClick={load}>↺ Refresh</button>
        <span className="vm-count">{visible.length} vendor{visible.length !== 1 ? 's' : ''}</span>
      </div>

      {/* ── Stats row ── */}
      {!loading && (
        <div className="vm-stats" data-tour="vendor-stats">
          {[
            { label: 'Total', val: vendors.length, color: '#6366f1' },
            { label: 'Active', val: vendors.filter(v => v.vendorStatus === 'active').length, color: '#10b981' },
            { label: 'Inactive', val: vendors.filter(v => v.vendorStatus === 'inactive').length, color: '#f59e0b' },
            { label: 'Suspended', val: vendors.filter(v => v.vendorStatus === 'suspended').length, color: '#ef4444' },
            { label: 'Integrated', val: vendors.filter(v => v.vendorTTNConfig?.integrationEnabled).length, color: '#0ea5e9' },
          ].map(s => (
            <div key={s.label} className="vm-stat-card" style={{ borderTopColor: s.color }}>
              <div className="vm-stat-val" style={{ color: s.color }}>{s.val}</div>
              <div className="vm-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Table ── */}
      {loading ? (
        <div className="loading-state"><div className="spinner" />Loading vendors…</div>
      ) : visible.length === 0 ? (
        <div className="empty-state"><p>No vendors found. Create one to get started.</p></div>
      ) : (
        <div className="vm-table-wrap" data-tour="vendor-table">
          <table className="vm-table">
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Status</th>
                <th>Subscription Plan</th>
                <th>Resources</th>
                <th>TTN Integration</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(v => {
                const cfg = v.vendorTTNConfig
                const connColor = cfg?.integrationEnabled ? CONN_COLORS.connected : CONN_COLORS.disabled
                return (
                  <tr key={v.id}>
                    <td>
                      <div className="vm-vendor-name">{v.name}</div>
                      {v.address && <div className="vm-vendor-addr">{v.address}</div>}
                    </td>
                    <td><Pill label={v.vendorStatus} color={STATUS_COLORS[v.vendorStatus] || '#94a3b8'} /></td>
                    <td>
                      {v.subscriptionPlan
                        ? <span className="vm-plan-badge">{v.subscriptionPlan.name}</span>
                        : <span className="vm-no-plan">— unassigned —</span>
                      }
                    </td>
                    <td className="vm-resources">
                      <span title="Users">👤 {v._count?.users ?? 0}</span>
                      <span title="Devices">📡 {v._count?.devices ?? 0}</span>
                      <span title="Sites">🏢 {v._count?.locations ?? 0}</span>
                    </td>
                    <td>
                      {cfg ? (
                        <div className="vm-ttn-cell">
                          <span className="vm-ttn-dot" style={{ background: connColor }} />
                          <span className="vm-ttn-appid">{cfg.ttnAppId || '(configured)'}</span>
                          <button
                            className={`vm-toggle-btn ${cfg.integrationEnabled ? 'vm-toggle-btn--on' : ''}`}
                            onClick={() => toggleIntegration(v, !cfg.integrationEnabled)}
                            title={cfg.integrationEnabled ? 'Disable integration' : 'Enable integration'}
                          >
                            {cfg.integrationEnabled ? 'ON' : 'OFF'}
                          </button>
                        </div>
                      ) : (
                        <span className="vm-not-configured">Not configured</span>
                      )}
                    </td>
                    <td>
                      <div className="vm-actions">
                        <button className="vm-btn vm-btn--detail" onClick={() => openDetail(v)} title="View details">Details</button>
                        <button className="vm-btn vm-btn--edit" onClick={() => openEdit(v)} title="Edit vendor">Edit</button>
                        <button className="vm-btn vm-btn--ttn" onClick={() => openTTN(v)} title="Configure TTN/MQTT">⚙ TTN</button>
                        {v.vendorStatus !== 'suspended' && (
                          <button className="vm-btn vm-btn--danger" onClick={() => suspendVendor(v)} title="Suspend vendor">Suspend</button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ══════════════ VENDOR FORM MODAL ══════════════ */}
      {showForm && (
        <div className="vm-overlay" onClick={() => setShowForm(false)}>
          <div className="vm-modal" onClick={e => e.stopPropagation()}>
            <div className="vm-modal-header">
              <div className="vm-modal-title">
                <span className="vm-modal-icon">🏢</span>
                {editing ? 'Edit Vendor' : 'Create Vendor'}
              </div>
              <button className="vm-modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={saveVendor} className="vm-modal-body">
              <div className="vm-form-grid">
                <div className="vm-field vm-field--full">
                  <label className="vm-label">Vendor Name <span className="vm-req">*</span></label>
                  <input className="vm-input" required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. CleanSpace Operations Ltd" />
                </div>
                <div className="vm-field vm-field--full">
                  <label className="vm-label">Address</label>
                  <input className="vm-input" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="Street, City, Country" />
                </div>
                <div className="vm-field">
                  <label className="vm-label">Timezone</label>
                  <input className="vm-input" value={form.timezone} onChange={e => setForm(p => ({ ...p, timezone: e.target.value }))} placeholder="UTC" />
                </div>
                <div className="vm-field">
                  <label className="vm-label">Subscription Plan</label>
                  <select className="vm-input" value={form.subscriptionPlanId} onChange={e => setForm(p => ({ ...p, subscriptionPlanId: e.target.value }))}>
                    <option value="">— None —</option>
                    {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="vm-field">
                  <label className="vm-label">Vendor Status</label>
                  <select className="vm-input" value={form.vendorStatus} onChange={e => setForm(p => ({ ...p, vendorStatus: e.target.value }))}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>

              {!editing && (
                <div className="vm-admin-section">
                  <div className="vm-admin-label">Initial Vendor Admin Account <span className="vm-optional">(optional)</span></div>
                  <div className="vm-form-grid">
                    <div className="vm-field">
                      <label className="vm-label">Admin Name</label>
                      <input className="vm-input" value={form.adminName} onChange={e => setForm(p => ({ ...p, adminName: e.target.value }))} placeholder="Full name" />
                    </div>
                    <div className="vm-field">
                      <label className="vm-label">Admin Email</label>
                      <input className="vm-input" type="email" value={form.adminEmail} onChange={e => setForm(p => ({ ...p, adminEmail: e.target.value }))} placeholder="admin@vendor.com" />
                    </div>
                    <div className="vm-field vm-field--full">
                      <label className="vm-label">Admin Password</label>
                      <input className="vm-input" type="password" value={form.adminPassword} onChange={e => setForm(p => ({ ...p, adminPassword: e.target.value }))} placeholder="Min 8 characters" autoComplete="new-password" />
                    </div>
                  </div>
                </div>
              )}

              <div className="vm-modal-footer">
                <button type="button" className="vm-btn vm-btn--cancel" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="vm-btn vm-btn--primary" disabled={formSaving}>{formSaving ? 'Saving…' : editing ? 'Update Vendor' : 'Create Vendor'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════ TTN CONFIG MODAL ══════════════ */}
      {ttnVendor && (
        <div className="vm-overlay" onClick={() => setTtnVendor(null)}>
          <div className="vm-modal vm-modal--wide" onClick={e => e.stopPropagation()}>
            <div className="vm-modal-header">
              <div className="vm-modal-title">
                <span className="vm-modal-icon">📡</span>
                TTN / MQTT Configuration
                <span className="vm-modal-vendor-badge">{ttnVendor.name}</span>
              </div>
              <button className="vm-modal-close" onClick={() => setTtnVendor(null)}>✕</button>
            </div>

            <div className="vm-ttn-notice">
              🔒 This configuration is managed exclusively by Super Admin. Vendor Admins cannot view or modify these credentials.
            </div>

            {/* Tab bar */}
            <div className="vm-tabs">
              {[
                { id: 'mqtt',    label: '🌐 MQTT Broker' },
                { id: 'app',     label: '🔑 Application' },
              ].map(t => (
                <button key={t.id} className={`vm-tab ${ttnTab === t.id ? 'vm-tab--active' : ''}`} onClick={() => setTtnTab(t.id)}>
                  {t.label}
                </button>
              ))}
            </div>

            <form onSubmit={saveTTN} className="vm-modal-body">

              {/* ── MQTT Tab ── */}
              {ttnTab === 'mqtt' && (
                <div className="vm-form-grid">
                  <div className="vm-field vm-field--full">
                    <label className="vm-label">MQTT Broker Cluster <span className="vm-req">*</span></label>
                    <select className="vm-input" value={ttnForm.ttnMqttBroker} onChange={e => f('ttnMqttBroker', e.target.value)}>
                      {TTN_BROKERS.map(b => <option key={b.value} value={b.value}>{b.label} — {b.value}</option>)}
                      <option value="custom">Custom cluster…</option>
                    </select>
                    {ttnForm.ttnMqttBroker === 'custom' && (
                      <input className="vm-input" style={{ marginTop: 6 }} placeholder="broker.example.com"
                        onChange={e => f('ttnMqttBroker', e.target.value)} />
                    )}
                  </div>

                  {/* ── Auto-generated: read-only ── */}
                  <div className="vm-field">
                    <label className="vm-label">
                      MQTT Username
                      <span className="vm-auto-badge">Auto-generated</span>
                    </label>
                    <div className="vm-input vm-input--readonly">
                      {ttnForm.ttnMqttUsername || <span style={{color:'#4a6070'}}>Will be set on vendor create</span>}
                    </div>
                    <p className="vm-hint">Format: <code>appId@ttn</code> — set automatically</p>
                  </div>

                  <div className="vm-field">
                    <label className="vm-label">
                      MQTT Password (API Key)
                      <span className="vm-auto-badge">Auto-generated</span>
                    </label>
                    <div className="vm-input vm-input--readonly" style={{display:'flex',alignItems:'center',gap:8}}>
                      <span style={{color:'#10b981',fontWeight:700}}>✓ Saved securely</span>
                      <span style={{color:'#4a6070',fontSize:11}}>— not shown for security</span>
                    </div>
                    <p className="vm-hint">Generated when vendor was created. To rotate: delete and recreate vendor.</p>
                  </div>

                  <div className="vm-field vm-field--full">
                    <label className="vm-label">
                      MQTT Topic
                      <span className="vm-auto-badge">Auto-generated</span>
                    </label>
                    <div className="vm-input vm-input--readonly">
                      {ttnForm.ttnMqttTopic || <span style={{color:'#4a6070'}}>Will be set on vendor create</span>}
                    </div>
                    <p className="vm-hint">Auto-derived from Application ID</p>
                  </div>

                  <div className="vm-field vm-field--full">
                    <label className="vm-label">Default Frequency Plan</label>
                    <select className="vm-input" value={ttnForm.ttnFrequencyPlanId} onChange={e => f('ttnFrequencyPlanId', e.target.value)}>
                      <option value="">— Select frequency plan —</option>
                      {TTN_FREQUENCY_PLANS.map(p => (
                        <option key={p.id} value={p.id}>{p.label} ({p.id})</option>
                      ))}
                    </select>
                    <p className="vm-hint">Applied when registering gateways and devices for this vendor</p>
                  </div>

                  <div className="vm-field vm-field--full">
                    <div className="vm-toggle-row">
                      <div>
                        <div className="vm-toggle-label">Enable Integration</div>
                        <div className="vm-toggle-sub">Activates the MQTT connection for live uplink processing</div>
                      </div>
                      <button
                        type="button"
                        className={`vm-switch ${ttnForm.integrationEnabled ? 'vm-switch--on' : ''}`}
                        onClick={() => f('integrationEnabled', !ttnForm.integrationEnabled)}
                        aria-pressed={ttnForm.integrationEnabled}
                      >
                        <span className="vm-switch-thumb" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Application Tab ── */}
              {ttnTab === 'app' && (
                <div className="vm-form-grid">
                  <div className="vm-field">
                    <label className="vm-label">
                      TTN Application ID
                      <span className="vm-auto-badge">Auto-generated</span>
                    </label>
                    <div className="vm-input vm-input--readonly">
                      {ttnForm.ttnAppId || <span style={{color:'#4a6070'}}>Will be set on vendor create</span>}
                    </div>
                    <p className="vm-hint">Created automatically in TTN Console when vendor was provisioned</p>
                  </div>
                  <div className="vm-field">
                    <label className="vm-label">
                      TTN API Base URL
                      <span className="vm-auto-badge">Auto-generated</span>
                    </label>
                    <div className="vm-input vm-input--readonly">
                      {ttnForm.ttnApiBaseUrl || <span style={{color:'#4a6070'}}>https://eu1.cloud.thethings.network</span>}
                    </div>
                    <p className="vm-hint">Cluster endpoint used for device registration</p>
                  </div>
                  <div className="vm-field vm-field--full">
                    <label className="vm-label">
                      Application API Key
                      <span className="vm-auto-badge">Auto-generated</span>
                    </label>
                    <div className="vm-input vm-input--readonly" style={{display:'flex',alignItems:'center',gap:8}}>
                      <span style={{color:'#10b981',fontWeight:700}}>✓ Saved securely</span>
                      <span style={{color:'#4a6070',fontSize:11}}>— generated at vendor creation</span>
                    </div>
                    <p className="vm-hint">Used for device registration via TTN API. Generated automatically.</p>
                  </div>
                </div>
              )}

              {/* ── Gateway Tab ── */}

              <div className="vm-modal-footer vm-modal-footer--spaced">
                <div className="vm-test-row">
                  <button type="button" className="vm-btn vm-btn--test" onClick={testTTN}
                    disabled={ttnTesting || !ttnForm.ttnMqttBroker || !ttnForm.ttnMqttUsername}>
                    {ttnTesting ? <><span className="vm-spinner" />Testing…</> : '⚡ Test Connection'}
                  </button>
                  <button type="button" className="vm-btn vm-btn--secondary" onClick={regenerateApiKey}
                    disabled={ttnRegenerating}
                    title="Create a new TTN API key with all required rights (including simulate) and reload MQTT">
                    {ttnRegenerating ? <><span className="vm-spinner" />Regenerating…</> : '🔑 Regenerate API Key'}
                  </button>
                  {ttnTestResult && (
                    <span className={`vm-test-result ${ttnTestResult.ok ? 'vm-test-result--ok' : 'vm-test-result--fail'}`}>
                      {ttnTestResult.ok ? '✓' : '✗'} {ttnTestResult.msg}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="button" className="vm-btn vm-btn--cancel" onClick={() => setTtnVendor(null)}>Cancel</button>
                  <button type="submit" className="vm-btn vm-btn--primary" disabled={ttnSaving}>{ttnSaving ? 'Saving…' : '💾 Save Configuration'}</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════ DETAIL / STATUS PANEL ══════════════ */}
      {detailVendor && (
        <div className="vm-overlay" onClick={() => setDetailVendor(null)}>
          <div className="vm-modal" onClick={e => e.stopPropagation()}>
            <div className="vm-modal-header">
              <div className="vm-modal-title">
                <span className="vm-modal-icon">📊</span>
                {detailVendor.name}
              </div>
              <button className="vm-modal-close" onClick={() => setDetailVendor(null)}>✕</button>
            </div>
            <div className="vm-modal-body">

              <SectionHeader icon="📡" title="Integration Status" />
              {integStatus ? (
                <div className="vm-status-grid">
                  {[
                    { label: 'TTN Application', val: integStatus.ttnAppId || '—' },
                    { label: 'MQTT Broker',     val: integStatus.mqttBroker || '—' },
                    { label: 'MQTT Username',   val: integStatus.mqttUsername || '—' },
                    { label: 'Subscription',    val: integStatus.subscriptionPlan?.name || '—' },
                  ].map(({ label, val }) => (
                    <div key={label} className="vm-status-row">
                      <span className="vm-status-label">{label}</span>
                      <span className="vm-status-val">{val}</span>
                    </div>
                  ))}
                  <div className="vm-status-row">
                    <span className="vm-status-label">Integration</span>
                    <Pill
                      label={integStatus.integrationEnabled ? 'Enabled' : 'Disabled'}
                      color={integStatus.integrationEnabled ? '#10b981' : '#94a3b8'}
                    />
                  </div>
                  <div className="vm-status-row">
                    <span className="vm-status-label">Connection</span>
                    <Pill
                      label={integStatus.connectionStatus || 'unknown'}
                      color={CONN_COLORS[integStatus.connectionStatus] || '#94a3b8'}
                    />
                  </div>
                  {integStatus.lastStatusAt && (
                    <div className="vm-status-row">
                      <span className="vm-status-label">Last Updated</span>
                      <span className="vm-status-val">{new Date(integStatus.lastStatusAt).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              ) : <div className="vm-loading-inline"><div className="spinner" /></div>}

              <SectionHeader icon="📈" title="Resource Usage" subtitle="Usage against subscription plan limits" />
              {usage ? (
                <div className="vm-usage-list">
                  <UsageBar used={usage.sites?.used} limit={usage.sites?.limit} label="Sites" />
                  <UsageBar used={usage.gateways?.used} limit={usage.gateways?.limit} label="Gateways" />
                  <UsageBar used={usage.devices?.used} limit={usage.devices?.limit} label="Devices" />
                  <UsageBar used={usage.users?.used} limit={usage.users?.limit} label="Users" />
                  {usage.features?.length > 0 && (
                    <div className="vm-features">
                      <div className="vm-features-label">Enabled Features</div>
                      <div className="vm-feature-chips">
                        {usage.features.map(f => <span key={f} className="vm-chip">{f}</span>)}
                      </div>
                    </div>
                  )}
                </div>
              ) : <div className="vm-loading-inline"><div className="spinner" /></div>}

              <div className="vm-modal-footer">
                <button className="vm-btn vm-btn--cancel" onClick={() => setDetailVendor(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


