import { useEffect, useState, useCallback } from 'react'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { ROLES, ROLE_LABELS } from '../utils/constants'

const PAGE_SIZE = 25

const ACTION_META = {
  CREATE:     { color: '#10b981', bg: 'rgba(16,185,129,0.12)'  },
  UPDATE:     { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)'  },
  DELETE:     { color: '#ef4444', bg: 'rgba(239,68,68,0.12)'   },
  DEACTIVATE: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
  ASSIGN:     { color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)'  },
  UNASSIGN:   { color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)'  },
  PLACE:      { color: '#06b6d4', bg: 'rgba(6,182,212,0.12)'   },
  MOVE:       { color: '#06b6d4', bg: 'rgba(6,182,212,0.12)'   },
  UNPLACE:    { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
}

function ActionBadge({ action }) {
  const meta = ACTION_META[action?.toUpperCase()] || { color: '#64748b', bg: 'rgba(100,116,139,0.12)' }
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '3px 10px',
      borderRadius: 5,
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      color: meta.color,
      background: meta.bg,
      border: `1px solid ${meta.color}30`,
      whiteSpace: 'nowrap',
    }}>
      {action}
    </span>
  )
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

const MODULE_ICONS = {
  Settings: '⚙️', User: '👤', Device: '📟', Gateway: '📡',
  Restroom: '🚻', Alert: '🔔', Location: '📍', Floor: '🏢',
  Zone: '📐', Report: '📊',
}

export default function AuditHistory() {
  const { user } = useAuth()
  const isSuperAdmin = user?.role === ROLES.SUPER_ADMIN

  const [logs, setLogs] = useState([])
  const [modules, setModules] = useState([])
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({ module: '', action: '', from: '', to: '', page: 1 })

  useEffect(() => {
    api.get('/api/audit-logs/modules')
      .then((d) => setModules(d.modules || []))
      .catch(() => {})
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

  useEffect(() => { loadLogs(filters) }, [filters, loadLogs])

  function handleFilterChange(field, value) {
    setFilters((p) => ({ ...p, [field]: value, page: 1 }))
  }

  function handleClearFilters() {
    setFilters({ module: '', action: '', from: '', to: '', page: 1 })
  }

  const hasActiveFilters = filters.module || filters.action || filters.from || filters.to
  const colSpan = isSuperAdmin ? 6 : 5

  return (
    <div className="page audit-page">

      {/* ── Header strip ─────────────────────────────────────────────── */}
      <div className="audit-header">
        {!isSuperAdmin && (
          <div className="audit-scope-badge">
            <span className="audit-scope-badge__dot" />
            Showing audit history for your organisation only
          </div>
        )}
        <div className="audit-stats">
          <div className="audit-stat">
            <span className="audit-stat__value">{pagination.total}</span>
            <span className="audit-stat__label">Total Entries</span>
          </div>
          <div className="audit-stat">
            <span className="audit-stat__value">{pagination.pages}</span>
            <span className="audit-stat__label">Pages</span>
          </div>
          <div className="audit-stat">
            <span className="audit-stat__value">{PAGE_SIZE}</span>
            <span className="audit-stat__label">Per Page</span>
          </div>
        </div>
      </div>

      {/* ── Filters bar ──────────────────────────────────────────────── */}
      <div className="audit-filters card">
        <div className="audit-filters__grid">
          <div className="audit-filters__field">
            <span className="audit-filters__label">Module</span>
            <select
              value={filters.module}
              onChange={(e) => handleFilterChange('module', e.target.value)}
              className="audit-select"
            >
              <option value="">All modules</option>
              {modules.map((m) => (
                <option key={m} value={m}>{MODULE_ICONS[m] || ''} {m}</option>
              ))}
            </select>
          </div>

          <div className="audit-filters__field">
            <span className="audit-filters__label">Action</span>
            <select
              value={filters.action}
              onChange={(e) => handleFilterChange('action', e.target.value)}
              className="audit-select"
            >
              <option value="">All actions</option>
              {Object.keys(ACTION_META).map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          <div className="audit-filters__field">
            <span className="audit-filters__label">From</span>
            <input
              type="date"
              value={filters.from}
              onChange={(e) => handleFilterChange('from', e.target.value)}
              className="audit-select"
            />
          </div>

          <div className="audit-filters__field">
            <span className="audit-filters__label">To</span>
            <input
              type="date"
              value={filters.to}
              onChange={(e) => handleFilterChange('to', e.target.value)}
              className="audit-select"
            />
          </div>

          {hasActiveFilters && (
            <div className="audit-filters__field audit-filters__field--action">
              <span className="audit-filters__label">&nbsp;</span>
              <button type="button" className="btn btn--ghost btn--sm audit-clear-btn" onClick={handleClearFilters}>
                ✕ Clear
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Table ────────────────────────────────────────────────────── */}
      <div className="card audit-table-card">
        {loading ? (
          <div className="loader-wrap"><div className="loader" /></div>
        ) : error ? (
          <div className="audit-error">
            <span className="audit-error__icon">⚠️</span>
            {error}
          </div>
        ) : (
          <>
            <div className="table-wrapper audit-table-wrapper">
              <table className="data-table audit-table">
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
                    <tr key={log.id} className="audit-row">
                      <td className="audit-row__time">
                        {formatDate(log.createdAt)}
                      </td>
                      <td>
                        <div className="audit-user">
                          <span className="audit-user__avatar">
                            {log.user?.name?.charAt(0)?.toUpperCase() || '?'}
                          </span>
                          <div className="audit-user__info">
                            <span className="audit-user__name">{log.user?.name || '—'}</span>
                            <span className="audit-user__email">{log.user?.email}</span>
                            {log.user?.role && (
                              <span className="audit-user__role">
                                {ROLE_LABELS[log.user.role] || log.user.role}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      {isSuperAdmin && (
                        <td className="audit-row__org">
                          {log.organization?.name || log.organizationId || '—'}
                        </td>
                      )}
                      <td>
                        <span className="audit-module">
                          <span>{MODULE_ICONS[log.module] || '📋'}</span>
                          {log.module}
                        </span>
                      </td>
                      <td>
                        <ActionBadge action={log.action} />
                      </td>
                      <td className="audit-row__desc">
                        {log.description}
                      </td>
                    </tr>
                  ))}
                  {logs.length === 0 && (
                    <tr>
                      <td colSpan={colSpan} className="audit-empty">
                        <span className="audit-empty__icon">🔍</span>
                        <span>No audit log entries found{hasActiveFilters && ' for the selected filters'}.</span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* ── Pagination ─────────────────────────────────────────── */}
            {pagination.pages > 1 && (
              <div className="audit-pagination">
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  disabled={filters.page <= 1}
                  onClick={() => handleFilterChange('page', filters.page - 1)}
                >
                  ← Previous
                </button>
                <span className="audit-pagination__info">
                  Page <strong>{pagination.page}</strong> of <strong>{pagination.pages}</strong>
                  <span className="audit-pagination__total">&nbsp;· {pagination.total} entries</span>
                </span>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  disabled={filters.page >= pagination.pages}
                  onClick={() => handleFilterChange('page', filters.page + 1)}
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
