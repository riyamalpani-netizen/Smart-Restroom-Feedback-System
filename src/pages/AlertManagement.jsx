import { useEffect, useState, useCallback, useMemo } from 'react'
import StatusBadge from '../components/common/StatusBadge'
import SearchBar from '../components/common/SearchBar'
import Pagination from '../components/common/Pagination'
import { formatDateTime } from '../utils/formatters'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'

const PAGE_SIZE = 10

export default function AlertManagement() {
  const { user } = useAuth()
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const canEdit = user?.role !== 'viewer'

  const loadAlerts = useCallback(async (pageNum = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', pageNum)
      params.set('limit', PAGE_SIZE)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (priorityFilter !== 'all') params.set('priority', priorityFilter)

      const data = await api.get(`/api/alerts?${params.toString()}`)
      setAlerts(data.alerts || [])
      setTotalPages(data.pagination?.pages || 1)
      setPage(pageNum)
    } catch (e) {
      console.error('AlertManagement load error:', e)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, priorityFilter])

  useEffect(() => {
    loadAlerts(1)
  }, [loadAlerts])

  useEffect(() => {
    const timer = setInterval(() => {
      loadAlerts(page)
    }, 30000)
    return () => clearInterval(timer)
  }, [loadAlerts, page])

  const handleSearch = useCallback((value) => {
    setSearch(value)
  }, [])

  const handleStatusChange = useCallback((e) => {
    setStatusFilter(e.target.value)
  }, [])

  const handlePriorityChange = useCallback((e) => {
    setPriorityFilter(e.target.value)
  }, [])

  const handlePageChange = useCallback((newPage) => {
    loadAlerts(newPage)
  }, [loadAlerts])

  const filtered = useMemo(() => {
    if (!search) return alerts
    const searchLower = search.toLowerCase()
    return alerts.filter((alert) => {
      const restroomName = alert.restroom?.name || alert.restroomName || ''
      const feedbackType = alert.feedback?.feedbackType || alert.type || ''
      const assignedTo = alert.assignedTo?.name || alert.assignedTo || ''
      const acknowledgedBy = alert.acknowledgedBy?.name || alert.acknowledgedBy || ''
      return (
        restroomName.toLowerCase().includes(searchLower) ||
        feedbackType.toLowerCase().includes(searchLower) ||
        assignedTo.toLowerCase().includes(searchLower) ||
        acknowledgedBy.toLowerCase().includes(searchLower)
      )
    })
  }, [search, alerts])

  async function acknowledge(id) {
    try {
      const updated = await api.post(`/api/alerts/${id}/acknowledge`)
      setAlerts((prev) => prev.map((a) => (a.id === id ? updated.alert : a)))
    } catch (e) {
      alert(e.message)
    }
  }

  async function resolve(id) {
    try {
      const updated = await api.post(`/api/alerts/${id}/resolve`)
      setAlerts((prev) => prev.map((a) => (a.id === id ? updated.alert : a)))
    } catch (e) {
      alert(e.message)
    }
  }

  return (
    <div className="page">
      <div className="toolbar">
        <SearchBar
          value={search}
          onChange={handleSearch}
          placeholder="Search alerts by restroom, type, or person..."
        />
        <select
          value={statusFilter}
          onChange={handleStatusChange}
          className="select"
          aria-label="Filter by status"
        >
          <option value="all">All Status</option>
          <option value="open">Open</option>
          <option value="assigned">Assigned</option>
          <option value="in_progress">In Progress</option>
          <option value="closed">Closed</option>
        </select>
        <select
          value={priorityFilter}
          onChange={handlePriorityChange}
          className="select"
          aria-label="Filter by priority"
        >
          <option value="all">All Priority</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
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
                    <th>Alert Time</th>
                    <th>Restroom</th>
                    <th>Type</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Assigned To</th>
                    <th>Acknowledged By</th>
                    <th>Resolved Time</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((alert) => (
                    <tr key={alert.id}>
                      <td>{formatDateTime(alert.createdAt || alert.time)}</td>
                      <td>{alert.restroom?.name || alert.restroomName || 'Unknown'}</td>
                      <td>{alert.feedback?.feedbackType?.replace(/_/g, ' ') || alert.type || '—'}</td>
                      <td>{alert.priority || '—'}</td>
                      <td><StatusBadge status={alert.status} variant="alert" /></td>
                      <td>{alert.assignedTo?.name || alert.assignedTo || '—'}</td>
                      <td>{alert.acknowledgedBy?.name || alert.acknowledgedBy || '—'}</td>
                      <td>{alert.resolvedAt ? formatDateTime(alert.resolvedAt) : '—'}</td>
                      <td>
                        {canEdit ? (
                          <div className="btn-group btn-group--inline">
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
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan="9" style={{ textAlign: 'center', color: '#64748b' }}>
                        No alerts found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} onPageChange={handlePageChange} />
          </>
        )}
      </div>
    </div>
  )
}
