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
  const [editingNotesId, setEditingNotesId] = useState(null)
  const [notesDraft, setNotesDraft] = useState('')
  const [users, setUsers] = useState([])
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

  useEffect(() => {
    async function loadUsers() {
      try {
        const data = await api.get('/api/users')
        setUsers(data.users || [])
      } catch (e) {
        console.error('Load users error:', e)
      }
    }
    loadUsers()
  }, [])

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
      const notes = alert.notes || ''
      return (
        restroomName.toLowerCase().includes(searchLower) ||
        feedbackType.toLowerCase().includes(searchLower) ||
        assignedTo.toLowerCase().includes(searchLower) ||
        acknowledgedBy.toLowerCase().includes(searchLower) ||
        notes.toLowerCase().includes(searchLower)
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

  async function assign(id, userId) {
    try {
      const updated = await api.put(`/api/alerts/${id}`, { assignedToId: userId })
      setAlerts((prev) => prev.map((a) => (a.id === id ? updated.alert : a)))
    } catch (e) {
      alert(e.message)
    }
  }

  function startEditNotes(alert) {
    setEditingNotesId(alert.id)
    setNotesDraft(alert.notes || '')
  }

  async function saveNotes(id) {
    try {
      const updated = await api.put(`/api/alerts/${id}`, { notes: notesDraft })
      setAlerts((prev) => prev.map((a) => (a.id === id ? updated.alert : a)))
      setEditingNotesId(null)
      setNotesDraft('')
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
          placeholder="Search alerts by restroom, type, person, or notes..."
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
                    <th>Notes</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((alert) => (
                    <tr key={alert.id}>
                      <td>{formatDateTime(alert.createdAt || alert.time)}</td>
                      <td>{alert.restroom?.name || alert.restroomName || 'Unknown'}</td>
                      <td>{alert.feedback?.feedbackType?.replace(/_/g, ' ') || alert.type || '—'}</td>
                      <td><StatusBadge status={alert.priority} variant="alert" /></td>
                      <td><StatusBadge status={alert.status} variant="alert" /></td>
                      <td>
                        {canEdit ? (
                          <select
                            value={alert.assignedTo?.id || ''}
                            onChange={(e) => assign(alert.id, e.target.value)}
                            className="select"
                            style={{ minWidth: 120 }}
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
                      <td>{alert.acknowledgedBy?.name || alert.acknowledgedBy || '—'}</td>
                      <td>{alert.resolvedAt ? formatDateTime(alert.resolvedAt) : '—'}</td>
                      <td>
                        {editingNotesId === alert.id ? (
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <input
                              value={notesDraft}
                              onChange={(e) => setNotesDraft(e.target.value)}
                              placeholder="Add note..."
                              style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #cbd5e1', minWidth: 140 }}
                            />
                            <button type="button" className="btn btn--sm btn--primary" onClick={() => saveNotes(alert.id)}>Save</button>
                            <button type="button" className="btn btn--sm btn--ghost" onClick={() => setEditingNotesId(null)}>Cancel</button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <span style={{ color: alert.notes ? '#334155' : '#94a3b8', fontSize: 12 }}>
                              {alert.notes || 'No notes'}
                            </span>
                            {canEdit && (
                              <button type="button" className="btn btn--sm btn--ghost" onClick={() => startEditNotes(alert)}>Edit</button>
                            )}
                          </div>
                        )}
                      </td>
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
                      <td colSpan="10" style={{ textAlign: 'center', color: '#64748b' }}>
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
