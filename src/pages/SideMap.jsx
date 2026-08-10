import { useEffect, useMemo, useState } from 'react'
import PageHeader from '../components/common/PageHeader'
import { io } from 'socket.io-client'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const periods = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
]

const heatColors = [
  { min: 0, color: 'rgba(34, 197, 94, 0.35)' },
  { min: 0.25, color: 'rgba(234, 179, 8, 0.45)' },
  { min: 0.5, color: 'rgba(249, 115, 22, 0.55)' },
  { min: 0.75, color: 'rgba(239, 68, 68, 0.65)' },
]

const intensityLegend = [
  { label: 'Low', color: '#22c55e' },
  { label: 'Medium', color: '#eab308' },
  { label: 'High', color: '#f97316' },
  { label: 'Very High', color: '#ef4444' },
]

const statusColors = {
  operational: '#10b981',
  maintenance: '#f59e0b',
  offline: '#ef4444',
}

export default function SideMap() {
  const [period, setPeriod] = useState('today')
  const [siteFilter, setSiteFilter] = useState('all')
  const [restroomData, setRestroomData] = useState([])
  const [sites, setSites] = useState([])
  const [maxScore, setMaxScore] = useState(1)
  const [selectedRestroom, setSelectedRestroom] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('srfs_token')

    async function loadHeatMap() {
      setLoading(true)
      try {
        const response = await fetch(`${API_URL}/api/dashboard/heatmap?period=${period}`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (!response.ok) {
          throw new Error('Failed to fetch heat map data')
        }

        const data = await response.json()
        setRestroomData(data.restrooms || [])
        setMaxScore(data.maxScore || 1)
        setSites(data.sites || [])
        if (data.restrooms?.length > 0 && !selectedRestroom) {
          setSelectedRestroom(data.restrooms[0])
        }
      } catch (error) {
        console.error('Heat map error:', error)
      } finally {
        setLoading(false)
      }
    }

    loadHeatMap()

    const socket = io(API_URL, {
      auth: { token },
      transports: ['websocket'],
    })

    socket.on('connect', () => {
      console.log('Socket connected for heat map')
    })

    socket.on('new-feedback', (feedback) => {
      setRestroomData((prev) =>
        prev.map((item) =>
          item.id === feedback.restroomId
            ? {
                ...item,
                score: feedback.feedbackType === 'needs_cleaning' || feedback.feedbackType === 'emergency'
                  ? Math.min(100, item.score + 10)
                  : Math.max(0, item.score - 5),
                total: item.total + 1,
                battery: feedback.battery ?? item.battery,
              }
            : item
        )
      )
    })

    socket.on('new-alert', (alert) => {
      setRestroomData((prev) =>
        prev.map((item) =>
          item.id === alert.restroomId ? { ...item, alerts: (item.alerts || 0) + 1 } : item
        )
      )
    })

    return () => {
      socket.disconnect()
    }
  }, [period])

  const filteredRestrooms = useMemo(() => {
    if (siteFilter === 'all') return restroomData
    return restroomData.filter((room) => room.location === siteFilter)
  }, [restroomData, siteFilter])

  const getHeatColor = (score) => {
    const intensity = score / maxScore
    for (let i = heatColors.length - 1; i >= 0; i -= 1) {
      if (intensity >= heatColors[i].min) return heatColors[i].color
    }
    return heatColors[0].color
  }

  const heatLegend = () => (
    <div
      style={{
        position: 'absolute',
        top: 16,
        right: 16,
        width: 240,
        background: 'rgba(255,255,255,0.97)',
        borderRadius: 14,
        border: '1px solid #e2e8f0',
        boxShadow: '0 12px 30px rgba(15, 23, 42, 0.08)',
        padding: 12,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, color: '#f97316' }}>🔥</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>Restroom Heat Map</span>
        </div>
        <div style={{ display: 'flex', gap: 6, background: '#f1f5f9', padding: '2px 4px', borderRadius: 8 }}>
          {periods.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key)}
              style={{
                border: 0,
                background: period === p.key ? '#fff' : 'transparent',
                color: period === p.key ? '#0f172a' : '#64748b',
                borderRadius: 6,
                fontSize: 9,
                fontWeight: 600,
                padding: '4px 6px',
                cursor: 'pointer',
                boxShadow: period === p.key ? '0 1px 2px rgba(15, 23, 42, 0.08)' : 'none',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 110, overflowY: 'auto' }}>
        {filteredRestrooms.length === 0 ? (
          <div style={{ fontSize: 10, color: '#64748b' }}>No feedback recorded for this period</div>
        ) : (
          filteredRestrooms.map((item) => {
            const intensity = item.score / maxScore
            let dotColor = '#22c55e'
            if (intensity >= 0.75) dotColor = '#ef4444'
            else if (intensity >= 0.5) dotColor = '#f97316'
            else if (intensity >= 0.25) dotColor = '#eab308'

            return (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, display: 'inline-block' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                  <div style={{ fontSize: 9, color: '#64748b' }}>{item.total} feedback · {item.score}% negative</div>
                </div>
              </div>
            )
          })
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, paddingTop: 8, borderTop: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
        {intensityLegend.map((item) => (
          <span key={item.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9, color: '#64748b' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, display: 'inline-block' }} />
            {item.label}
          </span>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 9, color: '#64748b' }}>Density</span>
      </div>
    </div>
  )

  return (
    <div className="page">
      <PageHeader
        title="Sidemap"
        subtitle="Heatmap and map view of restroom activity and site health"
      />

      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ fontWeight: 600, color: '#334155' }}>Filter</label>
            <select
              value={siteFilter}
              onChange={(e) => setSiteFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                background: '#fff',
              }}
            >
              <option value="all">All Sites</option>
              {sites.map((site) => (
                <option key={site.id} value={site.name}>{site.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {periods.map((item) => (
              <button
                type="button"
                key={item.key}
                onClick={() => setPeriod(item.key)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid #dbeafe',
                  background: period === item.key ? '#2563eb' : '#f8fafc',
                  color: period === item.key ? '#fff' : '#475569',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 0.8fr', gap: 20 }}>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ marginBottom: 14 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>Heat Map Overlay</h3>
          </div>

          <div
            style={{
              position: 'relative',
              height: 430,
              borderRadius: 16,
              overflow: 'hidden',
              border: '1px solid #e2e8f0',
              background: 'linear-gradient(135deg, #f8fafc, #e2e8f0)',
            }}
          >
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>
                Loading heat map data...
              </div>
            ) : (
              <svg viewBox="0 0 800 420" width="100%" height="100%" style={{ display: 'block' }}>
                <defs>
                  <filter id="heat-blur" x="-100%" y="-100%" width="300%" height="300%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="22" result="blur" />
                    <feComponentTransfer in="blur" result="softBlur">
                      <feFuncA type="linear" slope="1.3" />
                    </feComponentTransfer>
                    <feMerge>
                      <feMergeNode in="softBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                <rect x="40" y="40" width="720" height="340" rx="18" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" />

                <rect x="90" y="90" width="200" height="100" rx="12" fill="#e2e8f0" stroke="#94a3b8" />
                <rect x="320" y="90" width="180" height="100" rx="12" fill="#e2e8f0" stroke="#94a3b8" />
                <rect x="530" y="90" width="170" height="100" rx="12" fill="#e2e8f0" stroke="#94a3b8" />
                <rect x="120" y="220" width="260" height="110" rx="12" fill="#e2e8f0" stroke="#94a3b8" />
                <rect x="420" y="220" width="260" height="110" rx="12" fill="#e2e8f0" stroke="#94a3b8" />

                {filteredRestrooms.map((item) => (
                  <g key={item.id} onClick={() => setSelectedRestroom(item)} style={{ cursor: 'pointer' }}>
                    <circle
                      cx={item.x}
                      cy={item.y}
                      r={Math.min(38, 20 + (item.total * 1.25))}
                      fill={getHeatColor(item.score)}
                      filter="url(#heat-blur)"
                      style={{ mixBlendMode: 'multiply' }}
                    />
                    <circle
                      cx={item.x}
                      cy={item.y}
                      r={12}
                      fill={item.score > 60 ? '#ef4444' : item.score > 35 ? '#f59e0b' : '#22c55e'}
                      stroke="#ffffff"
                      strokeWidth="3"
                    />
                    <text x={item.x} y={item.y + 40} textAnchor="middle" fontSize="12" fill="#334155" fontWeight="600">
                      {item.id}
                    </text>
                  </g>
                ))}
              </svg>
            )}

            {heatLegend()}
          </div>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div style={{ marginBottom: 14 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>Geo Map</h3>
          </div>

          <div style={{ height: 430, borderRadius: 16, overflow: 'hidden', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
            <iframe
              title="Geo Map"
              src="https://www.openstreetmap.org/export/embed.html?bbox=77.15%2C28.58%2C77.28%2C28.64&layer=mapnik"
              style={{ width: '100%', height: '100%', border: 0 }}
            />
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>Site overview</h3>
          <span style={{ fontSize: 12, color: '#64748b' }}>{filteredRestrooms.length} live locations</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
          {sites.map((site) => (
            <div key={site.id} style={{ padding: 16, borderRadius: 12, border: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>{site.name}</div>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: statusColors[site.status], display: 'inline-block' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Restrooms</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{site.restrooms}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Status</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: statusColors[site.status] }}>{site.status}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginTop: 20, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>Selected restroom</h3>
        </div>

        {selectedRestroom ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div style={{ padding: 14, borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 11, color: '#64748b' }}>Restroom</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{selectedRestroom.name}</div>
            </div>
            <div style={{ padding: 14, borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 11, color: '#64748b' }}>Floor</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{selectedRestroom.floor}</div>
            </div>
            <div style={{ padding: 14, borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 11, color: '#64748b' }}>Feedback</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{selectedRestroom.total}</div>
            </div>
            <div style={{ padding: 14, borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 11, color: '#64748b' }}>Issue score</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{selectedRestroom.score}%</div>
            </div>
          </div>
        ) : (
          <div style={{ color: '#64748b' }}>Select a restroom on the heat map to view details</div>
        )}
      </div>
    </div>
  )
}
