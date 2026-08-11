import { useEffect, useState } from 'react'
import PageHeader from '../components/common/PageHeader'
import StatusBadge from '../components/common/StatusBadge'
import { formatDateTime } from '../utils/formatters'
import api from '../services/api'
import { useAuth } from '../hooks/useAuth'

export default function AlertManagement() {
  const { user } = useAuth()
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const canEdit = user?.role !== 'viewer'

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      try {
        const data = await api.get('/api/alerts')
        if (mounted) setAlerts(data.alerts || [])
      } catch (e) {
        console.error('AlertManagement load error:', e)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  async function updateStatus(id, status) {
    try {
      const updated = await api.put(`/api/alerts/${id}`, { status })
      setAlerts(alerts.map((a) => a.id === id ? updated.alert : a))
    } catch (e) {
      alert(e.message)
    }
  }

  async function acknowledge(id) {
    try {
      const updated = await api.post(`/api/alerts/${id}/acknowledge`)
      setAlerts(alerts.map((a) => a.id === id ? updated.alert : a))
    } catch (e) {
      alert(e.message)
    }
  }

  async function resolve(id) {
    try {
      const updated = await api.post(`/api/alerts/${id}/resolve`)
      setAlerts(alerts.map((a) => a.id === id ? updated.alert : a))
    } catch (e) {
      alert(e.message)
    }
  }

  return (
    <div className="page">
      <PageHeader
        title="Alert Management"
        subtitle="Track, acknowledge, and resolve restroom alerts"
      />

      <div className="card">
        {loading ? (
          <div className="loader-wrap"><div className="loader" /></div>
        ) : (
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
                {alerts.map((alert) => (
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
                {alerts.length === 0 && (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', color: '#64748b' }}>
                      No alerts found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
