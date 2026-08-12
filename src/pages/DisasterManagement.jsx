import { useEffect, useState, useCallback, useMemo } from 'react'
import PageHeader from '../components/common/PageHeader'
import StatusBadge from '../components/common/StatusBadge'
import SearchBar from '../components/common/SearchBar'
import Pagination from '../components/common/Pagination'
import { formatDateTime } from '../utils/formatters'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'

function SystemStatus({ label, status }) {
  return (
    <div className={`system-status system-status--${status}`}>
      <span className="system-status__indicator" />
      <div>
        <strong>{label}</strong>
        <span>{status === 'online' || status === 'operational' ? 'Operational' : 'Down'}</span>
      </div>
    </div>
  )
}

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'incidents', label: 'Incident Log' },
  { key: 'audit', label: 'Audit Log' },
]

export default function DisasterManagement() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('overview')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [incidents, setIncidents] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [incidentPage, setIncidentPage] = useState(1)
  const [auditPage, setAuditPage] = useState(1)
  const [incidentTotalPages, setIncidentTotalPages] = useState(1)
  const [auditTotalPages, setAuditTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const canEdit = user?.role !== 'viewer'

  const loadOverview = useCallback(async () => {
    setLoading(true)
    try {
      const [gateways, network, offlineDevices, recovery, server] = await Promise.all([
        api.get('/api/gateway/gateway-status'),
        api.get('/api/gateway/network-status'),
        api.get('/api/gateway/offline-devices'),
        api.get('/api/gateway/recovery-status'),
        api.get('/api/gateway/server-status'),
      ])

      setData({
        gateways: gateways.gateways || [],
        network: network || {},
        offlineDevices: offlineDevices.devices || [],
        recovery: recovery || {},
        server: server?.server || {},
      })
    } catch (e) {
      console.error('DisasterManagement overview error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadIncidents = useCallback(async (pageNum = 1) => {
    setLoading(true)
    try {
      const data = await api.get(`/api/gateway/incident-log?page=${pageNum}&limit=10`)
      setIncidents(data.incidents || [])
      setIncidentTotalPages(data.pagination?.pages || 1)
      setIncidentPage(pageNum)
    } catch (e) {
      console.error('DisasterManagement incidents error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadAuditLog = useCallback(async (pageNum = 1) => {
    setLoading(true)
    try {
      const data = await api.get(`/api/gateway/audit-log?page=${pageNum}&limit=10`)
      setAuditLogs(data.logs || [])
      setAuditTotalPages(data.pagination?.pages || 1)
      setAuditPage(pageNum)
    } catch (e) {
      console.error('DisasterManagement audit error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'overview') {
      loadOverview()
    } else if (activeTab === 'incidents') {
      loadIncidents(1)
    } else if (activeTab === 'audit') {
      loadAuditLog(1)
    }
  }, [activeTab, loadOverview, loadIncidents, loadAuditLog])

  useEffect(() => {
    const timer = setInterval(() => {
      if (activeTab === 'overview') {
        loadOverview()
      } else if (activeTab === 'incidents') {
        loadIncidents(incidentPage)
      } else if (activeTab === 'audit') {
        loadAuditLog(auditPage)
      }
    }, 30000)
    return () => clearInterval(timer)
  }, [activeTab, loadOverview, loadIncidents, loadAuditLog, incidentPage, auditPage])

  const handleManualClose = async (alertId) => {
    if (!window.confirm('Are you sure you want to manually close this incident?')) return
    try {
      const updated = await api.post(`/api/gateway/incidents/${alertId}/close`)
      setIncidents((prev) => prev.map((i) => (i.id === alertId ? updated.alert : i)))
    } catch (e) {
      alert(e.message)
    }
  }

  const filteredIncidents = useMemo(() => {
    if (!search) return incidents
    const searchLower = search.toLowerCase()
    return incidents.filter((incident) => {
      const restroomName = incident.restroom?.name || ''
      const feedbackType = incident.feedback?.feedbackType || ''
      return (
        restroomName.toLowerCase().includes(searchLower) ||
        feedbackType.toLowerCase().includes(searchLower)
      )
    })
  }, [search, incidents])

  const gatewayOnline = data?.gateways?.some((g) => g.status === 'online')
  const networkOnline = data?.network?.gateways?.online > 0
  const serverStatus = data?.server?.status || 'operational'

  return (
    <div className="page">
      <PageHeader
        action={
          canEdit ? (
            <button type="button" className="btn btn--danger" onClick={() => alert('Manual Closure: select an incident to close from the Incident Log tab')}>
              Manual Closure
            </button>
          ) : null
        }
      />

      <div className="tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`tab ${activeTab === tab.key ? 'tab--active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading && activeTab === 'overview' ? (
        <div className="loader-wrap"><div className="loader" /></div>
      ) : (
        <>
          {activeTab === 'overview' && (
            <>
              <div className="disaster-status-grid">
                <SystemStatus label="Gateway" status={gatewayOnline ? 'online' : 'offline'} />
                <SystemStatus label="Network" status={networkOnline ? 'online' : 'offline'} />
                <SystemStatus label="Server" status={serverStatus} />
              </div>

              <div className="disaster-metrics">
                <div className="card disaster-metric">
                  <span className="disaster-metric__value">{data?.offlineDevices?.length || 0}</span>
                  <span className="disaster-metric__label">Offline Devices</span>
                </div>
                <div className="card disaster-metric">
                  <span className="disaster-metric__value">
                    {data?.offlineDevices?.filter((d) => (d.device?.batteryLevel ?? d.batteryLevel ?? 0) < 20).length || 0}
                  </span>
                  <span className="disaster-metric__label">Low Battery</span>
                </div>
                <div className="card disaster-metric">
                  <span className="disaster-metric__value">
                    {data?.recovery?.alerts?.total || 0}
                  </span>
                  <span className="disaster-metric__label">Active Alerts</span>
                </div>
                <div className="card disaster-metric">
                  <span className="disaster-metric__value">
                    {data?.recovery?.devices?.critical || 0}
                  </span>
                  <span className="disaster-metric__label">Critical Devices</span>
                </div>
              </div>

              <div className="card" style={{ marginTop: 16 }}>
                <h3 className="card__title">Recovery Status</h3>
                <div className="disaster-metrics">
                  <div className="disaster-metric">
                    <span className="disaster-metric__value">{data?.recovery?.devices?.total || 0}</span>
                    <span className="disaster-metric__label">Total Devices</span>
                  </div>
                  <div className="disaster-metric">
                    <span className="disaster-metric__value">{data?.recovery?.devices?.healthy || 0}</span>
                    <span className="disaster-metric__label">Healthy</span>
                  </div>
                  <div className="disaster-metric">
                    <span className="disaster-metric__value">{data?.recovery?.devices?.recovering || 0}</span>
                    <span className="disaster-metric__label">Recovering</span>
                  </div>
                  <div className="disaster-metric">
                    <span className="disaster-metric__value">{data?.recovery?.devices?.critical || 0}</span>
                    <span className="disaster-metric__label">Critical</span>
                  </div>
                  <div className="disaster-metric">
                    <span className="disaster-metric__value">{data?.recovery?.gateways?.total || 0}</span>
                    <span className="disaster-metric__label">Total Gateways</span>
                  </div>
                  <div className="disaster-metric">
                    <span className="disaster-metric__value">{data?.recovery?.gateways?.online || 0}</span>
                    <span className="disaster-metric__label">Gateways Online</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'incidents' && (
            <div className="card">
              <h3 className="card__title">Incident Log</h3>
              <div style={{ marginBottom: 16 }}>
                <SearchBar
                  value={search}
                  onChange={setSearch}
                  placeholder="Search incidents by restroom or type..."
                />
              </div>
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
                      <th>Resolved Time</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredIncidents.map((incident) => (
                      <tr key={incident.id}>
                        <td>{formatDateTime(incident.createdAt || incident.time)}</td>
                        <td>{incident.restroom?.name || incident.restroomName || 'Unknown'}</td>
                        <td>{incident.feedback?.feedbackType?.replace(/_/g, ' ') || incident.type || '—'}</td>
                        <td>{incident.priority || '—'}</td>
                        <td><StatusBadge status={incident.status} variant="alert" /></td>
                        <td>{incident.assignedTo?.name || incident.assignedTo || '—'}</td>
                        <td>{incident.acknowledgedBy?.name || incident.acknowledgedBy || '—'}</td>
                        <td>{incident.resolvedAt ? formatDateTime(incident.resolvedAt) : '—'}</td>
                        <td>
                          {canEdit && incident.status !== 'closed' && (
                            <button
                              type="button"
                              className="btn btn--sm btn--primary"
                              onClick={() => handleManualClose(incident.id)}
                            >
                              Close
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredIncidents.length === 0 && (
                      <tr>
                        <td colSpan="9" style={{ textAlign: 'center', color: '#64748b' }}>
                          No incidents found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <Pagination page={incidentPage} totalPages={incidentTotalPages} onPageChange={(p) => loadIncidents(p)} />
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="card">
              <h3 className="card__title">Audit Log</h3>
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>User</th>
                      <th>Module</th>
                      <th>Action</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log) => (
                      <tr key={log.id}>
                        <td>{formatDateTime(log.createdAt)}</td>
                        <td>{log.user?.name || 'System'}</td>
                        <td>{log.module || '—'}</td>
                        <td>{log.action || '—'}</td>
                        <td>{log.description || '—'}</td>
                      </tr>
                    ))}
                    {auditLogs.length === 0 && (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', color: '#64748b' }}>
                          No audit logs found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <Pagination page={auditPage} totalPages={auditTotalPages} onPageChange={(p) => loadAuditLog(p)} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
