import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'
import SearchBar from '../components/common/SearchBar'
import Pagination from '../components/common/Pagination'
import StatusBadge from '../components/common/StatusBadge'
import api from '../services/api'
import { locationAPI } from '../services/api'
import { formatDateTime } from '../utils/formatters'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'
const PAGE_SIZE = 10

export default function LiveFeedback() {
  const [feedback, setFeedback] = useState([])
  const [liveEntries, setLiveEntries] = useState([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [locationId, setLocationId] = useState('')
  const [floorId, setFloorId] = useState('')
  const [zoneId, setZoneId] = useState('')
  const [deviceId, setDeviceId] = useState('')
  const [locations, setLocations] = useState([])
  const [floors, setFloors] = useState([])
  const [zones, setZones] = useState([])
  const [devices, setDevices] = useState([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [connectionStatus, setConnectionStatus] = useState('connecting')
  const [totalPages, setTotalPages] = useState(1)
  const socketRef = useRef(null)
  const pollTimerRef = useRef(null)
  // Refs so socket handlers always read fresh filter values
  const filterRef = useRef(filter)
  const locationIdRef = useRef(locationId)
  const floorIdRef = useRef(floorId)
  const zoneIdRef = useRef(zoneId)
  const deviceIdRef = useRef(deviceId)
  const pageRef = useRef(page)

  // Derived lists
  const filteredFloors = useMemo(
    () => (locationId ? floors.filter((f) => f.locationId === locationId) : floors),
    [floors, locationId],
  )
  const filteredZones = useMemo(
    () => (floorId ? zones.filter((z) => z.floorId === floorId) : zones),
    [zones, floorId],
  )
  const filteredDevices = useMemo(() => {
    if (!floorId && !zoneId) return devices
    return devices.filter((d) => {
      const floorMatch = !floorId || d.floorId === floorId
      const zoneMatch = !zoneId || d.zoneId === zoneId
      return floorMatch && zoneMatch
    })
  }, [devices, floorId, zoneId])

  const loadFeedback = useCallback(async (pageNum = 1, opts = {}) => {
    try {
      const params = {
        page: pageNum,
        limit: PAGE_SIZE,
        ...(opts.filter && opts.filter !== 'all' ? { feedbackType: opts.filter } : {}),
        ...(opts.locationId ? { locationId: opts.locationId } : {}),
        ...(opts.floorId ? { floorId: opts.floorId } : {}),
        ...(opts.zoneId ? { zoneId: opts.zoneId } : {}),
        ...(opts.deviceId ? { deviceId: opts.deviceId } : {}),
      }
      const data = await api.get(`/api/feedback?${new URLSearchParams(params).toString()}`)
      setFeedback(data.feedback || [])
      setTotalPages((data.pagination || {}).pages || 1)
      setPage(pageNum)
    } catch (e) {
      console.error('LiveFeedback load error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadMeta = useCallback(async () => {
    try {
      const [locData, floorData, zoneData, devData] = await Promise.all([
        locationAPI.getAll(),
        api.get('/api/floors'),
        api.get('/api/zones'),
        api.get('/api/devices'),
      ])
      setLocations(locData.locations || [])
      setFloors(floorData.floors || [])
      setZones(zoneData.zones || [])
      setDevices(devData.devices || [])
    } catch (e) {
      console.error('LiveFeedback meta load error:', e)
    }
  }, [])

  // Keep refs current
  useEffect(() => { filterRef.current = filter }, [filter])
  useEffect(() => { locationIdRef.current = locationId }, [locationId])
  useEffect(() => { floorIdRef.current = floorId }, [floorId])
  useEffect(() => { zoneIdRef.current = zoneId }, [zoneId])
  useEffect(() => { deviceIdRef.current = deviceId }, [deviceId])
  useEffect(() => { pageRef.current = page }, [page])

  useEffect(() => { loadMeta() }, [loadMeta])

  // Socket + fallback polling
  useEffect(() => {
    let mounted = true
    const token = localStorage.getItem('srfs_token')

    function startPolling() {
      if (pollTimerRef.current) return
      if (!mounted) return
      pollTimerRef.current = setInterval(() => {
        if (mounted) {
          loadFeedback(pageRef.current, {
            filter: filterRef.current,
            locationId: locationIdRef.current,
            floorId: floorIdRef.current,
            zoneId: zoneIdRef.current,
            deviceId: deviceIdRef.current,
          })
        }
      }, 10000)
    }

    function connectSocket() {
      if (!token) return null
      try {
        const socket = io(API_URL, { auth: { token }, transports: ['websocket'] })
        socketRef.current = socket

        socket.on('connect', () => {
          if (mounted) {
            setConnectionStatus('connected')
            if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null }
          }
        })
        socket.on('disconnect', () => { if (mounted) { setConnectionStatus('disconnected'); startPolling() } })
        socket.on('connect_error', () => { if (mounted) { setConnectionStatus('error'); startPolling() } })

        socket.on('new-feedback', (entry) => {
          if (!mounted) return
          const cf = filterRef.current
          const cl = locationIdRef.current
          const cfl = floorIdRef.current
          const cz = zoneIdRef.current
          const cd = deviceIdRef.current

          if (cf !== 'all' && entry.feedbackType !== cf) return

          const entryLocId = entry.locationId || entry.restroom?.floor?.locationId
          if (cl && entryLocId !== cl) return

          const entryFloorId = entry.floorId || entry.restroom?.floorId
          if (cfl && entryFloorId !== cfl) return

          if (cz && entry.device?.zoneId !== cz) return
          if (cd && entry.deviceId !== cd) return

          setLiveEntries((prev) => {
            if (prev.some((i) => i.id === entry.id)) return prev
            const norm = {
              ...entry,
              device: entry.device || { badgeId: entry.badgeId, healthStatus: entry.deviceStatus || 'unknown' },
              restroom: entry.restroom || { name: entry.restroomName || 'Unknown' },
            }
            return [norm, ...prev]
          })
        })

        return socket
      } catch (e) {
        console.error('Socket connection failed:', e)
        startPolling()
        return null
      }
    }

    const socket = connectSocket()
    if (!socket) { setConnectionStatus('polling'); startPolling() }

    return () => {
      mounted = false
      if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null }
      if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null }
    }
  }, [loadFeedback])

  // Reload when any filter changes
  useEffect(() => {
    setLoading(true)
    setPage(1)
    setLiveEntries([])
    loadFeedback(1, { filter, locationId, floorId, zoneId, deviceId })
  }, [filter, locationId, floorId, zoneId, deviceId, loadFeedback])

  const handleSearch = useCallback((v) => { setSearch(v); setPage(1) }, [])

  const handleFilterChange = useCallback((setter, ...cascadeSetters) => (e) => {
    setter(e.target.value)
    cascadeSetters.forEach((s) => s(''))
    setPage(1)
    setLiveEntries([])
  }, [])

  const handlePageChange = useCallback((newPage) => {
    setLiveEntries([])
    loadFeedback(newPage, { filter, locationId, floorId, zoneId, deviceId })
  }, [filter, locationId, floorId, zoneId, deviceId, loadFeedback])

  const displayed = useMemo(() => {
    const seen = new Set()
    const combined = []
    for (const entry of [...liveEntries, ...feedback]) {
      if (seen.has(entry.id)) continue
      seen.add(entry.id)
      combined.push(entry)
    }
    if (!search) return combined
    const sl = search.toLowerCase()
    return combined.filter((e) => {
      const rn = e.restroom?.name || e.restroomName || ''
      const bid = e.device?.badgeId || e.badgeId || ''
      const ft = e.feedbackType || ''
      const gn = e.gatewayName || e.device?.gatewayName || ''
      return rn.toLowerCase().includes(sl) || bid.toLowerCase().includes(sl) ||
        ft.toLowerCase().includes(sl) || gn.toLowerCase().includes(sl)
    })
  }, [search, liveEntries, feedback])

  const getVal = (entry, ...keys) => {
    for (const k of keys) {
      const val = k.split('.').reduce((o, p) => o?.[p], entry)
      if (val != null) return val
    }
    return null
  }

  const connLabel = { connected: 'Live', polling: 'Polling', connecting: 'Connecting…', disconnected: 'Disconnected', error: 'Error' }[connectionStatus] || '…'
  const connColor = { connected: '#22c55e', polling: '#eab308', connecting: '#94a3b8', disconnected: '#ef4444', error: '#ef4444' }[connectionStatus] || '#94a3b8'

  return (
    <div className="page">
      {/* ── Filters toolbar ── */}
      <div className="toolbar" style={{ flexWrap: 'wrap', gap: 8 }} data-tour="live-feedback-toolbar">
        <SearchBar value={search} onChange={handleSearch} placeholder="Search by restroom, badge, or type…" />

        <select value={filter} onChange={handleFilterChange(setFilter)} className="select" aria-label="Feedback type">
          <option value="all">All Feedback</option>
          <option value="happy">Happy</option>
          <option value="average">Average</option>
          <option value="needs_cleaning">Needs Cleaning</option>
          <option value="emergency">Emergency</option>
        </select>

        <select
          value={locationId}
          onChange={handleFilterChange(setLocationId, setFloorId, setZoneId, setDeviceId)}
          className="select"
          aria-label="Site"
        >
          <option value="">All Sites</option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>{loc.officeName || loc.city}</option>
          ))}
        </select>

        <select
          value={floorId}
          onChange={handleFilterChange(setFloorId, setZoneId, setDeviceId)}
          className="select"
          disabled={!locationId}
          aria-label="Floor"
        >
          <option value="">All Floors</option>
          {filteredFloors.map((f) => (
            <option key={f.id} value={f.id}>{f.floorName}</option>
          ))}
        </select>

        <select
          value={zoneId}
          onChange={handleFilterChange(setZoneId, setDeviceId)}
          className="select"
          disabled={!floorId}
          aria-label="Zone / Restroom"
        >
          <option value="">All Zones</option>
          {filteredZones.map((z) => (
            <option key={z.id} value={z.id}>{z.name}</option>
          ))}
        </select>

        <select
          value={deviceId}
          onChange={handleFilterChange(setDeviceId)}
          className="select"
          aria-label="Device"
        >
          <option value="">All Devices</option>
          {filteredDevices.map((d) => (
            <option key={d.id} value={d.id}>{d.name || d.badgeId}</option>
          ))}
        </select>

        <span style={{ marginLeft: 'auto', fontSize: 12, color: connColor, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: connColor, display: 'inline-block' }} />
          {connLabel}
        </span>
      </div>

      <div className="card" data-tour="live-feedback-table">
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
                    <th>Floor</th>
                    <th>Feedback</th>
                    <th>Badge ID</th>
                    <th>Gateway</th>
                    <th>Battery</th>
                    <th>Device Status</th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((entry) => {
                    const battery = getVal(entry, 'battery', 'device.batteryLevel')
                    const badgeId = getVal(entry, 'badgeId', 'device.badgeId') || '—'
                    const gatewayName = getVal(entry, 'gatewayName', 'device.gatewayName') || '—'
                    const restroomName = getVal(entry, 'restroomName', 'restroom.name') || 'Unknown'
                    const floorName = entry.restroom?.floor?.floorName || '—'
                    const deviceStatus = entry.deviceStatus || entry.device?.healthStatus || 'unknown'
                    return (
                      <tr key={entry.id}>
                        <td>{formatDateTime(entry.timestamp)}</td>
                        <td>{restroomName}</td>
                        <td>{floorName}</td>
                        <td><StatusBadge status={entry.feedbackType} variant="feedback" /></td>
                        <td><code>{badgeId}</code></td>
                        <td><code>{gatewayName}</code></td>
                        <td>
                          <span className={`battery battery--${(battery ?? 0) >= 30 ? 'ok' : 'low'}`}>
                            {battery != null ? `${battery}%` : '—'}
                          </span>
                        </td>
                        <td><StatusBadge status={deviceStatus} variant="device" /></td>
                      </tr>
                    )
                  })}
                  {displayed.length === 0 && (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', color: '#64748b' }}>No feedback found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
              <Pagination page={page} totalPages={totalPages} onPageChange={handlePageChange} />
              {page < totalPages && (
                <button type="button" className="btn btn--secondary" onClick={() => handlePageChange(page + 1)}>
                  Load older feedback
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
