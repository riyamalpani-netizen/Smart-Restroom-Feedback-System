import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useRealtimeSocket } from '../hooks/useRealtimeSocket'
import StatusBadge from '../components/common/StatusBadge'
import SearchBar from '../components/common/SearchBar'
import Pagination from '../components/common/Pagination'
import { formatDateTime } from '../utils/formatters'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../context/ToastContext'

const PAGE_SIZE = 15
const TABS = ['active', 'history']

export default function AlertManagement() {
  const { user } = useAuth()
  const canEdit = user?.role !== 'viewer'
  const toast = useToast()

  // Tab
  const [tab, setTab] = useState('active')

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [locationId, setLocationId] = useState('')
  const [floorId, setFloorId] = useState('')
  const [zoneId, setZoneId] = useState('')
  const [deviceId, setDeviceId] = useState('')

  // Data
  const [alerts, setAlerts] = useState([])
  const [users, setUsers] = useState([])
  const [locations, setLocations] = useState([])
  const [floors, setFloors] = useState([])
  const [zones, setZones] = useState([])
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // Inline notes
  const [editingNotesId, setEditingNotesId] = useState(null)
  const [notesDraft, setNotesDraft] = useState('')

  // Derived filter lists
  const filteredFloors = useMemo(
    () => (locationId ? floors.filter((f) => f.locationId === locationId) : floors),
    [floors, locationId],
  )
  const filteredZones = useMemo(
    () => (floorId ? zones.filter((z) => z.floorId === floorId) : zones),
    [zones, floorId],
  )

  // Refs so socket handlers always read the latest filter/tab values
  // without needing to re-subscribe on every state change.
  const tabRef = useRef(tab)
  const statusFilterRef = useRef(statusFilter)
  const locationIdRef = useRef(locationId)
  const floorIdRef = useRef(floorId)
  useEffect(() => { tabRef.current = tab }, [tab])
  useEffect(() => { statusFilterRef.current = statusFilter }, [statusFilter])
  useEffect(() => { locationIdRef.current = locationId }, [locationId])
  useEffect(() => { floorIdRef.current = floorId }, [floorId])

  // Real-time socket — show new alerts from badge presses immediately.
  useRealtimeSocket({
    // new-alert fires when a needs_cleaning or emergency badge is pressed.
    // Only act when we're on the active tab (history tab is historical only).
    'new-alert': (alert) => {
      if (tabRef.current === 'history') return

      // If a location/floor filter is active, skip alerts that don't match.
      const loc = locationIdRef.current
      const floor = floorIdRef.current
      if (loc && alert.locationId && alert.locationId !== loc) return
      if (floor && alert.floorId && alert.floorId !== floor) return

      // Status filter: if user is filtering to a specific status, only 'open'
      // alerts can match (new alerts always arrive as 'open').
      const sf = statusFilterRef.current
      if (sf !== 'all' && sf !== 'open') return

      // Reload page 1 to get the full server-shaped alert object (with
      // restroom name, assignedTo, etc.) rather than patching the sparse
      // socket payload into the table.
      loadAlerts(1)
    },
    // new-feedback fires for every badge press — only acts if we're watching
    // active alerts and the feedback is an actionable type.
    'new-feedback': (feedback) => {
      if (tabRef.current === 'history') return
      const actionable = feedback.feedbackType === 'needs_cleaning' || feedback.feedbackType === 'emergency'
      if (!actionable) return
      loadAlerts(1)
    },
  })

  const loadMeta = useCallback(async () => {
    try {
      const [locRes, floorRes, zoneRes, devRes, userRes] = await Promise.all([
        api.get('/api/locations'),
        api.get('/api/floors'),
        api.get('/api/zones'),
        api.get('/api/devices'),
        api.get('/api/users'),
      ])
      setLocations(locRes.locations || [])
      setFloors(floorRes.floors || [])
      setZones(zoneRes.zones || [])
      setDevices(devRes.devices || [])
      setUsers(userRes.users || [])
    } catch (e) {
      console.error('AlertManagement meta error:', e)
    }
  }, [])

  const loadAlerts = useCallback(async (pageNum = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', pageNum)
      params.set('limit', PAGE_SIZE)

      // Tab drives status filter
      if (tab === 'history') {
        params.set('status', 'closed')
      } else {
        if (statusFilter !== 'all') params.set('status', statusFilter)
        else params.set('excludeStatus', 'closed')
      }

      if (priorityFilter !== 'all') params.set('priority', priorityFilter)
      if (locationId) params.set('locationId', locationId)
      if (floorId) params.set('floorId', floorId)
      if (zoneId) params.set('zoneId', zoneId)
      if (deviceId) params.set('deviceId', deviceId)
      if (search) params.set('search', search)

      const data = await api.get(`/api/alerts?${params.toString()}`)
      setAlerts(data.alerts || [])
      setTotalPages(data.pagination?.pages || 1)
      setPage(pageNum)
    } catch (e) {
      console.error('AlertManagement load error:', e)
    } finally {
      setLoading(false)
    }
  }, [tab, statusFilter, priorityFilter, locationId, floorId, zoneId, deviceId, search])

  useEffect(() => { loadMeta() }, [loadMeta])
  useEffect(() => { loadAlerts(1) }, [loadAlerts])

  // Auto-refresh every 30s
  useEffect(() => {
    const t = setInterval(() => loadAlerts(page), 30000)
    return () => clearInterval(t)
  }, [loadAlerts, page])

  const handleCascadeFilter = (setter, ...cascadeSetters) => (e) => {
    setter(e.target.value)
    cascadeSetters.forEach((s) => s(''))
    setPage(1)
  }

  // ── Actions ──────────────────────────────────────────────────────────────
  async function acknowledge(id) {
    try {
      const data = await api.post(`/api/alerts/${id}/acknowledge`, {})
      setAlerts((prev) => prev.map((a) => (a.id === id ? data.alert : a)))
      toast.success('Alert acknowledged.')
    } catch (e) { toast.error(e.message || 'Failed to acknowledge alert.') }
  }

  async function resolve(id) {
    if (!window.confirm('Mark this alert as resolved?')) return
    try {
      const data = await api.post(`/api/alerts/${id}/resolve`, {})
      setAlerts((prev) => prev.map((a) => (a.id === id ? data.alert : a)))
      toast.success('Alert resolved.')
    } catch (e) { toast.error(e.message || 'Failed to resolve alert.') }
  }

  async function assign(id, userId) {
    try {
      const data = await api.put(`/api/alerts/${id}`, { assignedToId: userId || null })
      setAlerts((prev) => prev.map((a) => (a.id === id ? data.alert : a)))
      toast.success('Alert assigned.')
    } catch (e) { toast.error(e.message || 'Failed to assign alert.') }
  }

  async function saveNotes(id) {
    try {
      const data = await api.put(`/api/alerts/${id}`, { notes: notesDraft })
      setAlerts((prev) => prev.map((a) => (a.id === id ? data.alert : a)))
      setEditingNotesId(null)
      toast.success('Notes saved.')
    } catch (e) { toast.error(e.message || 'Failed to save notes.') }
  }

  return (
    <div className="page">
      {/* ── Tabs ── */}
      <div className="tabs" style={{ marginBottom: 12 }} data-tour="alert-tabs">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            className={`tab ${tab === t ? 'tab--active' : ''}`}
            onClick={() => { setTab(t); setPage(1) }}
          >
            {t === 'active' ? 'Active Alerts' : 'Alert History'}
          </button>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="toolbar" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 12 }} data-tour="alert-filters">
        <SearchBar value={search} onChange={setSearch} placeholder="Search alerts…" />

        {tab === 'active' && (
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }} className="select" aria-label="Status">
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
          </select>
        )}

        <select value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value); setPage(1) }} className="select" aria-label="Priority">
          <option value="all">All Priority</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <select value={locationId} onChange={handleCascadeFilter(setLocationId, setFloorId, setZoneId, setDeviceId)} className="select" aria-label="Site">
          <option value="">All Sites</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.officeName || l.city}</option>)}
        </select>

        <select value={floorId} onChange={handleCascadeFilter(setFloorId, setZoneId, setDeviceId)} className="select" disabled={!locationId} aria-label="Floor">
          <option value="">All Floors</option>
          {filteredFloors.map((f) => <option key={f.id} value={f.id}>{f.floorName}</option>)}
        </select>

        <select value={zoneId} onChange={handleCascadeFilter(setZoneId, setDeviceId)} className="select" disabled={!floorId} aria-label="Zone">
          <option value="">All Zones</option>
          {filteredZones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
        </select>

        <select value={deviceId} onChange={(e) => { setDeviceId(e.target.value); setPage(1) }} className="select" aria-label="Device">
          <option value="">All Devices</option>
          {devices.map((d) => <option key={d.id} value={d.id}>{d.name || d.badgeId}</option>)}
        </select>
      </div>

      {/* ── Table ── */}
      <div className="card" data-tour="alert-table">
        {loading ? (
          <div className="loader-wrap"><div className="loader" /></div>
        ) : (
          <>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Restroom</th>
                    <th>Type</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Assigned To</th>
                    <th>Acknowledged By</th>
                    {tab === 'history' && <th>Resolved</th>}
                    <th>Notes</th>
                    {canEdit && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((alert) => (
                    <tr key={alert.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(alert.createdAt)}</td>
                      <td>{alert.restroom?.name || '—'}</td>
                      <td>
                        <StatusBadge
                          status={alert.feedback?.feedbackType || 'unknown'}
                          variant="feedback"
                        />
                      </td>
                      <td><StatusBadge status={alert.priority} variant="alert" /></td>
                      <td><StatusBadge status={alert.status} variant="alert" /></td>

                      {/* Assign / Reassign */}
                      <td>
                        {canEdit ? (
                          <select
                            value={alert.assignedTo?.id || ''}
                            onChange={(e) => assign(alert.id, e.target.value)}
                            className="select"
                            style={{ minWidth: 130, fontSize: 12 }}
                          >
                            <option value="">Unassigned</option>
                            {users.map((u) => (
                              <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                          </select>
                        ) : (
                          alert.assignedTo?.name || '—'
                        )}
                      </td>

                      <td>{alert.acknowledgedBy?.name || '—'}</td>

                      {tab === 'history' && (
                        <td>{alert.resolvedAt ? formatDateTime(alert.resolvedAt) : '—'}</td>
                      )}

                      {/* Inline notes */}
                      <td>
                        {editingNotesId === alert.id ? (
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <input
                              value={notesDraft}
                              onChange={(e) => setNotesDraft(e.target.value)}
                              placeholder="Resolution details…"
                              style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #334155', background: '#1e293b', color: '#f1f5f9', minWidth: 140, fontSize: 12 }}
                            />
                            <button type="button" className="btn btn--sm btn--primary" onClick={() => saveNotes(alert.id)}>Save</button>
                            <button type="button" className="btn btn--sm btn--ghost" onClick={() => setEditingNotesId(null)}>✕</button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <span style={{ color: alert.notes ? '#e2e8f0' : '#64748b', fontSize: 12, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={alert.notes || ''}>
                              {alert.notes || 'No notes'}
                            </span>
                            {canEdit && (
                              <button
                                type="button"
                                className="btn btn--sm btn--ghost"
                                onClick={() => { setEditingNotesId(alert.id); setNotesDraft(alert.notes || '') }}
                              >
                                {alert.notes ? 'Edit' : 'Add'}
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Action buttons */}
                      {canEdit && (
                        <td>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'nowrap' }}>
                            {alert.status === 'open' && (
                              <button
                                type="button"
                                className="btn btn--sm btn--secondary"
                                onClick={() => acknowledge(alert.id)}
                              >
                                Acknowledge
                              </button>
                            )}
                            {alert.status !== 'closed' && (
                              <button
                                type="button"
                                className="btn btn--sm btn--primary"
                                onClick={() => resolve(alert.id)}
                              >
                                Resolve
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                  {alerts.length === 0 && (
                    <tr>
                      <td colSpan={10} style={{ textAlign: 'center', color: '#64748b' }}>
                        No alerts found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} onPageChange={(p) => loadAlerts(p)} />
          </>
        )}
      </div>
    </div>
  )
}
