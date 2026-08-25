import { useEffect, useState, useCallback, useRef } from 'react'
import PageHeader from '../components/common/PageHeader'
import SearchBar from '../components/common/SearchBar'
import StatusBadge from '../components/common/StatusBadge'
import Pagination from '../components/common/Pagination'
import BulkUploadModal from '../components/common/BulkUploadModal'
import { formatDateTime } from '../utils/formatters'
import { gatewayAPI, locationAPI, floorAPI, zoneAPI } from '../services/api'
import { useAuth } from '../hooks/useAuth'

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

  const [form, setForm] = useState({ name: '', gatewayId: '', gatewayEui: '', locationId: '', floorId: '', zoneId: '', frequencyPlanId: 'EU_863_870', latitude: '', longitude: '' })
  const [editForm, setEditForm] = useState({ name: '', gatewayId: '', gatewayEui: '', locationId: '', floorId: '', zoneId: '', status: 'offline', frequencyPlanId: 'EU_863_870', latitude: '', longitude: '' })
  const [registerForm, setRegisterForm] = useState({ ttnGatewayId: '', frequencyPlanId: 'EU_863_870', latitude: '', longitude: '', description: '' })

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

  const loadDetail = useCallback(async (id) => {
    setLoading(true)
    try {
      const [detail, devicesData, uplinksData, eventsData] = await Promise.all([
        gatewayAPI.getById(id),
        gatewayAPI.getDevices(id),
        gatewayAPI.getUplinks(id, 50),
        gatewayAPI.getEvents(id, 50),
      ])
      setSelected(detail.gateway)
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
      await gatewayAPI.create({
        name: form.name, gatewayId: form.gatewayId || undefined, gatewayEui: form.gatewayEui,
        locationId: form.locationId || null, floorId: form.floorId || null, zoneId: form.zoneId || null,
        frequencyPlanId: form.frequencyPlanId || null,
        latitude: form.latitude || null, longitude: form.longitude || null,
      })
      setForm({ name: '', gatewayId: '', gatewayEui: '', locationId: '', floorId: '', zoneId: '', frequencyPlanId: 'EU_863_870', latitude: '', longitude: '' })
      setAddOpen(false)
      await loadGateways()
    } catch (e) {
      alert(e.message)
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
    } catch (e) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selected) return
    setDeleting(true)
    try {
      await gatewayAPI.delete(selected.id)
      setGateways((prev) => prev.filter((g) => g.id !== selected.id))
      setSelected(null)
      setDeleteOpen(false)
    } catch (e) {
      alert(e.message)
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
    } catch (e) {
      alert(e.message)
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
      alert(data.message || 'Gateway registered in TTN successfully')
    } catch (e) {
      alert(e.message)
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
              <button type="button" className="btn btn--secondary" onClick={downloadSampleCSV}>Download Sample CSV</button>
              <button type="button" className="btn btn--secondary" onClick={() => bulkFileRef.current?.click()} disabled={bulkUploading}>{bulkUploading ? 'Uploading…' : 'Bulk Upload CSV'}</button>
              <button type="button" className="btn btn--primary" onClick={() => { setForm({ name: '', gatewayId: '', gatewayEui: '', locationId: '', floorId: '', zoneId: '', frequencyPlanId: 'EU_863_870', latitude: '', longitude: '' }); setAddOpen(true) }}>Add Gateway</button>
              <input ref={bulkFileRef} hidden type="file" accept=".csv,text/csv" onChange={handleBulkUpload} />
            </div>
          ) : null
        }
      />

      <SearchBar value={search} onChange={setSearch} placeholder="Search gateways..." />

      <div className="device-layout">
        <div className="card">
          {loading ? (
            <div className="loader-wrap"><div className="loader" /></div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Gateway ID / EUI</th>
                    <th>Site</th>
                    <th>Floor</th>
                    <th>Zone</th>
                    <th>Restroom</th>
                    <th>Latitude</th>
                    <th>Longitude</th>
                    <th>Assignment</th>
                    <th>Status</th>
                    <th>TTN Status</th>
                    <th>Connected Devices</th>
                    <th>Last Seen</th>
                    {canEdit && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((gw) => (
                    <tr key={gw.id} className={selected?.id === gw.id ? 'data-table__row--selected' : ''} onClick={() => loadDetail(gw.id)}>
                      <td>{gw.name}</td>
                      <td><code>{gw.gatewayEui}</code></td>
                      <td>{gw.site || '—'}</td>
                      <td>{gw.floor || '—'}</td>
                      <td>{gw.zone || '—'}</td>
                      <td>{gw.restroomName || '—'}</td>
                      <td>{gw.latitude ?? '—'}</td>
                      <td>{gw.longitude ?? '—'}</td>
                      <td>{hasAssignedLocation(gw) ? 'Assigned' : 'Available'}</td>
                      <td><StatusBadge status={gw.status || 'offline'} variant="device" /></td>
                      <td><StatusBadge status={gw.ttnStatus === 'registered' ? 'online' : 'offline'} variant="health" /></td>
                      <td>{gw.connectedDevices ?? 0}</td>
                      <td>{gw.lastSeen ? formatDateTime(gw.lastSeen) : '—'}</td>
                      {canEdit && (
                        <td onClick={(e) => e.stopPropagation()}>
                           <div style={{ display: 'flex', gap: 6 }}>
                             {hasAssignedLocation(gw) && (
                               <button type="button" className="btn btn--secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => handleUnassignLocation(gw)}>Unplace</button>
                             )}
                             <button type="button" className="btn btn--secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => openEdit(gw)}>Edit</button>
                             <button type="button" className="btn btn--danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => { setSelected(gw); setDeleteOpen(true) }}>Delete</button>
                           </div>
                        </td>
                      )}
                    </tr>
                  ))}
                  {pageItems.length === 0 && (
                    <tr><td colSpan={canEdit ? "14" : "13"} style={{ textAlign: 'center', color: '#64748b' }}>No gateways found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          <Pagination page={page} totalPages={totalPages} onPageChange={(p) => setPage(p)} />
        </div>

        {selected && (
          <aside className="card device-detail">
            <h3>Gateway Details</h3>
            <dl>
              <dt>Name</dt><dd>{selected.name || '—'}</dd>
              <dt>Gateway ID / EUI</dt><dd><code>{selected.gatewayEui}</code></dd>
              <dt>TTN Gateway ID</dt><dd><code>{selected.gatewayId || selected.ttnDeviceId || '—'}</code></dd>
              <dt>Status</dt><dd><StatusBadge status={selected.status || 'offline'} variant="device" /></dd>
              <dt>TTN Status</dt><dd><StatusBadge status={selected.ttnStatus === 'registered' ? 'online' : 'offline'} variant="health" /></dd>
              <dt>Site</dt><dd>{selected.site || '—'}</dd>
              <dt>Floor</dt><dd>{selected.floor || '—'}</dd>
              <dt>Zone</dt><dd>{selected.zone || '—'}</dd>
              <dt>Restroom</dt><dd>{selected.restroomName || '—'}</dd>
              <dt>Last Seen</dt><dd>{selected.lastSeen ? formatDateTime(selected.lastSeen) : '—'}</dd>
              <dt>Connected Devices</dt><dd>{selected.connectedDevices ?? 0}</dd>
              <dt>TTN Device ID</dt><dd><code>{selected.ttnDeviceId || '—'}</code></dd>
              <dt>Frequency Plan</dt><dd>{selected.frequencyPlanId || '—'}</dd>
              <dt>Latitude</dt><dd>{selected.latitude ?? '—'}</dd>
              <dt>Longitude</dt><dd>{selected.longitude ?? '—'}</dd>
              <dt>Assignment</dt><dd>{hasAssignedLocation(selected) ? 'Assigned' : 'Available'}</dd>
            </dl>
            <div className="tabs" style={{ marginTop: 16, marginBottom: 12 }}>
              {TABS.map((tab) => (
                <button key={tab.key} type="button" className={`tab ${activeTab === tab.key ? 'tab--active' : ''}`} onClick={() => setActiveTab(tab.key)}>{tab.label}</button>
              ))}
            </div>
            {activeTab === 'overview' && (
              <div>
                <div className="btn-group">
                  {hasAssignedLocation(selected) && (
                    <button type="button" className="btn btn--secondary" onClick={() => handleUnassignLocation(selected)}>Unplace</button>
                  )}
                  <button type="button" className="btn btn--secondary" onClick={() => openEdit(selected)}>Edit</button>
                  <button type="button" className="btn btn--secondary" onClick={() => { setRegisterForm({ ttnGatewayId: '', frequencyPlanId: selected.frequencyPlanId || 'EU_863_870', latitude: selected.latitude || '', longitude: selected.longitude || '', description: selected.name || '' }); setRegisterOpen(true) }}>Register in TTN</button>
                  <button type="button" className="btn btn--danger" onClick={() => setDeleteOpen(true)}>Delete</button>
                </div>
              </div>
            )}
            {activeTab === 'devices' && (
              <div className="table-wrapper" style={{ maxHeight: 300, overflow: 'auto' }}>
                <table className="data-table">
                  <thead><tr><th>Name</th><th>Type</th><th>Restroom</th><th>Battery</th><th>Status</th><th>Health</th><th>Last Seen</th></tr></thead>
                  <tbody>
                    {devices.map((d) => (
                      <tr key={d.id}><td>{d.name || '—'}</td><td>{d.deviceType || 'sensor'}</td><td>{d.restroomName}</td><td>{d.battery ?? '—'}%</td><td><StatusBadge status={d.status || 'offline'} variant="device" /></td><td><StatusBadge status={d.health || 'healthy'} variant="health" /></td><td>{d.lastSeen ? formatDateTime(d.lastSeen) : '—'}</td></tr>
                    ))}
                    {devices.length === 0 && <tr><td colSpan="7" style={{ textAlign: 'center', color: '#64748b' }}>No devices connected</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
            {activeTab === 'uplinks' && (
              <div className="table-wrapper" style={{ maxHeight: 300, overflow: 'auto' }}>
                <table className="data-table">
                  <thead><tr><th>Time</th><th>Device</th><th>Restroom</th><th>Feedback</th><th>Battery</th><th>Signal</th></tr></thead>
                  <tbody>
                    {uplinks.map((u) => (
                      <tr key={u.id}><td>{formatDateTime(u.timestamp)}</td><td>{u.deviceName || u.deviceEui}</td><td>{u.restroomName || '—'}</td><td>{u.feedbackType?.replace(/_/g, ' ') || '—'}</td><td>{u.battery ?? '—'}</td><td>{u.signalStrength ?? '—'}</td></tr>
                    ))}
                    {uplinks.length === 0 && <tr><td colSpan="6" style={{ textAlign: 'center', color: '#64748b' }}>No uplink activity</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
            {activeTab === 'events' && (
              <div className="table-wrapper" style={{ maxHeight: 300, overflow: 'auto' }}>
                <table className="data-table">
                  <thead><tr><th>Time</th><th>Device</th><th>Battery</th><th>Signal</th><th>Online</th></tr></thead>
                  <tbody>
                    {events.map((ev) => (
                      <tr key={ev.id}><td>{formatDateTime(ev.timestamp)}</td><td>{ev.deviceName || ev.deviceEui}</td><td>{ev.battery ?? '—'}</td><td>{ev.signal ?? '—'}</td><td>{ev.online ? 'Yes' : 'No'}</td></tr>
                    ))}
                    {events.length === 0 && <tr><td colSpan="5" style={{ textAlign: 'center', color: '#64748b' }}>No events</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </aside>
        )}
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
              <label>Frequency Plan<input type="text" value={form.frequencyPlanId} onChange={(e) => setForm((f) => ({ ...f, frequencyPlanId: e.target.value }))} /></label>
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
              <label>Frequency Plan<input type="text" value={editForm.frequencyPlanId} onChange={(e) => setEditForm((f) => ({ ...f, frequencyPlanId: e.target.value }))} /></label>
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
              <label>Frequency Plan<input type="text" value={registerForm.frequencyPlanId} onChange={(e) => setRegisterForm((f) => ({ ...f, frequencyPlanId: e.target.value }))} /></label>
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
    </div>
  )
}