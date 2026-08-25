import { useEffect, useState, useCallback } from 'react'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { ROLES, ROLE_LABELS } from '../utils/constants'

const PAGE_SIZE = 25

const ACTION_COLORS = {
  CREATE: '#10b981',
  UPDATE: '#3b82f6',
  DELETE: '#ef4444',
  DEACTIVATE: '#f59e0b',
  ASSIGN: '#8b5cf6',
  UNASSIGN: '#8b5cf6',
  PLACE: '#06b6d4',
  MOVE: '#06b6d4',
  UNPLACE: '#94a3b8',
}

function ActionBadge({ action }) {
  const color = ACTION_COLORS[action?.toUpperCase()] || '#64748b'
  return (
    <span
      className="status-badge"
      style={{ '--badge-color': color, fontSize: '0.75rem' }}
    >
      {action}
    </span>
  )
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export default function AuditHistory() {
  const { user } = useAuth()
  const isSuperAdmin = user?.role === ROLES.SUPER_ADMIN

  const [logs, setLogs] = useState([])
  const [modules, setModules] = useState([])
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filters
  const [filters, setFilters] = useState({
    module: '',
    action: '',
    from: '',
    to: '',
    page: 1,
  })

  // Load distinct module names for the filter dropdown
  useEffect(() => {
    api.get('/api/audit-logs/modules')
      .then((d) => setModules(d.modules || []))
      .catch(() => { /* non-critical */ })
  }, [])

  const loadLogs = useCallback(async (f) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (f.module) params.set('module', f.module)
      if (f.action) params.set('action', f.action)
      if (f.from) params.set('from', f.from)
      if (f.to) params.set('to', f.to)
      params.set('page', f.page)
      params.set('limit', PAGE_SIZE)

      const data = await api.get(`/api/audit-logs?${params.toString()}`)
      setLogs(data.logs || [])
      setPagination(data.pagination || { page: 1, total: 0, pages: 1 })
    } catch (e) {
      setError(e.message || 'Failed to load audit history')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadLogs(filters)
  }, [filters, loadLogs])

  function handleFilterChange(field, value) {
    setFilters((prev) => ({ ...prev, [field]: value, page: 1 }))
  }

  function handlePageChange(newPage) {
    setFilters((prev) => ({ ...prev, page: newPage }))
  }

  function handleClearFilters() {
    setFilters({ module: '', action: '', from: '', to: '', page: 1 })
  }

  const hasActiveFilters = filters.module || filters.action || filters.from || filters.to

  return (
    <div className="page">
      {/* Scope notice for Vendor Admin */}
      {!isSuperAdmin && (
        <div className="info-banner" role="note">
          Showing audit history for your organisation only.
        </div>
      )}

      {/* ── Filters ────────────────────────────────────────────────────── */}
      <div className="card filters-bar">
        <div className="filters-bar__row">
          <label className="filters-bar__item">
            Module
            <select
              value={filters.module}
              onChange={(e) => handleFilterChange('module', e.target.value)}
              className="select"
            >
              <option value="">All modules</option>
              {modules.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>

          <label className="filters-bar__item">
            Action
            <select
              value={filters.action}
              onChange={(e) => handleFilterChange('action', e.target.value)}
              className="select"
            >
              <option value="">All actions</option>
              <option value="CREATE">Create</option>
              <option value="UPDATE">Update</option>
              <option value="DELETE">Delete</option>
              <option value="DEACTIVATE">Deactivate</option>
              <option value="ASSIGN">Assign</option>
              <option value="UNASSIGN">Unassign</option>
              <option value="PLACE">Place</option>
              <option value="MOVE">Move</option>
              <option value="UNPLACE">Unplace</option>
            </select>
          </label>

          <label className="filters-bar__item">
            From
            <input
              type="date"
              value={filters.from}
              onChange={(e) => handleFilterChange('from', e.target.value)}
            />
          </label>

          <label className="filters-bar__item">
            To
            <input
              type="date"
              value={filters.to}
              onChange={(e) => handleFilterChange('to', e.target.value)}
            />
          </label>

          {hasActiveFilters && (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={handleClearFilters}
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────── */}
      <div className="card">
        {loading ? (
          <div className="loader-wrap"><div className="loader" /></div>
        ) : error ? (
          <div className="error-message">{error}</div>
        ) : (
          <>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>User</th>
                    {isSuperAdmin && <th>Organisation</th>}
                    <th>Module</th>
                    <th>Action</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatDate(log.createdAt)}</td>
                      <td>
                        <div>{log.user?.name || '—'}</div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          {log.user?.email}
                        </div>
                        {log.user?.role && (
                          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                            {ROLE_LABELS[log.user.role] || log.user.role}
                          </div>
                        )}
                      </td>
                      {isSuperAdmin && (
                        <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                          {log.organization?.name || log.organizationId}
                        </td>
                      )}
                      <td>
                        <span className="text-mono">{log.module}</span>
                      </td>
                      <td>
                        <ActionBadge action={log.action} />
                      </td>
                      <td style={{ maxWidth: 380, wordBreak: 'break-word' }}>
                        {log.description}
                      </td>
                    </tr>
                  ))}
                  {logs.length === 0 && (
                    <tr>
                      <td
                        colSpan={isSuperAdmin ? 6 : 5}
                        style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}
                      >
                        No audit log entries found
                        {hasActiveFilters && ' for the selected filters'}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* ── Pagination ──────────────────────────────────────────── */}
            {pagination.pages > 1 && (
              <div className="pagination" aria-label="Pagination">
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  disabled={pagination.page <= 1}
                  onClick={() => handlePageChange(pagination.page - 1)}
                >
                  ← Previous
                </button>
                <span className="pagination__info">
                  Page {pagination.page} of {pagination.pages}
                  &nbsp;({pagination.total} entries)
                </span>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  disabled={pagination.page >= pagination.pages}
                  onClick={() => handlePageChange(pagination.page + 1)}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
