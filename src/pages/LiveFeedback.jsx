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
  const [locations, setLocations] = useState([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [connectionStatus, setConnectionStatus] = useState('connecting')
  const [totalPages, setTotalPages] = useState(1)
  const socketRef = useRef(null)
  const pollTimerRef = useRef(null)
  const filterRef = useRef(filter)
  const locationIdRef = useRef(locationId)
  const pageRef = useRef(page)

  const loadFeedback = useCallback(async (pageNum = 1, filterType = 'all', locId = '') => {
    try {
      const params = { page: pageNum, limit: PAGE_SIZE }
      if (filterType !== 'all') params.feedbackType = filterType
      if (locId) params.locationId = locId

      const data = await api.get(`/api/feedback?${new URLSearchParams(params).toString()}`)
      const entries = data.feedback || []
      const pagination = data.pagination || {}

      setFeedback(entries)
      setTotalPages(pagination.pages || 1)
      setPage(pageNum)
    } catch (e) {
      console.error('LiveFeedback load error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadLocations = useCallback(async () => {
    try {
      const data = await locationAPI.getAll()
      setLocations(data.locations || [])
    } catch (e) {
      console.error('LiveFeedback locations load error:', e)
    }
  }, [])

  useEffect(() => {
    filterRef.current = filter
  }, [filter])

  useEffect(() => {
    locationIdRef.current = locationId
  }, [locationId])

  useEffect(() => {
    pageRef.current = page
  }, [page])

  useEffect(() => {
    loadLocations()
  }, [loadLocations])

  // Socket connection — stays open; filters applied via refs in the handler
  useEffect(() => {
    let mounted = true
    const token = localStorage.getItem('srfs_token')

    function startPolling() {
      if (pollTimerRef.current) return
      if (!mounted) return

      pollTimerRef.current = setInterval(() => {
        if (mounted) {
          loadFeedback(pageRef.current, filterRef.current, locationIdRef.current)
        }
      }, 10000)
    }

    function connectSocket() {
      if (!token) return null

      try {
        const socket = io(API_URL, {
          auth: { token },
          transports: ['websocket'],
        })

        socketRef.current = socket

        socket.on('connect', () => {
          if (mounted) {
            setConnectionStatus('connected')
            if (pollTimerRef.current) {
              clearInterval(pollTimerRef.current)
              pollTimerRef.current = null
            }
          }
        })

        socket.on('disconnect', () => {
          if (mounted) {
            setConnectionStatus('disconnected')
            startPolling()
          }
        })

        socket.on('connect_error', () => {
          if (mounted) {
            setConnectionStatus('error')
            startPolling()
          }
        })

        socket.on('new-feedback', (entry) => {
          if (!mounted) return

          const currentFilter = filterRef.current
          const currentLocationId = locationIdRef.current

          if (currentFilter !== 'all' && entry.feedbackType !== currentFilter) {
            return
          }

          const entryLocationId = entry.locationId || entry.restroom?.floor?.locationId
          if (currentLocationId && entryLocationId !== currentLocationId) {
            return
          }

          setLiveEntries((prev) => {
            const exists = prev.some((item) => item.id === entry.id)
            if (exists) return prev
            const normalized = {
              ...entry,
              device: entry.device || { badgeId: entry.badgeId, healthStatus: entry.deviceStatus || 'unknown' },
              restroom: entry.restroom || { name: entry.restroomName || 'Unknown' },
            }
            return [normalized, ...prev]
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
    if (!socket) {
      setConnectionStatus('polling')
      startPolling()
    }

    return () => {
      mounted = false
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current)
        pollTimerRef.current = null
      }
    }
  }, [loadFeedback])

  // Reload paginated data when filters change
  useEffect(() => {
    setLoading(true)
    setPage(1)
    setLiveEntries([])
    loadFeedback(1, filter, locationId)
  }, [filter, locationId, loadFeedback])

  const handleSearch = useCallback((value) => {
    setSearch(value)
    setPage(1)
  }, [])

  const handleFilterChange = useCallback((e) => {
    setFilter(e.target.value)
    setPage(1)
    setLiveEntries([])
  }, [])

  const handleLocationChange = useCallback((e) => {
    setLocationId(e.target.value)
    setPage(1)
    setLiveEntries([])
  }, [])

  const handlePageChange = useCallback((newPage) => {
    setLiveEntries([])
    loadFeedback(newPage, filter, locationId)
  }, [filter, locationId, loadFeedback])

  const loadOlder = useCallback(() => {
    if (page < totalPages) {
      loadFeedback(page + 1, filter, locationId)
    }
  }, [page, totalPages, filter, locationId, loadFeedback])

  const displayed = useMemo(() => {
    const seen = new Set()
    const combined = []
    for (const entry of [...liveEntries, ...feedback]) {
      if (seen.has(entry.id)) continue
      seen.add(entry.id)
      combined.push(entry)
    }
    if (!search) return combined
    const searchLower = search.toLowerCase()
    return combined.filter((entry) => {
      const restroomName = entry.restroom?.name || entry.restroomName || ''
      const badgeId = entry.device?.badgeId || entry.badgeId || ''
      const feedbackType = entry.feedbackType || ''
      const gatewayName = entry.gatewayName || entry.device?.gatewayName || ''
      return (
        restroomName.toLowerCase().includes(searchLower) ||
        badgeId.toLowerCase().includes(searchLower) ||
        feedbackType.toLowerCase().includes(searchLower) ||
        gatewayName.toLowerCase().includes(searchLower)
      )
    })
  }, [search, liveEntries, feedback])

  const getDeviceStatus = (entry) => {
    if (entry.deviceStatus) return entry.deviceStatus
    if (entry.device?.healthStatus) return entry.device.healthStatus
    return 'unknown'
  }

  const getBattery = (entry) => {
    if (entry.battery != null) return entry.battery
    if (entry.device?.batteryLevel != null) return entry.device.batteryLevel
    return null
  }

  const getBadgeId = (entry) => {
    if (entry.badgeId) return entry.badgeId
    if (entry.device?.badgeId) return entry.device.badgeId
    return '—'
  }

  const getRestroomName = (entry) => {
    if (entry.restroomName) return entry.restroomName
    if (entry.restroom?.name) return entry.restroom.name
    return 'Unknown'
  }

  const getGatewayName = (entry) => {
    if (entry.gatewayName) return entry.gatewayName
    if (entry.device?.gatewayName) return entry.device.gatewayName
    return '—'
  }

  const connectionLabel = {
    connected: 'Live',
    polling: 'Polling',
    connecting: 'Connecting...',
    disconnected: 'Disconnected',
    error: 'Connection Error',
  }[connectionStatus] || 'Unknown'

  const connectionColor = {
    connected: '#22c55e',
    polling: '#eab308',
    connecting: '#94a3b8',
    disconnected: '#ef4444',
    error: '#ef4444',
  }[connectionStatus] || '#94a3b8'

  return (
    <div className="page">
      <div className="toolbar">
        <SearchBar
          value={search}
          onChange={handleSearch}
          placeholder="Search by restroom, badge, or feedback type..."
        />
        <select
          value={filter}
          onChange={handleFilterChange}
          className="select"
          aria-label="Filter by feedback type"
        >
          <option value="all">All Feedback</option>
          <option value="happy">Happy</option>
          <option value="average">Average</option>
          <option value="needs_cleaning">Needs Cleaning</option>
          <option value="emergency">Emergency</option>
        </select>
        <select
          value={locationId}
          onChange={handleLocationChange}
          className="select"
          aria-label="Filter by location"
        >
          <option value="">All Locations</option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>{loc.officeName || loc.city}</option>
          ))}
        </select>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 12,
            color: connectionColor,
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: connectionColor,
              display: 'inline-block',
            }}
          />
          {connectionLabel}
        </span>
      </div>

      <div className="card">
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
                    <th>Feedback</th>
                    <th>Badge ID</th>
                    <th>Gateway</th>
                    <th>Battery</th>
                    <th>Device Status</th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((entry) => (
                    <tr key={entry.id}>
                      <td>{formatDateTime(entry.timestamp)}</td>
                      <td>{getRestroomName(entry)}</td>
                      <td><StatusBadge status={entry.feedbackType} variant="feedback" /></td>
                      <td><code>{getBadgeId(entry)}</code></td>
                      <td><code>{getGatewayName(entry)}</code></td>
                      <td>
                        <span className={`battery battery--${(getBattery(entry) ?? 0) >= 30 ? 'ok' : 'low'}`}>
                          {getBattery(entry) != null ? `${getBattery(entry)}%` : '—'}
                        </span>
                      </td>
                      <td><StatusBadge status={getDeviceStatus(entry)} variant="device" /></td>
                    </tr>
                  ))}
                  {displayed.length === 0 && (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', color: '#64748b' }}>
                        No feedback found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
              <Pagination page={page} totalPages={totalPages} onPageChange={handlePageChange} />
              {page < totalPages && (
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={loadOlder}
                >
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
