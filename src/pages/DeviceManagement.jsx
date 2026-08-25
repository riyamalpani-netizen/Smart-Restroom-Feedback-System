import { useEffect, useState, useCallback, useRef } from 'react'
import { io } from 'socket.io-client'
import PageHeader from '../components/common/PageHeader'
import SearchBar from '../components/common/SearchBar'
import StatusBadge from '../components/common/StatusBadge'
import BulkUploadModal from '../components/common/BulkUploadModal'
import { formatDateTime } from '../utils/formatters'
import api, { deviceAPI, gatewayAPI, testModeAPI } from '../services/api'
import { useAuth } from '../hooks/useAuth'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

/**
 * Parse a CSV string (RFC 4180 — handles quoted fields with commas/newlines).
 * Returns an array of objects keyed by the header row.
 */
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

export default function DeviceManagement() {
  const { user } = useAuth()
  const [devices, setDevices] = useState([])
  const [restrooms, setRestrooms] = useState([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [replaceOpen, setReplaceOpen] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [testOpen, setTestOpen] = useState(false)
  const [testForm, setTestForm] = useState({ feedbackType: 'happy', count: 1 })
  const [testResult, setTestResult] = useState(null)
  const [testing, setTesting] = useState(false)
  const [form, setForm] = useState({ badgeId: '', deviceEui: '', restroomId: '' })
  const [editForm, setEditForm] = useState({
    name: '', deviceType: 'sensor', locationId: '', restroomId: '',
    floorId: '', batteryLevel: '', deviceEui: '', appKey: '', gatewayId: '',
    latitude: '', longitude: '',
  })
  const [newDevice, setNewDevice] = useState({
    name: '', deviceType: 'sensor', locationId: '', floorId: '', restroomId: '',
    lorawanVersion: 'MAC_V1_0_3', lorawanPhyVersion: '', deviceEui: '', appKey: '',
    latitude: '', longitude: '',
  })
  const canEdit = user?.role !== 'viewer'

  const [locations, setLocations] = useState([])
  const [floors, setFloors] = useState([])
  const [gateways, setGateways] = useState([])
  // bulk upload state
  const [bulkUploading, setBulkUploading] = useState(false)
  const [bulkResult, setBulkResult] = useState(null)   // { created, skipped, errors: [{row,message}] }

  const socketRef = useRef(null)
  const bulkFileRef = useRef(null)

  // ── Sample CSV download ──────────────────────────────────────────────────
  function downloadSampleCSV() {
    const lines = [
      'name,deviceEui,appKey,joinEui,deviceType,batteryLevel,lorawanVersion',
      'Sensor 01,AA00000000000001,A1A1A1A1A1A1A1A1A1A1A1A1A1A1A1A1,0000000000000000,sensor,100,MAC_V1_0_3',
      'Badge 01,AA00000000000002,B2B2B2B2B2B2B2B2B2B2B2B2B2B2B2B2,0000000000000000,badge,100,MAC_V1_0_3',
      'Sensor 03,AA00000000000003,C3C3C3C3C3C3C3C3C3C3C3C3C3C3C3C3,0000000000000000,sensor,95,MAC_V1_0_3',
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'devices_sample.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  // ── Data loading ─────────────────────────────────────────────────────────
  const loadDevices = useCallback(async () => {
    try {
      const data = await api.get('/api/devices')
      setDevices(data.devices || [])
    } catch (e) {
      console.error('DeviceManagement load error:', e)
    }
  }, [])

  const loadRestrooms = useCallback(async () => {
    try {
      const [locData, floorData, restData, gwData] = await Promise.all([
        api.get('/api/locations'),
        api.get('/api/floors'),
        api.get('/api/restrooms'),
        gatewayAPI.getAll(),
      ])
      setLocations(locData.locations || [])
      setFloors(floorData.floors || [])
      setRestrooms(restData.restrooms || [])
      setGateways(gwData.gateways || [])
    } catch (e) {
      console.error('Load restrooms error:', e)
    }
  }, [])

  useEffect(() => {
    let mounted = true
    async function init() {
      setLoading(true)
      await Promise.all([loadDevices(), loadRestrooms()])
      if (mounted) setLoading(false)
    }
    init()
    return () => { mounted = false }
  }, [loadDevices, loadRestrooms])

  useEffect(() => {
    const timer = setInterval(loadDevices, 30000)
    return () => clearInterval(timer)
  }, [loadDevices])

  useEffect(() => {
    const token = localStorage.getItem('srfs_token')
    if (!token) return
    const socket = io(API_URL, { auth: { token }, transports: ['websocket'] })
    socketRef.current = socket
    socket.on('connect', () => { socket.on('new-feedback', loadDevices) })
    return () => {
      socket.off('new-feedback')
      socket.disconnect()
      socketRef.current = null
    }
  }, [loadDevices])

  // ── Bulk upload ──────────────────────────────────────────────────────────
  const handleBulkUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    event.target.value = ''   // reset input so same file can be re-selected

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

      // Client-side guard: require deviceEui column
      const firstRow = items[0]
      if (!('deviceEui' in firstRow) && !('devEui' in firstRow)) {
        setBulkResult({
          created: 0, skipped: 0,
          errors: [{
            row: '—',
            message: 'CSV is missing the required "deviceEui" column. Download the sample CSV to see the correct format.',
          }],
        })
        return
      }

      const result = await deviceAPI.bulkCreate(items)
      setBulkResult({
        created: result.created ?? 0,
        skipped: result.skipped ?? 0,
        errors: result.errors || [],
      })
      await loadDevices()
    } catch (err) {
      // The API returns { errors } on partial failures (status 201) — those are
      // handled above.  We only land here on a hard network / server error.
      setBulkResult({
        created: 0, skipped: 0,
        errors: [{
          row: '—',
          message: err.message || 'Upload failed. Check your file and try again.',
        }],
      })
    } finally {
      setBulkUploading(false)
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  const filtered = devices.filter(
    (d) =>
      !search ||
      d.badgeId?.toLowerCase().includes(search.toLowerCase()) ||
      d.restroomName?.toLowerCase().includes(search.toLowerCase()),
  )

  const hasAssignedLocation = (device) => Boolean(
    device?.locationName || device?.floorId || device?.restroomId ||
    device?.zoneId || device?.latitude != null || device?.longitude != null,
  )

  // ── Single-device CRUD ───────────────────────────────────────────────────
  const openReplace = (device) => {
    setSelected(device)
    setForm({ badgeId: device.badgeId || '', deviceEui: device.deviceEui || '', restroomId: device.restroomId || '' })
    setReplaceOpen(true)
  }

  const openMap = (device) => {
    setSelected(device)
    setForm({ badgeId: device.badgeId || '', deviceEui: device.deviceEui || '', restroomId: device.restroomId || '' })
    setMapOpen(true)
  }

  const handleSaveReplace = async (e) => {
    e.preventDefault()
    if (!selected) return
    setSaving(true)
    try {
      const data = await api.put(`/api/devices/${selected.id}`, { badgeId: form.badgeId, deviceEui: form.deviceEui })
      setDevices((prev) => prev.map((d) => (d.id === selected.id ? { ...d, ...data.device } : d)))
      setSelected((prev) => ({ ...prev, ...data.device }))
      setReplaceOpen(false)
    } catch (e) {
      console.error('Replace badge error:', e)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveMap = async (e) => {
    e.preventDefault()
    if (!selected) return
    setSaving(true)
    try {
      const data = await api.put(`/api/devices/${selected.id}`, { restroomId: form.restroomId || null })
      setDevices((prev) => prev.map((d) => (d.id === selected.id ? { ...d, ...data.device } : d)))
      setSelected((prev) => ({ ...prev, ...data.device }))
      setMapOpen(false)
    } catch (e) {
      console.error('Map badge error:', e)
    } finally {
      setSaving(false)
    }
  }

  const handleUnassignLocation = async (device) => {
    if (!window.confirm(`Remove the assigned location from ${device.name || device.badgeId}? The device will remain available in Device Management.`)) return
    setSaving(true)
    try {
      const data = await api.put(`/api/devices/${device.id}`, {
        restroomId: null, floorId: null, zoneId: null,
        floorPlanPosX: null, floorPlanPosY: null, latitude: null, longitude: null,
      })
      const unassigned = { ...device, ...data.device, restroomName: 'Unassigned', zoneName: null, floorName: null, locationName: null }
      setDevices((prev) => prev.map((item) => item.id === device.id ? unassigned : item))
      setSelected((prev) => prev?.id === device.id ? unassigned : prev)
    } catch (e) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleCreateDevice = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post('/api/devices', {
        name: newDevice.name,
        deviceType: newDevice.deviceType,
        restroomId: newDevice.restroomId || null,
        floorId: newDevice.floorId || null,
        deviceEui: newDevice.deviceEui || undefined,
        appKey: newDevice.appKey || undefined,
        lorawanVersion: newDevice.lorawanVersion || undefined,
        lorawanPhyVersion: newDevice.lorawanPhyVersion || undefined,
        latitude: newDevice.latitude || undefined,
        longitude: newDevice.longitude || undefined,
      })
      setNewDevice({ name: '', deviceType: 'sensor', locationId: '', floorId: '', restroomId: '', lorawanVersion: 'MAC_V1_0_3', lorawanPhyVersion: '', deviceEui: '', appKey: '', latitude: '', longitude: '' })
      setAddOpen(false)
      await loadDevices()
    } catch (e) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (device) => {
    setSelected(device)
    setEditForm({
      name: device.name || '',
      deviceType: device.deviceType || 'sensor',
      locationId: device.locationId || '',
      restroomId: device.restroomId || '',
      floorId: device.floorId || '',
      batteryLevel: device.battery ?? '',
      deviceEui: device.deviceEui || '',
      appKey: device.appKey || '',
      gatewayId: device.gatewayId || '',
      latitude: device.latitude ?? '',
      longitude: device.longitude ?? '',
    })
    setEditOpen(true)
  }

  const handleSaveEdit = async (e) => {
    e.preventDefault()
    if (!selected) return
    setSaving(true)
    try {
      const data = await api.put(`/api/devices/${selected.id}`, {
        name: editForm.name,
        deviceType: editForm.deviceType,
        restroomId: editForm.restroomId || null,
        floorId: editForm.floorId || null,
        zoneId: null,
        batteryLevel: editForm.batteryLevel ? Number(editForm.batteryLevel) : undefined,
        deviceEui: editForm.deviceEui || undefined,
        appKey: editForm.appKey || undefined,
        gatewayId: editForm.gatewayId || null,
        latitude: editForm.latitude === '' ? null : Number(editForm.latitude),
        longitude: editForm.longitude === '' ? null : Number(editForm.longitude),
      })
      setDevices((prev) => prev.map((d) => (d.id === selected.id ? { ...d, ...data.device } : d)))
      setSelected((prev) => ({ ...prev, ...data.device }))
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
      const data = await api.delete(`/api/devices/${selected.id}`)
      setDevices((prev) => prev.filter((d) => d.id !== selected.id))
      setSelected(null)
      setDeleteOpen(false)
      if (data?.ttnDeleted) {
        alert('Device deleted from app and TTN successfully')
      } else {
        alert(`Device deleted from app.\n\nTTN delete failed: ${data?.ttnDeleteError || 'unknown reason'}.\nPlease delete it manually from TTN Console.`)
      }
    } catch (e) {
      alert(e.message)
    } finally {
      setDeleting(false)
    }
  }

  const handleSimulate = async (e) => {
    e.preventDefault()
    if (!selected) return
    setTesting(true)
    setTestResult(null)
    try {
      const data = await testModeAPI.simulate({
        badgeId: selected.badgeId,
        deviceEui: selected.deviceEui,
        feedbackType: testForm.feedbackType,
        count: testForm.count,
      })
      setTestResult(data)
      await loadDevices()
      if (data.ttnSimulated) {
        alert(`TTN simulate successful for ${selected.badgeId}. Check TTN Console Live Data and the Live Feedback page.`)
      }
    } catch (e) {
      alert(e.message)
    } finally {
      setTesting(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="page management-page">
      <PageHeader
        action={
          canEdit ? (
            <div className="btn-group">
              <button type="button" className="btn btn--secondary" onClick={downloadSampleCSV}>
                Download Sample CSV
              </button>
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => bulkFileRef.current?.click()}
                disabled={bulkUploading}
              >
                {bulkUploading ? 'Uploading…' : 'Bulk Upload CSV'}
              </button>
              <button type="button" className="btn btn--primary" onClick={() => setAddOpen(true)}>
                Add Device
              </button>
              <input ref={bulkFileRef} hidden type="file" accept=".csv,text/csv" onChange={handleBulkUpload} />
            </div>
          ) : null
        }
      />

      <SearchBar value={search} onChange={setSearch} placeholder="Search devices…" />

      <div className="device-layout">
        {/* ── Device table ── */}
        <div className="card">
          {loading ? (
            <div className="loader-wrap"><div className="loader" /></div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Badge ID</th>
                    <th>Site</th>
                    <th>Floor</th>
                    <th>Restroom / Zone</th>
                    <th>Latitude</th>
                    <th>Longitude</th>
                    <th>Assignment</th>
                    <th>Battery</th>
                    <th>Status</th>
                    <th>Health</th>
                    <th>Last Communication</th>
                    {canEdit && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((device) => (
                    <tr
                      key={device.id}
                      className={selected?.id === device.id ? 'data-table__row--selected' : ''}
                      onClick={() => setSelected(device)}
                    >
                      <td>{device.name || '—'}</td>
                      <td>{device.deviceType || 'sensor'}</td>
                      <td><code>{device.badgeId}</code></td>
                      <td>{device.locationName || '—'}</td>
                      <td>{device.floorName || '—'}</td>
                      <td>{device.restroomName !== 'Unassigned' ? device.restroomName : (device.zoneName || '—')}</td>
                      <td>{device.latitude ?? '—'}</td>
                      <td>{device.longitude ?? '—'}</td>
                      <td>
                        {hasAssignedLocation(device)
                          ? <span style={{ background: '#dbeafe', color: '#1d4ed8', borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 600 }}>Placed</span>
                          : <span style={{ background: '#f1f5f9', color: '#64748b', borderRadius: 4, padding: '2px 8px', fontSize: 12 }}>Available</span>
                        }
                      </td>
                      <td>
                        <span className={`battery battery--${(device.battery ?? 100) >= 30 ? 'ok' : 'low'}`}>
                          {device.battery ?? '—'}%
                        </span>
                      </td>
                      <td><StatusBadge status={device.status || 'offline'} variant="device" /></td>
                      <td><StatusBadge status={device.health || 'healthy'} variant="health" /></td>
                      <td>{device.lastCommunication ? formatDateTime(device.lastCommunication) : '—'}</td>
                      {canEdit && (
                        <td onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            {hasAssignedLocation(device) && (
                              <button type="button" className="btn btn--secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => handleUnassignLocation(device)}>Unplace</button>
                            )}
                            <button type="button" className="btn btn--secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => openEdit(device)}>Edit</button>
                            <button type="button" className="btn btn--danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => { setSelected(device); setDeleteOpen(true) }}>Delete</button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={canEdit ? 14 : 13} style={{ textAlign: 'center', color: '#64748b' }}>
                        No devices found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Device detail panel ── */}
        {selected && (
          <aside className="card device-detail">
            <h3>Device Details</h3>
            <dl>
              <dt>Name</dt><dd>{selected.name || '—'}</dd>
              <dt>Type</dt><dd>{selected.deviceType || 'sensor'}</dd>
              <dt>Badge ID</dt><dd><code>{selected.badgeId}</code></dd>
              <dt>Device EUI</dt><dd><code>{selected.deviceEui || '—'}</code></dd>
              <dt>Join EUI</dt><dd><code>{selected.joinEui || '—'}</code></dd>
              <dt>App Key</dt><dd><code>{selected.appKey || '—'}</code></dd>
              <dt>LoRaWAN Version</dt><dd>{selected.lorawanVersion || '—'}</dd>
              <dt>PHY Version</dt><dd>{selected.lorawanPhyVersion || '—'}</dd>
              <dt>Restroom</dt><dd>{selected.restroomName}</dd>
              <dt>Zone</dt><dd>{selected.zoneName || '—'}</dd>
              <dt>Floor</dt><dd>{selected.floorName || '—'}</dd>
              <dt>Location</dt><dd>{selected.locationName || '—'}</dd>
              <dt>Battery</dt><dd>{selected.battery ?? '—'}%</dd>
              <dt>Status</dt><dd><StatusBadge status={selected.status || 'offline'} variant="device" /></dd>
              <dt>Health</dt><dd><StatusBadge status={selected.health || 'healthy'} variant="health" /></dd>
              <dt>Last Communication</dt><dd>{selected.lastCommunication ? formatDateTime(selected.lastCommunication) : '—'}</dd>
              <dt>Gateway</dt><dd>{selected.gatewayName || '—'}</dd>
              <dt>Latitude</dt><dd>{selected.latitude ?? '—'}</dd>
              <dt>Longitude</dt><dd>{selected.longitude ?? '—'}</dd>
              <dt>Assignment</dt><dd>{hasAssignedLocation(selected) ? 'Assigned' : 'Available'}</dd>
            </dl>
            {canEdit && (
              <div className="btn-group">
                {hasAssignedLocation(selected) && (
                  <button type="button" className="btn btn--secondary" onClick={() => handleUnassignLocation(selected)}>Unplace</button>
                )}
                <button type="button" className="btn btn--secondary" onClick={() => openEdit(selected)}>Edit</button>
                <button type="button" className="btn btn--secondary" onClick={() => openReplace(selected)}>Replace Badge</button>
                <button type="button" className="btn btn--secondary" onClick={() => openMap(selected)}>Map Badge</button>
                <button type="button" className="btn btn--primary" onClick={() => { setTestForm({ feedbackType: 'happy', count: 1 }); setTestResult(null); setTestOpen(true) }}>Test Device</button>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* ── Bulk upload modal (spinner + result) ── */}
      <BulkUploadModal
        uploading={bulkUploading}
        result={bulkResult}
        onClose={() => setBulkResult(null)}
        entityName="Device"
      />

      {/* ── Replace badge modal ── */}
      {replaceOpen && (
        <div className="modal-overlay" onClick={() => setReplaceOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Replace Badge</h3>
            <form onSubmit={handleSaveReplace}>
              <label>Badge ID<input type="text" value={form.badgeId} onChange={(e) => setForm((f) => ({ ...f, badgeId: e.target.value }))} required /></label>
              <label>Device EUI<input type="text" value={form.deviceEui} onChange={(e) => setForm((f) => ({ ...f, deviceEui: e.target.value }))} required /></label>
              <div className="btn-group">
                <button type="button" className="btn btn--secondary" onClick={() => setReplaceOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Map badge modal ── */}
      {mapOpen && (
        <div className="modal-overlay" onClick={() => setMapOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Map Badge</h3>
            <form onSubmit={handleSaveMap}>
              <label>Badge ID<input type="text" value={form.badgeId} disabled /></label>
              <label>
                Restroom
                <select value={form.restroomId} onChange={(e) => setForm((f) => ({ ...f, restroomId: e.target.value }))}>
                  <option value="">Unassigned</option>
                  {restrooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </label>
              <div className="btn-group">
                <button type="button" className="btn btn--secondary" onClick={() => setMapOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Add device modal ── */}
      {addOpen && (
        <div className="modal-overlay" onClick={() => setAddOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add Device</h3>
            <p style={{ color: '#64748b', fontSize: 13, marginTop: -8 }}>Enter device details to register it in TTN and add it to inventory.</p>
            <form onSubmit={handleCreateDevice}>
              <label>Device Name *<input type="text" value={newDevice.name} onChange={(e) => setNewDevice((d) => ({ ...d, name: e.target.value }))} placeholder="e.g. Men's Room Sensor 1" required /></label>
              <label>
                Device Type *
                <select value={newDevice.deviceType} onChange={(e) => setNewDevice((d) => ({ ...d, deviceType: e.target.value }))}>
                  <option value="sensor">Sensor</option>
                  <option value="gateway">Gateway</option>
                  <option value="badge">Badge</option>
                </select>
              </label>
              <label>
                Site
                <select value={newDevice.locationId} onChange={(e) => setNewDevice((d) => ({ ...d, locationId: e.target.value, floorId: '', restroomId: '' }))}>
                  <option value="">Unassigned</option>
                  {locations.map((loc) => <option key={loc.id} value={loc.id}>{loc.officeName || loc.city}</option>)}
                </select>
              </label>
              <label>
                Floor
                <select value={newDevice.floorId} onChange={(e) => setNewDevice((d) => ({ ...d, floorId: e.target.value, restroomId: '' }))} disabled={!newDevice.locationId}>
                  <option value="">Unassigned</option>
                  {floors.filter((f) => !newDevice.locationId || f.locationId === newDevice.locationId).map((floor) => <option key={floor.id} value={floor.id}>{floor.floorName}</option>)}
                </select>
              </label>
              <label>
                Restroom
                <select value={newDevice.restroomId} onChange={(e) => setNewDevice((d) => ({ ...d, restroomId: e.target.value }))} disabled={!newDevice.floorId}>
                  <option value="">Unassigned</option>
                  {restrooms.filter((r) => !newDevice.floorId || r.floorId === newDevice.floorId).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </label>
              <label>Device EUI *<input type="text" value={newDevice.deviceEui} onChange={(e) => setNewDevice((d) => ({ ...d, deviceEui: e.target.value }))} placeholder="e.g. 70B3D57ED00001AA" required /></label>
              <label>App Key *<input type="text" value={newDevice.appKey} onChange={(e) => setNewDevice((d) => ({ ...d, appKey: e.target.value }))} placeholder="32 hex chars" required /></label>
              <label>LoRaWAN Version<input type="text" value={newDevice.lorawanVersion} onChange={(e) => setNewDevice((d) => ({ ...d, lorawanVersion: e.target.value }))} placeholder="MAC_V1_0_3" /></label>
              <label>PHY Version <span style={{ color: '#64748b' }}>(optional)</span><input type="text" value={newDevice.lorawanPhyVersion} onChange={(e) => setNewDevice((d) => ({ ...d, lorawanPhyVersion: e.target.value }))} placeholder="e.g. PHY_V1_0_3" /></label>
              <div className="btn-group">
                <button type="button" className="btn btn--secondary" onClick={() => setAddOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Registering in TTN…' : 'Add Device'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit device modal ── */}
      {editOpen && (
        <div className="modal-overlay" onClick={() => setEditOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Edit Device</h3>
            <form onSubmit={handleSaveEdit}>
              <label>Device Name<input type="text" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} /></label>
              <label>
                Device Type
                <select value={editForm.deviceType} onChange={(e) => setEditForm((f) => ({ ...f, deviceType: e.target.value }))}>
                  <option value="sensor">Sensor</option>
                  <option value="gateway">Gateway</option>
                  <option value="badge">Badge</option>
                </select>
              </label>
              <label>
                Site
                <select value={editForm.locationId} onChange={(e) => setEditForm((f) => ({ ...f, locationId: e.target.value, floorId: '', restroomId: '' }))}>
                  <option value="">Select site</option>
                  {locations.map((loc) => <option key={loc.id} value={loc.id}>{loc.officeName || loc.city}</option>)}
                </select>
              </label>
              <label>
                Floor
                <select value={editForm.floorId} onChange={(e) => setEditForm((f) => ({ ...f, floorId: e.target.value, restroomId: '' }))} disabled={!editForm.locationId}>
                  <option value="">Select floor</option>
                  {floors.filter((f) => !editForm.locationId || f.locationId === editForm.locationId).map((floor) => <option key={floor.id} value={floor.id}>{floor.floorName}</option>)}
                </select>
              </label>
              <label>
                Restroom
                <select value={editForm.restroomId} onChange={(e) => setEditForm((f) => ({ ...f, restroomId: e.target.value }))} disabled={!editForm.floorId}>
                  <option value="">Unassigned</option>
                  {restrooms.filter((r) => !editForm.floorId || r.floorId === editForm.floorId).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </label>
              <label>Battery Level<input type="number" min="0" max="100" value={editForm.batteryLevel} onChange={(e) => setEditForm((f) => ({ ...f, batteryLevel: e.target.value }))} /></label>
              <label>Device EUI<input type="text" value={editForm.deviceEui} onChange={(e) => setEditForm((f) => ({ ...f, deviceEui: e.target.value }))} /></label>
              <label>App Key<input type="text" value={editForm.appKey} onChange={(e) => setEditForm((f) => ({ ...f, appKey: e.target.value }))} /></label>
              <label>
                Gateway
                <select value={editForm.gatewayId} onChange={(e) => setEditForm((f) => ({ ...f, gatewayId: e.target.value }))}>
                  <option value="">Unassigned</option>
                  {gateways.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </label>
              <div className="btn-group">
                <button type="button" className="btn btn--secondary" onClick={() => setEditOpen(false)}>Cancel</button>
                {selected && hasAssignedLocation(selected) && (
                  <button type="button" className="btn btn--secondary" disabled={saving} onClick={() => { setEditOpen(false); handleUnassignLocation(selected) }}>Unplace</button>
                )}
                <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete confirmation modal ── */}
      {deleteOpen && (
        <div className="modal-overlay" onClick={() => setDeleteOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Device</h3>
            <p style={{ color: '#64748b', fontSize: 14, margin: '8px 0 16px' }}>
              Are you sure you want to delete <strong>{selected?.name || selected?.badgeId}</strong>? This will also remove it from the TTN console if it exists there.
            </p>
            <div className="btn-group">
              <button type="button" className="btn btn--secondary" onClick={() => setDeleteOpen(false)}>Cancel</button>
              <button type="button" className="btn btn--danger" disabled={deleting} onClick={handleDelete}>{deleting ? 'Deleting…' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Test mode modal ── */}
      {testOpen && selected && (
        <div className="modal-overlay" onClick={() => setTestOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Test Mode</h3>
            <p style={{ color: '#64748b', fontSize: 13, marginTop: -8, marginBottom: 12 }}>
              Simulate device feedback without pressing the physical button. Test data is separated from live data.
            </p>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                <div><strong>Device:</strong> <code>{selected.badgeId || selected.deviceEui}</code></div>
                <div><strong>Badge ID:</strong> <code>{selected.badgeId}</code></div>
                <div><strong>Device EUI:</strong> <code>{selected.deviceEui || '—'}</code></div>
                <div><strong>Gateway:</strong> <code>{selected.gatewayName || '—'}</code></div>
                <div><strong>Restroom:</strong> {selected.restroomName}</div>
                <div><strong>Status:</strong> <StatusBadge status={selected.status || 'offline'} variant="device" /></div>
              </div>
            </div>
            {testResult && (
              <div style={{ background: testResult.testMode ? '#dcfce7' : '#fee2e2', border: `1px solid ${testResult.testMode ? '#86efac' : '#fca5a5'}`, borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13 }}>
                <strong>{testResult.testMode ? 'Test Event Generated' : 'Error'}</strong>
                <p style={{ margin: '4px 0 0' }}>
                  {testResult.testMode
                    ? `${testResult.count} feedback event(s) simulated for ${testResult.results?.[0]?.badgeId || selected.badgeId}`
                    : testResult.message || 'Something went wrong'}
                </p>
              </div>
            )}
            <form onSubmit={handleSimulate}>
              <label>
                Feedback Type
                <select value={testForm.feedbackType} onChange={(e) => setTestForm((f) => ({ ...f, feedbackType: e.target.value }))}>
                  <option value="happy">Happy</option>
                  <option value="average">Average</option>
                  <option value="needs_cleaning">Needs Cleaning</option>
                  <option value="emergency">Emergency</option>
                </select>
              </label>
              <label>
                Count (1–100)
                <input type="number" min="1" max="100" value={testForm.count} onChange={(e) => setTestForm((f) => ({ ...f, count: Math.max(1, Math.min(100, Number(e.target.value) || 1)) }))} />
              </label>
              <div className="btn-group">
                <button type="button" className="btn btn--secondary" onClick={() => setTestOpen(false)}>Close</button>
                <button type="submit" className="btn btn--primary" disabled={testing}>{testing ? 'Simulating…' : 'Generate Test Event'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
