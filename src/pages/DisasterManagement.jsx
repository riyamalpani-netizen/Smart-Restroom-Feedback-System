import { useEffect, useState } from 'react'
import PageHeader from '../components/common/PageHeader'
import StatusBadge from '../components/common/StatusBadge'
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

export default function DisasterManagement() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const canEdit = user?.role !== 'viewer'

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      try {
        const [gateways, network, offlineDevices, incidents] = await Promise.all([
          api.get('/api/gateway/gateway-status'),
          api.get('/api/gateway/network-status'),
          api.get('/api/gateway/offline-devices'),
          api.get('/api/gateway/incident-log'),
        ])

        if (!mounted) return

        setData({
          gateways: gateways.gateways || [],
          network: network || {},
          offlineDevices: offlineDevices.devices || [],
          incidents: incidents.incidents || [],
        })
      } catch (e) {
        console.error('DisasterManagement load error:', e)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  return (
    <div className="page">
      <PageHeader
        title="Disaster Management"
        subtitle="Monitor system health and incident recovery"
        action={canEdit ? <button type="button" className="btn btn--danger">Manual Closure</button> : null}
      />

      {loading ? (
        <div className="loader-wrap"><div className="loader" /></div>
      ) : (
        <>
          <div className="disaster-status-grid">
            <SystemStatus label="Gateway" status={data?.gateways?.some((g) => g.status === 'online') ? 'online' : 'offline'} />
            <SystemStatus label="Network" status={data?.network?.gateways?.online > 0 ? 'online' : 'offline'} />
            <SystemStatus label="Server" status="online" />
          </div>

          <div className="disaster-metrics">
            <div className="card disaster-metric">
              <span className="disaster-metric__value">{data?.offlineDevices?.length || 0}</span>
              <span className="disaster-metric__label">Offline Devices</span>
            </div>
            <div className="card disaster-metric">
              <span className="disaster-metric__value">
                {data?.offlineDevices?.filter((d) => (d.device?.batteryLevel ?? 0) < 20).length || 0}
              </span>
              <span className="disaster-metric__label">Low Battery</span>
            </div>
            <div className="card disaster-metric">
              <span className="disaster-metric__value">
                {data?.incidents?.filter((i) => i.status === 'investigating').length || 0}
              </span>
              <span className="disaster-metric__label">Communication Failures</span>
            </div>
          </div>

          <div className="card">
            <h3 className="card__title">Incident Log</h3>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Type</th>
                    <th>Device</th>
                    <th>Recovery Status</th>
                    <th>Teams Notification</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.incidents || []).map((incident) => (
                    <tr key={incident.id}>
                      <td>{formatDateTime(incident.createdAt || incident.time)}</td>
                      <td>{incident.type || '—'}</td>
                      <td><code>{incident.device?.badgeId || incident.device || '—'}</code></td>
                      <td>
                        <StatusBadge
                          status={incident.status === 'investigating' ? 'acknowledged' : incident.status === 'monitoring' ? 'open' : 'resolved'}
                          variant="alert"
                        />
                      </td>
                      <td><span className="status-badge" style={{ '--badge-color': '#22c55e' }}>Sent</span></td>
                    </tr>
                  ))}
                  {(data?.incidents || []).length === 0 && (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', color: '#64748b' }}>
                        No incidents found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
