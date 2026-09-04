import { useEffect, useState, useCallback, useRef } from 'react'
import PageHeader from '../components/common/PageHeader'
import SearchBar from '../components/common/SearchBar'
import StatusBadge from '../components/common/StatusBadge'
import Pagination from '../components/common/Pagination'
import BulkUploadModal from '../components/common/BulkUploadModal'
import DetailDrawer from '../components/common/DetailDrawer'
import { formatDateTime } from '../utils/formatters'
import { gatewayAPI, locationAPI, floorAPI, zoneAPI } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../context/ToastContext'
import { TTN_FREQUENCY_PLANS } from '../utils/constants'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'devices', label: 'Connected Devices' },
  { key: 'uplinks', label: 'Uplink Activity' },
  { key: 'events', label: 'Event Logs' },
]

export default function GatewayManagement() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('overview')
  const [gateways, setGateways] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [registerOpen, setRegisterOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [devices, setDevices] = useState([])
  const [uplinks, setUplinks] = useState([])
  const [events, setEvents] = useState([])
  const [locations, setLocations] = useState([])
  const [floors, setFloors] = useState([])
  const [zones, setZones] = useState([])
  const [bulkResult, setBulkResult] = useState(null)
  const [bulkUploading, setBulkUploading] = useState(false)
  const bulkFileRef = useRef(null)
  const canEdit = user?.role !== 'viewer'
  const isSuperAdmin = user?.role === 'super_admin'
  const toast = useToast()
  const [drawerGw, setDrawerGw] = useState(null)

  // Assign to org (super admin)
  const [assignOrgOpen, setAssignOrgOpen] = useState(false)
  const [assignOrgTarget, setAssignOrgTarget] = useState(null)
  const [assignOrgId, setAssignOrgId] = useState('')
  const [organizations, setOrganizations] = useState([])

  function downloadSampleCSV() {
    const lines = [
      'name,gatewayEui,gatewayId,frequencyPlanId',
      'Gateway 01,BB000000000000001,gateway-bb000000000000001,EU_863_870',
      'Gateway 02,BB000000000000002,gateway-bb000000000000002,EU_863_870',
      'Gateway 03,BB000000000000003,gateway-bb000000000000003,EU_863_870',
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'gateways_sample.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  /** Parse RFC 4180 CSV — handles quoted fields containing commas */
  function parseCSV(text) {
    const lines = []
    let cur = ''
    let inQuote = false
    for (let i = 0; i < text.length; i++) {
      const ch = text[i]
      if (ch === '"') {
        if (inQuote && text[i + 1] === '"') { cur += '"'; i++ }
        else inQuote = !inQuote
      } else if ((ch === '\n' || ch === '\r') && !inQuote) {
        if (ch === '\r' && text[i + 1] === '\n') i++
        if (cur.trim()) lines.push(cur)
        cur = ''
      } else {
        cur += ch
      }
    }
    if (cur.trim()) lines.push(cur)
    if (lines.length < 2) return []
    const headers = lines[0].split(',').map((h) => h.trim())
    return lines.slice(1).map((line) => {
      const cols = line.split(',')
      return Object.fromEntries(headers.map((h, i) => [h, (cols[i] ?? '').trim()]))
    })
  }

  const [form, setForm] = useState({ name: '', gatewayId: '', gatewayEui: '', locationId: '', floorId: '', zoneId: '', frequencyPlanId: 'IN_865_867', latitude: '', longitude: '' })
  const [editForm, setEditForm] = useState({ name: '', gatewayId: '', gatewayEui: '', locationId: '', floorId: '', zoneId: '', status: 'offline', frequencyPlanId: 'IN_865_867', latitude: '', longitude: '' })
  const [registerForm, setRegisterForm] = useState({ ttnGatewayId: '', frequencyPlanId: 'IN_865_867', latitude: '', longitude: '', description: '' })

  const loadGateways = useCallback(async () => {
    setLoading(true)
    try {
      const [locData, floorData, zoneData, data] = await Promise.all([
        locationAPI.getAll(),
        floorAPI.getAll(),
        zoneAPI.getAll(),
        gatewayAPI.getAll(),
      ])
      setLocations(locData.locations || [])
      setFloors(floorData.floors || [])
      setZones(zoneData.zones || [])
      setGateways(data.gateways || [])
      setTotalPages(Math.max(1, Math.ceil((data.gateways || []).length / 20)))
    } catch (e) {
      console.error('GatewayManagement load error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadGateways() }, [loadGateways])

  useEffect(() => {
    const timer = setInterval(loadGateways, 30000)
    return () => clearInterval(timer)
  }, [loadGateways])

  const loadOrganizations = useCallback(async () => {
    if (!isSuperAdmin || organizations.length) return
    try {
      const data = await gatewayAPI.getOrganizations ? await gatewayAPI.getOrganizations() : await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/organizations`, { headers: { Authorization: `Bearer ${localStorage.getItem('srfs_token')}` } }).then(r => r.json())
      setOrganizations(data.organizations || [])
    } catch (e) { console.error('Load orgs error:', e) }
  }, [isSuperAdmin, organizations.length])

  const openAssignOrg = (gw) => {
    setAssignOrgTarget(gw)
    setAssignOrgId(gw.organizationId || '')
    setAssignOrgOpen(true)
    loadOrganizations()
  }

  const handleAssignOrg = async (e) => {
    e.preventDefault()
    if (!assignOrgTarget) return
    setSaving(true)
    try {
      const data = await gatewayAPI.update(assignOrgTarget.id, { organizationId: assignOrgId || null })
      setGateways(prev => prev.map(g => g.id === assignOrgTarget.id ? { ...g, ...data.gateway } : g))
      setAssignOrgOpen(false)
      setAssignOrgTarget(null)
      toast.success('Organisation assigned.')
    } catch (e) { toast.error(e.message || 'Failed to assign organisation.') } finally { setSaving(false) }
  }

  const loadDetail = useCallback(async (id) => {
    setLoading(true)
    loadOrganizations()
    try {
      const [detail, devicesData, uplinksData, eventsData] = await Promise.all([
        gatewayAPI.getById(id),
        gatewayAPI.getDevices(id),
        gatewayAPI.getUplinks(id, 50),
        gatewayAPI.getEvents(id, 50),
      ])
      setSelected(detail.gateway)
      setDrawerGw(detail.gateway)
      setDevices(devicesData.devices || [])
      setUplinks(uplinksData.uplinks || [])
      setEvents(eventsData.events || [])
    } catch (e) {
      console.error('Gateway detail error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const data = await gatewayAPI.create({
        name: form.name, gatewayId: form.gatewayId || undefined, gatewayEui: form.gatewayEui,
        locationId: form.locationId || null, floorId: form.floorId || null, zoneId: form.zoneId || null,
        frequencyPlanId: form.frequencyPlanId || null,
        latitude: form.latitude || null, longitude: form.longitude || null,
      })
      setForm({ name: '', gatewayId: '', gatewayEui: '', locationId: '', floorId: '', zoneId: '', frequencyPlanId: 'EU_863_870', latitude: '', longitude: '' })
      setAddOpen(false)
      await loadGateways()
      if (data?.ttnError) {
        toast.warning(`Gateway saved, but TTN registration failed: ${data.ttnError}. You can retry registration from the gateway actions.`)
      } else {
        toast.success('Gateway created and registered in TTN successfully.')
      }
    } catch (e) {
      toast.error(e.message || 'Failed to create gateway.')
    } finally {
      setSaving(false)
    }
  }

  const handleBulkUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    event.target.value = ''   // allow re-selecting the same file

    setBulkUploading(true)
    setBulkResult(null)

    try {
      const text = await file.text()
      const items = parseCSV(text)

      if (items.length === 0) {
        setBulkResult({
          created: 0, skipped: 0,
          errors: [{ row: '—', message: 'The file is empty or contains only a header row.' }],
        })
        return
      }

      // Client-side guard: require gatewayEui column
      const firstRow = items[0]
      if (!('gatewayEui' in firstRow) && !('eui' in firstRow)) {
        setBulkResult({
          created: 0, skipped: 0,
          errors: [{
            row: '—',
            message: 'CSV is missing the required "gatewayEui" column. Download the sample CSV to see the correct format.',
          }],
        })
        return
      }

      const result = await gatewayAPI.bulkCreate(items)
      setBulkResult({
        created: result.created ?? 0,
        skipped: result.skipped ?? 0,
        errors: result.errors || [],
      })
      await loadGateways()
    } catch (err) {
      setBulkResult({
        created: 0, skipped: 0,
        errors: [{ row: '—', message: err.message || 'Upload failed. Check your file and try again.' }],
      })
    } finally {
      setBulkUploading(false)
    }
  }

  const handleEdit = async (e) => {
    e.preventDefault()
    if (!selected) return
    setSaving(true)
    try {
      const data = await gatewayAPI.update(selected.id, {
        name: editForm.name, gatewayId: editForm.gatewayId || undefined, gatewayEui: editForm.gatewayEui,
        locationId: editForm.locationId || null, floorId: editForm.floorId || null, zoneId: editForm.zoneId || null,
        status: editForm.status, frequencyPlanId: editForm.frequencyPlanId || null,
        latitude: editForm.latitude || null, longitude: editForm.longitude || null,
      })
      setSelected((prev) => ({ ...prev, ...data.gateway }))
      setGateways((prev) => prev.map((g) => (g.id === selected.id ? { ...g, ...data.gateway } : g)))
      setEditOpen(false)
      toast.success('Gateway updated.')
    } catch (e) {
      toast.error(e.message || 'Failed to update gateway.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selected) return
    setDeleting(true)
    try {
      const data = await gatewayAPI.delete(selected.id)
      setGateways((prev) => prev.filter((g) => g.id !== selected.id))
      setSelected(null)
      setDeleteOpen(false)
      if (data?.ttnDeleted) {
        toast.success('Gateway deleted from app and TTN.')
      } else {
        toast.warning(`Gateway deleted from app. TTN delete failed: ${data?.ttnDeleteError || 'unknown error'}. Please remove it manually from TTN Console.`)
      }
    } catch (e) {
      toast.error(e.message || 'Failed to delete gateway.')
    } finally {
      setDeleting(false)
    }
  }

  const hasAssignedLocation = (gateway) => Boolean(
    gateway?.locationId || gateway?.floorId || gateway?.zoneId
  )

  const handleUnassignLocation = async (gateway) => {
    if (!window.confirm(`Remove the assigned location from ${gateway.name || gateway.gatewayEui}? The gateway will remain available in Gateway Management.`)) return
    setSaving(true)
    try {
      const data = await gatewayAPI.update(gateway.id, {
        locationId: null,
        floorId: null,
        zoneId: null,
        latitude: null,
        longitude: null,
      })
      const unassigned = {
        ...gateway,
        ...data.gateway,
        site: null,
        floor: null,
        zone: null,
      }
      setGateways((prev) => prev.map((item) => item.id === gateway.id ? unassigned : item))
      setSelected((prev) => prev?.id === gateway.id ? unassigned : prev)
      toast.success('Gateway unplaced.')
    } catch (e) {
      toast.error(e.message || 'Failed to unplace gateway.')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (gw) => {
    const newStatus = gw.status === 'online' ? 'offline' : 'online'
    setSaving(true)
    try {
      const data = await gatewayAPI.update(gw.id, { status: newStatus })
      setGateways((prev) => prev.map((g) => (g.id === gw.id ? { ...g, ...data.gateway } : g)))
      setSelected((prev) => prev?.id === gw.id ? { ...prev, ...data.gateway } : prev)
      toast.success(`Gateway ${newStatus === 'online' ? 'activated' : 'deactivated'}.`)
    } catch (e) {
      toast.error(e.message || 'Failed to update gateway.')
    } finally {
      setSaving(false)
    }
  }

  const handleRegisterTTN = async (e) => {
    e.preventDefault()
    if (!selected) return
    setSaving(true)
    try {
      const data = await gatewayAPI.registerTTN(selected.id, {
        ttnGatewayId: registerForm.ttnGatewayId || undefined,
        frequencyPlanId: registerForm.frequencyPlanId || undefined,
        latitude: registerForm.latitude || undefined,
        longitude: registerForm.longitude || undefined,
        description: registerForm.description || undefined,
      })
      setSelected((prev) => ({ ...prev, ...data.gateway }))
      setGateways((prev) => prev.map((g) => (g.id === selected.id ? { ...g, ...data.gateway } : g)))
      setRegisterOpen(false)
      setRegisterForm({ ttnGatewayId: '', frequencyPlanId: 'EU_863_870', latitude: '', longitude: '', description: '' })
      toast.success(data.message || 'Gateway registered in TTN successfully.')
    } catch (e) {
      toast.error(e.message || 'Failed to register gateway in TTN.')
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (gw) => {
    setSelected(gw)
    setEditForm({
      name: gw.name || '', gatewayId: gw.gatewayId || '', gatewayEui: gw.gatewayEui || '',
      locationId: gw.locationId || '', floorId: gw.floorId || '', zoneId: gw.zoneId || '',
      status: gw.status || 'offline', frequencyPlanId: gw.frequencyPlanId || 'EU_863_870',
      latitude: gw.latitude || '', longitude: gw.longitude || '',
    })
    setEditOpen(true)
  }

  const filtered = gateways.filter((g) => {
    if (!search) return true
    const s = search.toLowerCase()
    return (g.name?.toLowerCase().includes(s) || g.gatewayEui?.toLowerCase().includes(s) || g.site?.toLowerCase().includes(s))
  })

  const pageItems = filtered.slice((page - 1) * 20, page * 20)

  return (
    <div className="page">
      <PageHeader
        action={
          canEdit ? (
            <div className="btn-group">
              {isSuperAdmin && (
                <>
                  <button type="button" className="btn btn--secondary" onClick={downloadSampleCSV}>Download Sample CSV</button>
                  <button type="button" className="btn btn--secondary" onClick={() => bulkFileRef.current?.click()} disabled={bulkUploading}>{bulkUploading ? 'Uploading…' : 'Bulk Upload CSV'}</button>
                  <button type="button" className="btn btn--primary" onClick={() => { setForm({ name: '', gatewayId: '', gatewayEui: '', locationId: '', floorId: '', zoneId: '', frequencyPlanId: 'EU_863_870', latitude: '', longitude: '' }); setAddOpen(true) }}>Add Gateway</button>
                  <input ref={bulkFileRef} hidden type="file" accept=".csv,text/csv" onChange={handleBulkUpload} />
                </>
              )}
            </div>
          ) : null
        }
      />

      <div data-tour="gateway-search">
        <SearchBar value={search} onChange={setSearch} placeholder="Search gateways..." />
      </div>
      <div className="device-layout">
        <div className="card" data-tour="gateway-table">
          {loading ? (
            <div className="loader-wrap"><div className="loader" /></div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>EUI</th>
                    <th>Site</th>
                    <th>Floor</th>
                    <th>Status</th>
                    <th>TTN</th>
                    <th>Devices</th>
                    <th>Last Seen</th>
                    <th></th>
                    {canEdit && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((gw) => (
                    <tr key={gw.id} className={selected?.id === gw.id ? 'data-table__row--selected' : ''}>
                      <td style={{ fontWeight: 600 }}>{gw.name}</td>
                      <td><code style={{ fontSize: 11 }}>{gw.gatewayEui}</code></td>
                      <td>{gw.site || '—'}</td>
                      <td>{gw.floor || '—'}</td>
                      <td><StatusBadge status={gw.status || 'offline'} variant="device" /></td>
                      <td><StatusBadge status={gw.ttnStatus === 'registered' ? 'online' : 'offline'} variant="health" /></td>
                      <td style={{ textAlign: 'center' }}>{gw.connectedDevices ?? 0}</td>
                      <td style={{ whiteSpace: 'nowrap', fontSize: 12, color: 'var(--text-muted)' }}>{gw.lastSeen ? formatDateTime(gw.lastSeen) : '—'}</td>
                      {/* Eye icon — opens detail drawer */}
                      <td onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="btn-icon"
                          title="View details"
                          onClick={() => { setDrawerGw(gw); loadDetail(gw.id) }}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                          </svg>
                        </button>
                      </td>
                      {canEdit && (
                        <td onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'nowrap' }}>
                            {isSuperAdmin && (
                              <>
                                {gw.organizationId && (
                                  <span style={{ padding: '3px 8px', fontSize: 11, background: 'var(--success-bg, #dcfce7)', color: 'var(--success, #16a34a)', borderRadius: 4, fontWeight: 600, whiteSpace: 'nowrap' }}>
                                    ✓ Assigned
                                  </span>
                                )}
                                <button type="button" className="btn btn--sm btn--secondary" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => openAssignOrg(gw)}>
                                  {gw.organizationId ? 'Reassign' : 'Assign Org'}
                                </button>
                              </>
                            )}
                            <button type="button" className={`btn btn--sm ${gw.status === 'online' ? 'btn--secondary' : 'btn--primary'}`} style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => handleToggleActive(gw)} disabled={saving}>
                              {gw.status === 'online' ? 'Deactivate' : 'Activate'}
                            </button>
                            {hasAssignedLocation(gw) && (
                              <button type="button" className="btn btn--sm btn--secondary" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => handleUnassignLocation(gw)}>Unplace</button>
                            )}
                            <button type="button" className="btn btn--sm btn--secondary" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => openEdit(gw)}>Edit</button>
                            {isSuperAdmin && (
                              <button type="button" className="btn btn--sm btn--danger" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => { setSelected(gw); setDeleteOpen(true) }}>Delete</button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                  {pageItems.length === 0 && (
                    <tr><td colSpan={canEdit ? 10 : 9} style={{ textAlign: 'center', color: '#64748b' }}>No gateways found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          <Pagination page={page} totalPages={totalPages} onPageChange={(p) => setPage(p)} />
        </div>

      </div>

      {addOpen && (
        <div className="modal-overlay" onClick={() => setAddOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <h3>Add Gateway</h3>
            <form onSubmit={handleCreate}>
              <label>Gateway Name *<input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required /></label>
              <label>Gateway EUI *<input type="text" value={form.gatewayEui} onChange={(e) => setForm((f) => ({ ...f, gatewayEui: e.target.value }))} placeholder="e.g. 70B3D57ED00001AA" required /></label>
              <label>Gateway ID<input type="text" value={form.gatewayId} onChange={(e) => setForm((f) => ({ ...f, gatewayId: e.target.value }))} placeholder="e.g. my-gateway-1 (optional)" /></label>
              <label>Site<select value={form.locationId} onChange={(e) => setForm((f) => ({ ...f, locationId: e.target.value, floorId: '', zoneId: '' }))}><option value="">Select site</option>{locations.map((loc) => <option key={loc.id} value={loc.id}>{loc.officeName || loc.city}</option>)}</select></label>
              <label>Floor<select value={form.floorId} onChange={(e) => setForm((f) => ({ ...f, floorId: e.target.value, zoneId: '' }))} disabled={!form.locationId}><option value="">Select floor</option>{floors.filter((f) => !form.locationId || f.locationId === form.locationId).map((floor) => <option key={floor.id} value={floor.id}>{floor.floorName}</option>)}</select></label>
              <label>Zone<select value={form.zoneId} onChange={(e) => setForm((f) => ({ ...f, zoneId: e.target.value }))} disabled={!form.floorId}><option value="">Select zone</option>{zones.filter((z) => !form.floorId || z.floorId === form.floorId).map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}</select></label>
              <label>Frequency Plan<select value={form.frequencyPlanId} onChange={(e) => setForm((f) => ({ ...f, frequencyPlanId: e.target.value }))}>{TTN_FREQUENCY_PLANS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
              <label>Latitude<input type="text" value={form.latitude} onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))} /></label>
              <label>Longitude<input type="text" value={form.longitude} onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))} /></label>
              <div className="btn-group">
                <button type="button" className="btn btn--secondary" onClick={() => setAddOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editOpen && (
        <div className="modal-overlay" onClick={() => setEditOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <h3>Edit Gateway</h3>
            <form onSubmit={handleEdit}>
              <label>Gateway Name<input type="text" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} /></label>
              <label>Gateway EUI<input type="text" value={editForm.gatewayEui} onChange={(e) => setEditForm((f) => ({ ...f, gatewayEui: e.target.value }))} /></label>
              <label>Gateway ID<input type="text" value={editForm.gatewayId} onChange={(e) => setEditForm((f) => ({ ...f, gatewayId: e.target.value }))} placeholder="e.g. my-gateway-1 (optional)" /></label>
              <label>Site<select value={editForm.locationId} onChange={(e) => setEditForm((f) => ({ ...f, locationId: e.target.value, floorId: '', zoneId: '' }))}><option value="">Select site</option>{locations.map((loc) => <option key={loc.id} value={loc.id}>{loc.officeName || loc.city}</option>)}</select></label>
              <label>Floor<select value={editForm.floorId} onChange={(e) => setEditForm((f) => ({ ...f, floorId: e.target.value, zoneId: '' }))} disabled={!editForm.locationId}><option value="">Select floor</option>{floors.filter((f) => !editForm.locationId || f.locationId === editForm.locationId).map((floor) => <option key={floor.id} value={floor.id}>{floor.floorName}</option>)}</select></label>
              <label>Zone<select value={editForm.zoneId} onChange={(e) => setEditForm((f) => ({ ...f, zoneId: e.target.value }))} disabled={!editForm.floorId}><option value="">Select zone</option>{zones.filter((z) => !editForm.floorId || z.floorId === editForm.floorId).map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}</select></label>
              <label>Status<select value={editForm.status} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}><option value="online">Online</option><option value="offline">Offline</option><option value="degraded">Degraded</option></select></label>
              <label>Frequency Plan<select value={editForm.frequencyPlanId} onChange={(e) => setEditForm((f) => ({ ...f, frequencyPlanId: e.target.value }))}>{TTN_FREQUENCY_PLANS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
              <label>Latitude<input type="text" value={editForm.latitude} onChange={(e) => setEditForm((f) => ({ ...f, latitude: e.target.value }))} /></label>
              <label>Longitude<input type="text" value={editForm.longitude} onChange={(e) => setEditForm((f) => ({ ...f, longitude: e.target.value }))} /></label>
              <div className="btn-group">
                <button type="button" className="btn btn--secondary" onClick={() => setEditOpen(false)}>Cancel</button>
                {selected && hasAssignedLocation(selected) && (
                  <button type="button" className="btn btn--secondary" disabled={saving} onClick={() => { setEditOpen(false); handleUnassignLocation(selected) }}>Unplace</button>
                )}
                <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {registerOpen && (
        <div className="modal-overlay" onClick={() => setRegisterOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <h3>Register Gateway in TTN</h3>
            <form onSubmit={handleRegisterTTN}>
              <label>TTN Gateway ID<input type="text" value={registerForm.ttnGatewayId} onChange={(e) => setRegisterForm((f) => ({ ...f, ttnGatewayId: e.target.value }))} /></label>
              <label>Frequency Plan<select value={registerForm.frequencyPlanId} onChange={(e) => setRegisterForm((f) => ({ ...f, frequencyPlanId: e.target.value }))}>{TTN_FREQUENCY_PLANS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
              <label>Latitude<input type="text" value={registerForm.latitude} onChange={(e) => setRegisterForm((f) => ({ ...f, latitude: e.target.value }))} /></label>
              <label>Longitude<input type="text" value={registerForm.longitude} onChange={(e) => setRegisterForm((f) => ({ ...f, longitude: e.target.value }))} /></label>
              <label>Description<input type="text" value={registerForm.description} onChange={(e) => setRegisterForm((f) => ({ ...f, description: e.target.value }))} /></label>
              <div className="btn-group">
                <button type="button" className="btn btn--secondary" onClick={() => setRegisterOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Registering...' : 'Register'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteOpen && (
        <div className="modal-overlay" onClick={() => setDeleteOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Gateway</h3>
            <p style={{ color: '#64748b', fontSize: 14, margin: '8px 0 16px' }}>
              Are you sure you want to delete <strong>{selected?.name}</strong>? This will also remove it from the TTN console if it exists there.
            </p>
            <div className="btn-group">
              <button type="button" className="btn btn--secondary" onClick={() => setDeleteOpen(false)}>Cancel</button>
              <button type="button" className="btn btn--danger" disabled={deleting} onClick={handleDelete}>{deleting ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk upload modal (spinner + result) ── */}
      <BulkUploadModal
        uploading={bulkUploading}
        result={bulkResult}
        onClose={() => setBulkResult(null)}
        entityName="Gateway"
      />

      {/* ── Assign to Organisation modal (Super Admin only) ── */}
      {isSuperAdmin && assignOrgOpen && (
        <div className="modal-overlay" onClick={() => setAssignOrgOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <h3>Assign Gateway to Organisation</h3>
            <p style={{ color: '#64748b', fontSize: 13, margin: '4px 0 16px' }}>
              Assign <strong>{assignOrgTarget?.name}</strong> to a vendor organisation.
              The vendor admin will then see it in their portal.
            </p>
            <form onSubmit={handleAssignOrg}>
              <label>
                Organisation
                <select value={assignOrgId} onChange={(e) => setAssignOrgId(e.target.value)} className="select">
                  <option value="">— Unassigned (inventory only) —</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
              </label>
              <div className="btn-group" style={{ marginTop: 16 }}>
                <button type="button" className="btn btn--secondary" onClick={() => setAssignOrgOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Saving…' : 'Assign'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Gateway Detail Drawer ── */}
      <DetailDrawer
        open={!!drawerGw}
        onClose={() => { setDrawerGw(null); setSelected(null) }}
        title={drawerGw?.name || 'Gateway Details'}
        subtitle={drawerGw?.gatewayEui}
      >
        {drawerGw && (
          <>
            <div className="drawer-section">
              <p className="drawer-section__title">Identity</p>
              <div className="drawer-fields">
                <div className="drawer-field"><span className="drawer-field__label">EUI</span><span className="drawer-field__value"><code>{drawerGw.gatewayEui}</code></span></div>
                <div className="drawer-field"><span className="drawer-field__label">TTN Gateway ID</span><span className="drawer-field__value"><code>{drawerGw.gatewayId || '—'}</code></span></div>
                <div className="drawer-field"><span className="drawer-field__label">Frequency Plan</span><span className="drawer-field__value">{drawerGw.frequencyPlanId || '—'}</span></div>
                <div className="drawer-field"><span className="drawer-field__label">Connected Devices</span><span className="drawer-field__value">{drawerGw.connectedDevices ?? 0}</span></div>
              </div>
            </div>
            <div className="drawer-section">
              <p className="drawer-section__title">LNS Credentials</p>
              <div className="drawer-fields">
                <div className="drawer-field" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
                  <span className="drawer-field__label">LNS Server</span>
                  <code style={{ fontSize: 11, wordBreak: 'break-all' }}>wss://eu1.cloud.thethings.network:8887</code>
                </div>
                <div className="drawer-field" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
                  <span className="drawer-field__label">LNS API Key</span>
                  {drawerGw.lnsKey ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
                      <code style={{ fontSize: 11, wordBreak: 'break-all', flex: 1, background: 'var(--surface-2, #f1f5f9)', padding: '4px 6px', borderRadius: 4 }}>
                        {drawerGw.lnsKey}
                      </code>
                      <button
                        type="button"
                        className="btn btn--sm btn--secondary"
                        style={{ flexShrink: 0, padding: '3px 8px', fontSize: 11 }}
                        onClick={() => { navigator.clipboard.writeText(drawerGw.lnsKey); toast.success('LNS key copied to clipboard.') }}
                      >
                        Copy
                      </button>
                    </div>
                  ) : (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      Not generated — register the gateway in TTN first.
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="drawer-section">
              <p className="drawer-section__title">Status</p>
              <div className="drawer-fields">
                <div className="drawer-field"><span className="drawer-field__label">Status</span><span className="drawer-field__value"><StatusBadge status={drawerGw.status || 'offline'} variant="device" /></span></div>
                <div className="drawer-field"><span className="drawer-field__label">TTN</span><span className="drawer-field__value"><StatusBadge status={drawerGw.ttnStatus === 'registered' ? 'online' : 'offline'} variant="health" /></span></div>
                <div className="drawer-field"><span className="drawer-field__label">Assignment</span><span className="drawer-field__value">{hasAssignedLocation(drawerGw) ? 'Placed' : 'Available'}</span></div>
                <div className="drawer-field"><span className="drawer-field__label">Last Seen</span><span className="drawer-field__value" style={{ fontSize: 12 }}>{drawerGw.lastSeen ? formatDateTime(drawerGw.lastSeen) : '—'}</span></div>
                <div className="drawer-field">
                  <span className="drawer-field__label">Vendor</span>
                  <span className="drawer-field__value">
                    {drawerGw.organizationId
                      ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />
                          <span style={{ color: '#16a34a', fontWeight: 600 }}>
                            {organizations.find(o => o.id === drawerGw.organizationId)?.name || 'Assigned'}
                          </span>
                        </span>
                      : <span style={{ color: 'var(--text-muted)' }}>Unassigned</span>
                    }
                  </span>
                </div>
              </div>
            </div>
            <div className="drawer-section">
              <p className="drawer-section__title">Location</p>
              <div className="drawer-fields">
                <div className="drawer-field"><span className="drawer-field__label">Site</span><span className="drawer-field__value">{drawerGw.site || '—'}</span></div>
                <div className="drawer-field"><span className="drawer-field__label">Floor</span><span className="drawer-field__value">{drawerGw.floor || '—'}</span></div>
                <div className="drawer-field"><span className="drawer-field__label">Zone</span><span className="drawer-field__value">{drawerGw.zone || '—'}</span></div>
                <div className="drawer-field"><span className="drawer-field__label">Restroom</span><span className="drawer-field__value">{drawerGw.restroomName || '—'}</span></div>
                <div className="drawer-field"><span className="drawer-field__label">Latitude</span><span className="drawer-field__value">{drawerGw.latitude ?? '—'}</span></div>
                <div className="drawer-field"><span className="drawer-field__label">Longitude</span><span className="drawer-field__value">{drawerGw.longitude ?? '—'}</span></div>
              </div>
            </div>
            {devices.length > 0 && (
              <div className="drawer-section">
                <p className="drawer-section__title">Connected Devices ({devices.length})</p>
                {devices.map((d) => (
                  <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                    <span>{d.name || d.badgeId}</span>
                    <StatusBadge status={d.status || 'offline'} variant="device" />
                  </div>
                ))}
              </div>
            )}
            {canEdit && (
              <div className="drawer-section">
                <p className="drawer-section__title">Actions</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <button type="button" className={`btn btn--sm ${drawerGw.status === 'online' ? 'btn--secondary' : 'btn--primary'}`} onClick={() => handleToggleActive(drawerGw)} disabled={saving}>{drawerGw.status === 'online' ? 'Deactivate' : 'Activate'}</button>
                  {hasAssignedLocation(drawerGw) && <button type="button" className="btn btn--sm btn--secondary" onClick={() => { handleUnassignLocation(drawerGw); setDrawerGw(null) }}>Unplace</button>}
                  <button type="button" className="btn btn--sm btn--secondary" onClick={() => { openEdit(drawerGw); setDrawerGw(null) }}>Edit</button>
                  {isSuperAdmin && <button type="button" className="btn btn--sm btn--danger" onClick={() => { setSelected(drawerGw); setDeleteOpen(true); setDrawerGw(null) }}>Delete</button>}
                </div>
              </div>
            )}
          </>
        )}
      </DetailDrawer>
    </div>
  )
}