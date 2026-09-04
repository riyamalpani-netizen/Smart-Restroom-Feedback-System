import { useEffect, useState, useCallback, useRef } from 'react'
import { io } from 'socket.io-client'
import PageHeader from '../components/common/PageHeader'
import SearchBar from '../components/common/SearchBar'
import StatusBadge from '../components/common/StatusBadge'
import BulkUploadModal from '../components/common/BulkUploadModal'
import DetailDrawer from '../components/common/DetailDrawer'
import { formatDateTime } from '../utils/formatters'
import api, { deviceAPI, gatewayAPI, testModeAPI } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../context/ToastContext'
import { TTN_FREQUENCY_PLANS } from '../utils/constants'

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
  // Assign to org (super admin only)
  const [assignOrgOpen, setAssignOrgOpen] = useState(false)
  const [assignOrgTarget, setAssignOrgTarget] = useState(null)
  const [organizations, setOrganizations] = useState([])
  const [assignOrgId, setAssignOrgId] = useState('')
  const [form, setForm] = useState({ badgeId: '', deviceEui: '', restroomId: '' })
  const [editForm, setEditForm] = useState({
    name: '', deviceType: 'sensor', locationId: '', restroomId: '',
    floorId: '', batteryLevel: '', deviceEui: '', appKey: '', gatewayId: '', badgeId: '',
    frequencyPlanId: 'IN_865_867', latitude: '', longitude: '',
  })
  const [newDevice, setNewDevice] = useState({
    name: '', deviceType: 'sensor', locationId: '', floorId: '', restroomId: '',
    lorawanVersion: 'MAC_V1_0_3', lorawanPhyVersion: '', deviceEui: '', appKey: '', badgeId: '',
    frequencyPlanId: 'IN_865_867', latitude: '', longitude: '',
  })
  const canEdit = user?.role !== 'viewer'
  const isSuperAdmin = user?.role === 'super_admin'
  const toast = useToast()
  const [drawerDevice, setDrawerDevice] = useState(null)

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

  const loadOrganizations = useCallback(async () => {
    if (!isSuperAdmin || organizations.length) return
    try {
      // Organizations are accessible through the users endpoint (super admin only)
      const data = await api.get('/api/organizations')
      setOrganizations(data.organizations || [])
    } catch (e) {
      console.error('Load organizations error:', e)
    }
  }, [isSuperAdmin, organizations.length])

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
      toast.success('Badge replaced successfully.')
    } catch (e) {
      toast.error(e.message || 'Failed to replace badge.')
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
      toast.success('Device mapped to restroom.')
    } catch (e) {
      toast.error(e.message || 'Failed to map device.')
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
      toast.success(`${device.name || device.badgeId} unplaced.`)
    } catch (e) {
      toast.error(e.message || 'Failed to unplace device.')
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
        badgeId: newDevice.badgeId || undefined,
        deviceEui: newDevice.deviceEui || undefined,
        appKey: newDevice.appKey || undefined,
        lorawanVersion: newDevice.lorawanVersion || undefined,
        lorawanPhyVersion: newDevice.lorawanPhyVersion || undefined,
        frequencyPlanId: newDevice.frequencyPlanId || undefined,
        latitude: newDevice.latitude || undefined,
        longitude: newDevice.longitude || undefined,
      })
      setNewDevice({ name: '', deviceType: 'sensor', locationId: '', floorId: '', restroomId: '', lorawanVersion: 'MAC_V1_0_3', lorawanPhyVersion: '', deviceEui: '', appKey: '', badgeId: '', frequencyPlanId: 'IN_865_867', latitude: '', longitude: '' })
      setAddOpen(false)
      await loadDevices()
      toast.success('Device created successfully.')
    } catch (e) {
      toast.error(e.message || 'Failed to create device.')
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
      badgeId: device.badgeId || '',
      frequencyPlanId: device.frequencyPlanId || 'IN_865_867',
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
        badgeId: editForm.badgeId || undefined,
        zoneId: null,
        batteryLevel: editForm.batteryLevel ? Number(editForm.batteryLevel) : undefined,
        deviceEui: editForm.deviceEui || undefined,
        appKey: editForm.appKey || undefined,
        gatewayId: editForm.gatewayId || null,
        frequencyPlanId: editForm.frequencyPlanId || undefined,
        latitude: editForm.latitude === '' ? null : Number(editForm.latitude),
        longitude: editForm.longitude === '' ? null : Number(editForm.longitude),
      })
      setDevices((prev) => prev.map((d) => (d.id === selected.id ? { ...d, ...data.device } : d)))
      setSelected((prev) => ({ ...prev, ...data.device }))
      setEditOpen(false)
      toast.success('Device updated.')
    } catch (e) {
      toast.error(e.message || 'Failed to update device.')
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
        toast.success('Device deleted from app and TTN.')
      } else {
        toast.warning(`Device deleted from app. TTN delete failed: ${data?.ttnDeleteError || 'unknown'}. Please remove it manually from TTN Console.`)
      }
    } catch (e) {
      toast.error(e.message || 'Failed to delete device.')
    } finally {
      setDeleting(false)
    }
  }

  const openAssignOrg = (device) => {
    setAssignOrgTarget(device)
    setAssignOrgId(device.organizationId || '')
    setAssignOrgOpen(true)
    loadOrganizations()
  }

  const handleAssignOrg = async (e) => {
    e.preventDefault()
    if (!assignOrgTarget) return
    setSaving(true)
    try {
      const data = await api.put(`/api/devices/${assignOrgTarget.id}`, { organizationId: assignOrgId || null })
      setDevices((prev) => prev.map((d) => d.id === assignOrgTarget.id ? { ...d, ...data.device } : d))
      setAssignOrgOpen(false)
      setAssignOrgTarget(null)
      toast.success('Organisation assigned.')
    } catch (e) {
      toast.error(e.message || 'Failed to assign organisation.')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleDeviceActive = async (device) => {
    const newHealth = device.health === 'critical' ? 'healthy' : 'critical'
    setSaving(true)
    try {
      const data = await api.put(`/api/devices/${device.id}`, { healthStatus: newHealth })
      const updated = { ...device, ...data.device, health: data.device?.healthStatus || newHealth, status: newHealth === 'healthy' ? 'online' : 'offline' }
      setDevices((prev) => prev.map((d) => (d.id === device.id ? updated : d)))
      setSelected((prev) => prev?.id === device.id ? updated : prev)
      toast.success(`Device ${newHealth === 'healthy' ? 'activated' : 'deactivated'}.`)
    } catch (e) {
      toast.error(e.message || 'Failed to update device.')
    } finally {
      setSaving(false)
    }
  }

  const handleSimulate = async (e) => {    e.preventDefault()
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
        toast.info(`TTN simulate successful for ${selected.badgeId}. Check TTN Console Live Data and the Live Feedback page.`)
      }
    } catch (e) {
      toast.error(e.message || 'Simulation failed.')
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
              {isSuperAdmin && (
                <>
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
                </>
              )}
            </div>
          ) : null
        }
      />

      <div data-tour="device-search">
        <SearchBar value={search} onChange={setSearch} placeholder="Search devices…" />
      </div>

      <div className="device-layout">
        {/* ── Device table ── */}
        <div className="card" data-tour="device-table">
          {loading ? (
            <div className="loader-wrap"><div className="loader" /></div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Badge ID</th>
                    <th>Site</th>
                    <th>Floor</th>
                    <th>Restroom</th>
                    <th>Battery</th>
                    <th>Status</th>
                    <th>Health</th>
                    <th>Last Seen</th>
                    <th></th>
                    {canEdit && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((device) => (
                    <tr key={device.id} className={selected?.id === device.id ? 'data-table__row--selected' : ''}>
                      <td style={{ fontWeight: 600 }}>{device.name || '—'}</td>
                      <td><code style={{ fontSize: 11 }}>{device.badgeId}</code></td>
                      <td>{device.locationName || '—'}</td>
                      <td>{device.floorName || '—'}</td>
                      <td>{device.restroomName !== 'Unassigned' ? device.restroomName : (device.zoneName || '—')}</td>
                      <td>
                        <span className={`battery battery--${(device.battery ?? 100) >= 30 ? 'ok' : 'low'}`}>
                          {device.battery ?? '—'}%
                        </span>
                      </td>
                      <td><StatusBadge status={device.status || 'offline'} variant="device" /></td>
                      <td><StatusBadge status={device.health || 'healthy'} variant="health" /></td>
                      <td style={{ whiteSpace: 'nowrap', fontSize: 12, color: 'var(--text-muted)' }}>{device.lastCommunication ? formatDateTime(device.lastCommunication) : '—'}</td>
                      {/* Eye icon — opens detail drawer */}
                      <td onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="btn-icon"
                          title="View details"
                          onClick={() => { setDrawerDevice(device); setSelected(device); loadOrganizations() }}
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
                                {device.organizationId && (
                                  <span style={{ padding: '3px 8px', fontSize: 11, background: 'var(--success-bg, #dcfce7)', color: 'var(--success, #16a34a)', borderRadius: 4, fontWeight: 600, whiteSpace: 'nowrap' }}>
                                    ✓ Assigned
                                  </span>
                                )}
                                <button type="button" className="btn btn--sm btn--secondary" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => openAssignOrg(device)}>
                                  {device.organizationId ? 'Reassign' : 'Assign Org'}
                                </button>
                              </>
                            )}
                            <button type="button" className={`btn btn--sm ${device.health === 'critical' ? 'btn--primary' : 'btn--secondary'}`} style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => handleToggleDeviceActive(device)} disabled={saving}>
                              {device.health === 'critical' ? 'Activate' : 'Deactivate'}
                            </button>
                            {hasAssignedLocation(device) && (
                              <button type="button" className="btn btn--sm btn--secondary" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => handleUnassignLocation(device)}>Unplace</button>
                            )}
                            <button type="button" className="btn btn--sm btn--secondary" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => openEdit(device)}>Edit</button>
                            {isSuperAdmin && (
                              <button type="button" className="btn btn--sm btn--danger" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => { setSelected(device); setDeleteOpen(true) }}>Delete</button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={canEdit ? 11 : 10} style={{ textAlign: 'center', color: '#64748b' }}>
                        No devices found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* ── Device Detail Drawer ── */}
      <DetailDrawer
        open={!!drawerDevice}
        onClose={() => setDrawerDevice(null)}
        title={drawerDevice?.name || drawerDevice?.badgeId || 'Device Details'}
        subtitle={drawerDevice?.badgeId}
      >
        {drawerDevice && (
          <>
            <div className="drawer-section">
              <p className="drawer-section__title">Identity</p>
              <div className="drawer-fields">
                <div className="drawer-field"><span className="drawer-field__label">Badge ID</span><span className="drawer-field__value"><code>{drawerDevice.badgeId}</code></span></div>
                <div className="drawer-field"><span className="drawer-field__label">Type</span><span className="drawer-field__value">{drawerDevice.deviceType || 'sensor'}</span></div>
                <div className="drawer-field"><span className="drawer-field__label">Device EUI</span><span className="drawer-field__value"><code>{drawerDevice.deviceEui || '—'}</code></span></div>
                <div className="drawer-field"><span className="drawer-field__label">Join EUI</span><span className="drawer-field__value"><code>{drawerDevice.joinEui || '—'}</code></span></div>
                <div className="drawer-field drawer-field--full"><span className="drawer-field__label">App Key</span><span className="drawer-field__value"><code>{drawerDevice.appKey || '—'}</code></span></div>
                <div className="drawer-field"><span className="drawer-field__label">LoRaWAN</span><span className="drawer-field__value">{drawerDevice.lorawanVersion || '—'}</span></div>
                <div className="drawer-field"><span className="drawer-field__label">PHY</span><span className="drawer-field__value">{drawerDevice.lorawanPhyVersion || '—'}</span></div>
              </div>
            </div>
            <div className="drawer-section">
              <p className="drawer-section__title">Status</p>
              <div className="drawer-fields">
                <div className="drawer-field"><span className="drawer-field__label">Status</span><span className="drawer-field__value"><StatusBadge status={drawerDevice.status || 'offline'} variant="device" /></span></div>
                <div className="drawer-field"><span className="drawer-field__label">Health</span><span className="drawer-field__value"><StatusBadge status={drawerDevice.health || 'healthy'} variant="health" /></span></div>
                <div className="drawer-field"><span className="drawer-field__label">Battery</span><span className="drawer-field__value">{drawerDevice.battery ?? '—'}%</span></div>
                <div className="drawer-field"><span className="drawer-field__label">Gateway</span><span className="drawer-field__value">{drawerDevice.gatewayName || '—'}</span></div>
                <div className="drawer-field"><span className="drawer-field__label">Assignment</span><span className="drawer-field__value">{hasAssignedLocation(drawerDevice) ? 'Placed' : 'Available'}</span></div>
                <div className="drawer-field">
                  <span className="drawer-field__label">Vendor</span>
                  <span className="drawer-field__value">
                    {drawerDevice.organizationId
                      ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />
                          <span style={{ color: '#16a34a', fontWeight: 600 }}>
                            {organizations.find(o => o.id === drawerDevice.organizationId)?.name || 'Assigned'}
                          </span>
                        </span>
                      : <span style={{ color: 'var(--text-muted)' }}>Unassigned</span>
                    }
                  </span>
                </div>                <div className="drawer-field"><span className="drawer-field__label">Last Seen</span><span className="drawer-field__value" style={{ fontSize: 12 }}>{drawerDevice.lastCommunication ? formatDateTime(drawerDevice.lastCommunication) : '—'}</span></div>
              </div>
            </div>
            <div className="drawer-section">
              <p className="drawer-section__title">Location</p>
              <div className="drawer-fields">
                <div className="drawer-field"><span className="drawer-field__label">Site</span><span className="drawer-field__value">{drawerDevice.locationName || '—'}</span></div>
                <div className="drawer-field"><span className="drawer-field__label">Floor</span><span className="drawer-field__value">{drawerDevice.floorName || '—'}</span></div>
                <div className="drawer-field"><span className="drawer-field__label">Restroom</span><span className="drawer-field__value">{drawerDevice.restroomName || '—'}</span></div>
                <div className="drawer-field"><span className="drawer-field__label">Zone</span><span className="drawer-field__value">{drawerDevice.zoneName || '—'}</span></div>
                <div className="drawer-field"><span className="drawer-field__label">Latitude</span><span className="drawer-field__value">{drawerDevice.latitude ?? '—'}</span></div>
                <div className="drawer-field"><span className="drawer-field__label">Longitude</span><span className="drawer-field__value">{drawerDevice.longitude ?? '—'}</span></div>
              </div>
            </div>
            {canEdit && (
              <div className="drawer-section">
                <p className="drawer-section__title">Actions</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {hasAssignedLocation(drawerDevice) && <button type="button" className="btn btn--sm btn--secondary" onClick={() => { handleUnassignLocation(drawerDevice); setDrawerDevice(null) }}>Unplace</button>}
                  <button type="button" className="btn btn--sm btn--secondary" onClick={() => { openEdit(drawerDevice); setDrawerDevice(null) }}>Edit</button>
                  <button type="button" className="btn btn--sm btn--secondary" onClick={() => { openReplace(drawerDevice); setDrawerDevice(null) }}>Replace Badge</button>
                  <button type="button" className="btn btn--sm btn--secondary" onClick={() => { openMap(drawerDevice); setDrawerDevice(null) }}>Map Badge</button>
                  <button type="button" className="btn btn--sm btn--primary" onClick={() => { setSelected(drawerDevice); setTestForm({ feedbackType: 'happy', count: 1 }); setTestResult(null); setTestOpen(true); setDrawerDevice(null) }}>Test Device</button>
                  {isSuperAdmin && <button type="button" className="btn btn--sm btn--danger" onClick={() => { setSelected(drawerDevice); setDeleteOpen(true); setDrawerDevice(null) }}>Delete</button>}
                </div>
              </div>
            )}
          </>
        )}
      </DetailDrawer>

      {/* ── Bulk upload modal (spinner + result) ── */}
      <BulkUploadModal
        uploading={bulkUploading}
        result={bulkResult}
        onClose={() => setBulkResult(null)}
        entityName="Device"
      />

      {/* ── Assign to Organisation modal (Super Admin only) ── */}
      {isSuperAdmin && assignOrgOpen && (
        <div className="modal-overlay" onClick={() => setAssignOrgOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <h3>Assign Device to Organisation</h3>
            <p style={{ color: '#64748b', fontSize: 13, margin: '4px 0 16px' }}>
              Assign <strong>{assignOrgTarget?.name || assignOrgTarget?.badgeId}</strong> to a vendor organisation.
              The vendor admin will then see it in their portal.
            </p>
            <form onSubmit={handleAssignOrg}>
              <label>
                Organisation
                <select
                  value={assignOrgId}
                  onChange={(e) => setAssignOrgId(e.target.value)}
                  className="select"
                >
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
              <label>Badge ID *<input type="text" value={newDevice.badgeId} onChange={(e) => setNewDevice((d) => ({ ...d, badgeId: e.target.value }))} placeholder="e.g. BADGE-001" required /></label>
              <label>App Key *<input type="text" value={newDevice.appKey} onChange={(e) => setNewDevice((d) => ({ ...d, appKey: e.target.value }))} placeholder="32 hex chars" required /></label>
              <label>LoRaWAN Version<input type="text" value={newDevice.lorawanVersion} onChange={(e) => setNewDevice((d) => ({ ...d, lorawanVersion: e.target.value }))} placeholder="MAC_V1_0_3" /></label>
              <label>PHY Version <span style={{ color: '#64748b' }}>(optional)</span><input type="text" value={newDevice.lorawanPhyVersion} onChange={(e) => setNewDevice((d) => ({ ...d, lorawanPhyVersion: e.target.value }))} placeholder="e.g. PHY_V1_0_3" /></label>
              <label>
                Frequency Plan *
                <select value={newDevice.frequencyPlanId} onChange={(e) => setNewDevice((d) => ({ ...d, frequencyPlanId: e.target.value }))}>
                  {TTN_FREQUENCY_PLANS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </label>
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
              <label>Device EUI<input type="text" value={editForm.deviceEui} onChange={(e) => setEditForm((f) => ({ ...f, deviceEui: e.target.value }))} placeholder="e.g. 70B3D57ED00001AA" /></label>
              <label>Badge ID<input type="text" value={editForm.badgeId} onChange={(e) => setEditForm((f) => ({ ...f, badgeId: e.target.value }))} placeholder="e.g. BADGE-001" /></label>
              <label>App Key<input type="text" value={editForm.appKey} onChange={(e) => setEditForm((f) => ({ ...f, appKey: e.target.value }))} /></label>
              <label>
                Frequency Plan
                <select value={editForm.frequencyPlanId} onChange={(e) => setEditForm((f) => ({ ...f, frequencyPlanId: e.target.value }))}>
                  {TTN_FREQUENCY_PLANS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </label>
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
