// import { useEffect, useMemo, useState } from 'react'
// import PageHeader from '../components/common/PageHeader'
// import { io } from 'socket.io-client'

// const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

// const periods = [
//   { key: 'today', label: 'Today' },
//   { key: 'week', label: 'This Week' },
//   { key: 'month', label: 'This Month' },
// ]

// const heatColors = [
//   { min: 0, color: 'rgba(34, 197, 94, 0.35)' },
//   { min: 0.25, color: 'rgba(234, 179, 8, 0.45)' },
//   { min: 0.5, color: 'rgba(249, 115, 22, 0.55)' },
//   { min: 0.75, color: 'rgba(239, 68, 68, 0.65)' },
// ]

// const intensityLegend = [
//   { label: 'Low', color: '#22c55e' },
//   { label: 'Medium', color: '#eab308' },
//   { label: 'High', color: '#f97316' },
//   { label: 'Very High', color: '#ef4444' },
// ]

// const statusColors = {
//   operational: '#10b981',
//   maintenance: '#f59e0b',
//   offline: '#ef4444',
// }

// export default function SideMap() {
//   const [period, setPeriod] = useState('today')
//   const [siteFilter, setSiteFilter] = useState('all')
//   const [restroomData, setRestroomData] = useState([])
//   const [sites, setSites] = useState([])
//   const [maxScore, setMaxScore] = useState(1)
//   const [selectedRestroom, setSelectedRestroom] = useState(null)
//   const [loading, setLoading] = useState(true)

//   useEffect(() => {
//     const token = localStorage.getItem('srfs_token')

//     async function loadHeatMap() {
//       setLoading(true)
//       try {
//         const response = await fetch(`${API_URL}/api/dashboard/heatmap?period=${period}`, {
//           headers: { Authorization: `Bearer ${token}` },
//         })

//         if (!response.ok) {
//           throw new Error('Failed to fetch heat map data')
//         }

//         const data = await response.json()
//         setRestroomData(data.restrooms || [])
//         setMaxScore(data.maxScore || 1)
//         setSites(data.sites || [])
//         if (data.restrooms?.length > 0 && !selectedRestroom) {
//           setSelectedRestroom(data.restrooms[0])
//         }
//       } catch (error) {
//         console.error('Heat map error:', error)
//       } finally {
//         setLoading(false)
//       }
//     }

//     loadHeatMap()

//     const socket = io(API_URL, {
//       auth: { token },
//       transports: ['websocket'],
//     })

//     socket.on('connect', () => {
//       console.log('Socket connected for heat map')
//     })

//     socket.on('new-feedback', (feedback) => {
//       setRestroomData((prev) =>
//         prev.map((item) =>
//           item.id === feedback.restroomId
//             ? {
//                 ...item,
//                 score: feedback.feedbackType === 'needs_cleaning' || feedback.feedbackType === 'emergency'
//                   ? Math.min(100, item.score + 10)
//                   : Math.max(0, item.score - 5),
//                 total: item.total + 1,
//                 battery: feedback.battery ?? item.battery,
//               }
//             : item
//         )
//       )
//     })

//     socket.on('new-alert', (alert) => {
//       setRestroomData((prev) =>
//         prev.map((item) =>
//           item.id === alert.restroomId ? { ...item, alerts: (item.alerts || 0) + 1 } : item
//         )
//       )
//     })

//     return () => {
//       socket.disconnect()
//     }
//   }, [period])

//   const filteredRestrooms = useMemo(() => {
//     if (siteFilter === 'all') return restroomData
//     return restroomData.filter((room) => room.location === siteFilter)
//   }, [restroomData, siteFilter])

//   const getHeatColor = (score) => {
//     const intensity = score / maxScore
//     for (let i = heatColors.length - 1; i >= 0; i -= 1) {
//       if (intensity >= heatColors[i].min) return heatColors[i].color
//     }
//     return heatColors[0].color
//   }

//   const heatLegend = () => (
//     <div
//       style={{
//         position: 'absolute',
//         top: 16,
//         right: 16,
//         width: 240,
//         background: 'rgba(255,255,255,0.97)',
//         borderRadius: 14,
//         border: '1px solid #e2e8f0',
//         boxShadow: '0 12px 30px rgba(15, 23, 42, 0.08)',
//         padding: 12,
//       }}
//     >
//       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
//         <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
//           <span style={{ fontSize: 14, color: '#f97316' }}>🔥</span>
//           <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>Restroom Heat Map</span>
//         </div>
//         <div style={{ display: 'flex', gap: 6, background: '#f1f5f9', padding: '2px 4px', borderRadius: 8 }}>
//           {periods.map((p) => (
//             <button
//               key={p.key}
//               type="button"
//               onClick={() => setPeriod(p.key)}
//               style={{
//                 border: 0,
//                 background: period === p.key ? '#fff' : 'transparent',
//                 color: period === p.key ? '#0f172a' : '#64748b',
//                 borderRadius: 6,
//                 fontSize: 9,
//                 fontWeight: 600,
//                 padding: '4px 6px',
//                 cursor: 'pointer',
//                 boxShadow: period === p.key ? '0 1px 2px rgba(15, 23, 42, 0.08)' : 'none',
//               }}
//             >
//               {p.label}
//             </button>
//           ))}
//         </div>
//       </div>

//       <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 110, overflowY: 'auto' }}>
//         {filteredRestrooms.length === 0 ? (
//           <div style={{ fontSize: 10, color: '#64748b' }}>No feedback recorded for this period</div>
//         ) : (
//           filteredRestrooms.map((item) => {
//             const intensity = item.score / maxScore
//             let dotColor = '#22c55e'
//             if (intensity >= 0.75) dotColor = '#ef4444'
//             else if (intensity >= 0.5) dotColor = '#f97316'
//             else if (intensity >= 0.25) dotColor = '#eab308'

//             return (
//               <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
//                 <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, display: 'inline-block' }} />
//                 <div style={{ flex: 1, minWidth: 0 }}>
//                   <div style={{ fontSize: 10, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
//                   <div style={{ fontSize: 9, color: '#64748b' }}>{item.total} feedback · {item.score}% negative</div>
//                 </div>
//               </div>
//             )
//           })
//         )}
//       </div>

//       <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, paddingTop: 8, borderTop: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
//         {intensityLegend.map((item) => (
//           <span key={item.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9, color: '#64748b' }}>
//             <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, display: 'inline-block' }} />
//             {item.label}
//           </span>
//         ))}
//         <span style={{ marginLeft: 'auto', fontSize: 9, color: '#64748b' }}>Density</span>
//       </div>
//     </div>
//   )

//   return (
//     <div className="page">
//       <PageHeader
//         title="Sidemap"
//         subtitle="Heatmap and map view of restroom activity and site health"
//       />

//       <div className="card" style={{ padding: 20, marginBottom: 20 }}>
//         <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
//           <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
//             <label style={{ fontWeight: 600, color: '#334155' }}>Filter</label>
//             <select
//               value={siteFilter}
//               onChange={(e) => setSiteFilter(e.target.value)}
//               style={{
//                 padding: '8px 12px',
//                 borderRadius: 8,
//                 border: '1px solid #cbd5e1',
//                 background: '#fff',
//               }}
//             >
//               <option value="all">All Sites</option>
//               {sites.map((site) => (
//                 <option key={site.id} value={site.name}>{site.name}</option>
//               ))}
//             </select>
//           </div>

//           <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
//             {periods.map((item) => (
//               <button
//                 type="button"
//                 key={item.key}
//                 onClick={() => setPeriod(item.key)}
//                 style={{
//                   padding: '8px 12px',
//                   borderRadius: 8,
//                   border: '1px solid #dbeafe',
//                   background: period === item.key ? '#2563eb' : '#f8fafc',
//                   color: period === item.key ? '#fff' : '#475569',
//                   cursor: 'pointer',
//                   fontWeight: 600,
//                 }}
//               >
//                 {item.label}
//               </button>
//             ))}
//           </div>
//         </div>
//       </div>

//       <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 0.8fr', gap: 20 }}>
//         <div className="card" style={{ padding: 20 }}>
//           <div style={{ marginBottom: 14 }}>
//             <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>Heat Map Overlay</h3>
//           </div>

//           <div
//             style={{
//               position: 'relative',
//               height: 430,
//               borderRadius: 16,
//               overflow: 'hidden',
//               border: '1px solid #e2e8f0',
//               background: 'linear-gradient(135deg, #f8fafc, #e2e8f0)',
//             }}
//           >
//             {loading ? (
//               <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>
//                 Loading heat map data...
//               </div>
//             ) : (
//               <svg viewBox="0 0 800 420" width="100%" height="100%" style={{ display: 'block' }}>
//                 <defs>
//                   <filter id="heat-blur" x="-100%" y="-100%" width="300%" height="300%">
//                     <feGaussianBlur in="SourceGraphic" stdDeviation="22" result="blur" />
//                     <feComponentTransfer in="blur" result="softBlur">
//                       <feFuncA type="linear" slope="1.3" />
//                     </feComponentTransfer>
//                     <feMerge>
//                       <feMergeNode in="softBlur" />
//                       <feMergeNode in="SourceGraphic" />
//                     </feMerge>
//                   </filter>
//                 </defs>

//                 <rect x="40" y="40" width="720" height="340" rx="18" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" />

//                 <rect x="90" y="90" width="200" height="100" rx="12" fill="#e2e8f0" stroke="#94a3b8" />
//                 <rect x="320" y="90" width="180" height="100" rx="12" fill="#e2e8f0" stroke="#94a3b8" />
//                 <rect x="530" y="90" width="170" height="100" rx="12" fill="#e2e8f0" stroke="#94a3b8" />
//                 <rect x="120" y="220" width="260" height="110" rx="12" fill="#e2e8f0" stroke="#94a3b8" />
//                 <rect x="420" y="220" width="260" height="110" rx="12" fill="#e2e8f0" stroke="#94a3b8" />

//                 {filteredRestrooms.map((item) => (
//                   <g key={item.id} onClick={() => setSelectedRestroom(item)} style={{ cursor: 'pointer' }}>
//                     <circle
//                       cx={item.x}
//                       cy={item.y}
//                       r={Math.min(38, 20 + (item.total * 1.25))}
//                       fill={getHeatColor(item.score)}
//                       filter="url(#heat-blur)"
//                       style={{ mixBlendMode: 'multiply' }}
//                     />
//                     <circle
//                       cx={item.x}
//                       cy={item.y}
//                       r={12}
//                       fill={item.score > 60 ? '#ef4444' : item.score > 35 ? '#f59e0b' : '#22c55e'}
//                       stroke="#ffffff"
//                       strokeWidth="3"
//                     />
//                     <text x={item.x} y={item.y + 40} textAnchor="middle" fontSize="12" fill="#334155" fontWeight="600">
//                       {item.id}
//                     </text>
//                   </g>
//                 ))}
//               </svg>
//             )}

//             {heatLegend()}
//           </div>
//         </div>

//         <div className="card" style={{ padding: 20 }}>
//           <div style={{ marginBottom: 14 }}>
//             <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>Geo Map</h3>
//           </div>

//           <div style={{ height: 430, borderRadius: 16, overflow: 'hidden', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
//             <iframe
//               title="Geo Map"
//               src="https://www.openstreetmap.org/export/embed.html?bbox=77.15%2C28.58%2C77.28%2C28.64&layer=mapnik"
//               style={{ width: '100%', height: '100%', border: 0 }}
//             />
//           </div>
//         </div>
//       </div>

//       <div className="card" style={{ marginTop: 20, padding: 20 }}>
//         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
//           <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>Site overview</h3>
//           <span style={{ fontSize: 12, color: '#64748b' }}>{filteredRestrooms.length} live locations</span>
//         </div>

//         <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
//           {sites.map((site) => (
//             <div key={site.id} style={{ padding: 16, borderRadius: 12, border: '1px solid #e2e8f0', background: '#f8fafc' }}>
//               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
//                 <div style={{ fontWeight: 700, color: '#0f172a' }}>{site.name}</div>
//                 <span style={{ width: 10, height: 10, borderRadius: '50%', background: statusColors[site.status], display: 'inline-block' }} />
//               </div>
//               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
//                 <div>
//                   <div style={{ fontSize: 11, color: '#64748b' }}>Restrooms</div>
//                   <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{site.restrooms}</div>
//                 </div>
//                 <div>
//                   <div style={{ fontSize: 11, color: '#64748b' }}>Status</div>
//                   <div style={{ fontSize: 12, fontWeight: 700, color: statusColors[site.status] }}>{site.status}</div>
//                 </div>
//               </div>
//             </div>
//           ))}
//         </div>
//       </div>

//       <div className="card" style={{ marginTop: 20, padding: 20 }}>
//         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
//           <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>Selected restroom</h3>
//         </div>

//         {selectedRestroom ? (
//           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
//             <div style={{ padding: 14, borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
//               <div style={{ fontSize: 11, color: '#64748b' }}>Restroom</div>
//               <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{selectedRestroom.name}</div>
//             </div>
//             <div style={{ padding: 14, borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
//               <div style={{ fontSize: 11, color: '#64748b' }}>Floor</div>
//               <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{selectedRestroom.floor}</div>
//             </div>
//             <div style={{ padding: 14, borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
//               <div style={{ fontSize: 11, color: '#64748b' }}>Feedback</div>
//               <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{selectedRestroom.total}</div>
//             </div>
//             <div style={{ padding: 14, borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
//               <div style={{ fontSize: 11, color: '#64748b' }}>Issue score</div>
//               <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{selectedRestroom.score}%</div>
//             </div>
//           </div>
//         ) : (
//           <div style={{ color: '#64748b' }}>Select a restroom on the heat map to view details</div>
//         )}
//       </div>
//     </div>
//   )
// }
import { useEffect, useMemo, useCallback, useRef, useState } from 'react'
import { io } from 'socket.io-client'

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  useMap,
} from 'react-leaflet'

import L from 'leaflet'
import { useAuth } from '../hooks/useAuth'
import 'leaflet/dist/leaflet.css'

/*
|--------------------------------------------------------------------------
| API
|--------------------------------------------------------------------------
*/

const API_URL =
  import.meta.env.VITE_API_URL ||
  'http://localhost:5000'

import { floorPlanAPI } from '../services/api'

/*
|--------------------------------------------------------------------------
| Period filters
|--------------------------------------------------------------------------
*/

const periods = [
  {
    key: 'today',
    label: 'Today',
  },
  {
    key: 'week',
    label: 'This Week',
  },
  {
    key: 'month',
    label: 'This Month',
  },
]

/*
|--------------------------------------------------------------------------
| Default geographic location
|--------------------------------------------------------------------------
*/

const DEFAULT_CENTER = [
  18.5204,
  73.8567,
]

/*
|--------------------------------------------------------------------------
| Default floor-plan positions
|--------------------------------------------------------------------------
*/

const defaultPositions = {
  'restroom-1': {
    x: 205,
    y: 145,
  },

  'restroom-2': {
    x: 795,
    y: 145,
  },

  'restroom-3': {
    x: 850,
    y: 365,
  },

  'restroom-4': {
    x: 205,
    y: 365,
  },

  'restroom-5': {
    x: 365,
    y: 270,
  },

  'restroom-6': {
    x: 635,
    y: 270,
  },
}

/*
|--------------------------------------------------------------------------
| Status colors
|--------------------------------------------------------------------------
*/

const statusColors = {
  operational: '#10b981',
  online: '#10b981',
  healthy: '#10b981',

  cleaning: '#3b82f6',
  'cleaning in progress': '#3b82f6',

  maintenance: '#f59e0b',
  'needs attention': '#f59e0b',
  needs_attention: '#f59e0b',

  offline: '#ef4444',
  critical: '#ef4444',
  issue: '#ef4444',
}

/*
|--------------------------------------------------------------------------
| Get normalized status
|--------------------------------------------------------------------------
*/

function normalizeStatus(status) {
  return String(
    status || ''
  )
    .toLowerCase()
    .replace(/_/g, ' ')
}

/*
|--------------------------------------------------------------------------
| Get status color
|--------------------------------------------------------------------------
*/

function getStatusColor(status) {
  const normalized =
    normalizeStatus(status)

  return (
    statusColors[
      normalized
    ] || '#64748b'
  )
}

/*
|--------------------------------------------------------------------------
| Get heat color
|--------------------------------------------------------------------------
*/

function getHeatColor(score) {
  const value =
    Number(score) || 0

  if (value >= 75) {
    return '#ef4444'
  }

  if (value >= 50) {
    return '#f97316'
  }

  if (value >= 25) {
    return '#eab308'
  }

  return '#22c55e'
}

/*
|--------------------------------------------------------------------------
| Get severity label
|--------------------------------------------------------------------------
*/

function getSeverityLabel(score) {
  const value =
    Number(score) || 0

  if (value >= 75) {
    return 'Critical'
  }

  if (value >= 50) {
    return 'High'
  }

  if (value >= 25) {
    return 'Moderate'
  }

  return 'Healthy'
}

/*
|--------------------------------------------------------------------------
| Create Leaflet icon
|--------------------------------------------------------------------------
*/

function createGeoIcon(color) {
  return L.divIcon({
    className:
      'custom-restroom-marker',

    html: `
      <div
        style="
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: ${color};
          border: 4px solid white;
          box-shadow: 0 3px 12px rgba(15,23,42,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 9px;
          font-weight: 700;
        "
      >
        WC
      </div>
    `,

    iconSize: [
      32,
      32,
    ],

    iconAnchor: [
      16,
      16,
    ],

    popupAnchor: [
      0,
      -16,
    ],
  })
}

/*
|--------------------------------------------------------------------------
| Map controller
|--------------------------------------------------------------------------
*/

function GeoMapController({
  locations,
}) {
  const map = useMap()

  useEffect(() => {
    const validLocations =
      locations.filter(
        (item) =>
          Number.isFinite(
            Number(
              item.latitude
            )
          ) &&
          Number.isFinite(
            Number(
              item.longitude
            )
          )
      )

    if (
      validLocations.length ===
      0
    ) {
      map.setView(
        DEFAULT_CENTER,
        13
      )

      return
    }

    const coordinates =
      validLocations.map(
        (item) => [
          Number(
            item.latitude
          ),
          Number(
            item.longitude
          ),
        ]
      )

    if (
      coordinates.length ===
      1
    ) {
      map.setView(
        coordinates[0],
        15
      )

      return
    }

    const bounds =
      L.latLngBounds(
        coordinates
      )

    map.fitBounds(
      bounds,
      {
        padding: [
          50,
          50,
        ],
      }
    )
  }, [
    locations,
    map,
  ])

  return null
}

/*
|--------------------------------------------------------------------------
| Main Component
|--------------------------------------------------------------------------
*/

export default function SideMap() {
  const { user } = useAuth()
  const canEdit = user?.role !== 'viewer'

  /*
  |--------------------------------------------------------------------------
  | State
  |--------------------------------------------------------------------------
  */

  const [period, setPeriod] =
    useState('today')

  const [siteFilter, setSiteFilter] =
    useState('all')

  const [restroomData, setRestroomData] =
    useState([])

  const [sites, setSites] =
    useState([])

  const [selectedRestroom, setSelectedRestroom] =
    useState(null)

  const [loading, setLoading] =
    useState(true)

  const [selectedFloorId, setSelectedFloorId] =
    useState('')

  const [floorPlans, setFloorPlans] = // eslint-disable-line no-unused-vars
    useState([])

  const [activeFloorPlan, setActiveFloorPlan] =
    useState(null)

  const [editMode, setEditMode] =
    useState(false)

  const [uploadError, setUploadError] =
    useState(null)

  const fileInputRef =
    useRef(null)

  const mapContainerRef =
    useRef(null)

  const floorPlanRef =
    useRef(null)

  const dragRef =
    useRef({
      active: false,
      type: null,
      startX: 0,
      startY: 0,
      startLeft: 0,
      startTop: 0,
      startWidth: 0,
      startHeight: 0,
      target: null,
      startDeviceX: 0,
      startDeviceY: 0,
      lastX: 0,
      lastY: 0,
    })

  const [interactionMode, setInteractionMode] =
    useState('view')

  const [selectedDeviceForPlacement, setSelectedDeviceForPlacement] =
    useState(null)

  const [drawingRestroom, setDrawingRestroom] =
    useState(null)

  const [drawnRestrooms, setDrawnRestrooms] =
    useState([])

  const [tempMarker, setTempMarker] =
    useState(null)

  const [pendingRestroomRect, setPendingRestroomRect] =
    useState(null)

  const [showRestroomModal, setShowRestroomModal] =
    useState(false)

  const [newRestroomName, setNewRestroomName] =
    useState('')

  const [placeDeviceMode, setPlaceDeviceMode] =
    useState(false)

  const [showDevicePicker, setShowDevicePicker] =
    useState(false)

  const [pickerPosition, setPickerPosition] =
    useState({ x: 0, y: 0 })

  /*
  |--------------------------------------------------------------------------
  | Load heatmap data
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    const token =
      localStorage.getItem(
        'srfs_token'
      )

    async function loadHeatMap() {
      setLoading(true)

      try {
        const response =
          await fetch(
            `${API_URL}/api/dashboard/heatmap?period=${period}`,
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          )

        if (!response.ok) {
          throw new Error(
            'Failed to load heatmap'
          )
        }

        const data =
          await response.json()

        const rooms =
          (
            data.restrooms ||
            []
          ).map(
            (item, index) => {
              const fallback =
                defaultPositions[
                  item.id
                ] || {
                  x:
                    150 +
                    ((index *
                      140) %
                      700),

                  y:
                    145 +
                    (Math.floor(
                      index /
                        4
                    ) *
                      180),
                }

              const total =
                Number(
                  item.total
                ) || 0

              const unhappy =
                Number(
                  item.unhappy
                ) || 0

              /*
              |--------------------------------------------------------------------------
              | If backend doesn't provide score,
              | calculate it from unhappy feedback.
              |--------------------------------------------------------------------------
              */

              const calculatedScore =
                item.score !==
                undefined
                  ? Number(
                      item.score
                    )
                  : total > 0
                    ? Math.round(
                        (unhappy /
                          total) *
                          100
                      )
                    : 0

              return {
                ...item,

                id:
                  item.id ||
                  `restroom-${index + 1}`,

                x:
                  item.x ??
                  fallback.x,

                y:
                  item.y ??
                  fallback.y,

                score:
                  calculatedScore,

                total,

                happy:
                  Number(
                    item.happy
                  ) || 0,

                okay:
                  Number(
                    item.okay
                  ) || 0,

                unhappy,

                alerts:
                  Number(
                    item.alerts
                  ) || 0,

                battery:
                  item.battery ??
                  null,

                deviceStatus:
                  item.deviceStatus ||
                  item.device_status ||
                  item.status ||
                  'online',

                status:
                  item.status ||
                  getSeverityLabel(
                    calculatedScore
                  ),

                lastFeedback:
                  item.lastFeedback ||
                  item.last_feedback ||
                  null,

                lastCleaning:
                  item.lastCleaning ||
                  item.last_cleaning ||
                  null,
              }
            }
          )

        setRestroomData(
          rooms
        )

        setSites(
          data.sites || []
        )

        setSelectedRestroom(
          (previous) => {
            if (!previous) {
              return (
                rooms[0] ||
                null
              )
            }

            return (
              rooms.find(
                (room) =>
                  room.id ===
                  previous.id
              ) ||
              rooms[0] ||
              null
            )
          }
        )
      } catch (error) {
        console.error(
          'Heat map error:',
          error
        )
      } finally {
        setLoading(false)
      }
    }

    loadHeatMap()

    /*
    |--------------------------------------------------------------------------
    | Socket.IO
    |--------------------------------------------------------------------------
    */

    const socket = io(
      API_URL,
      {
        auth: {
          token,
        },

        transports: [
          'websocket',
        ],
      }
    )

    socket.on(
      'connect',
      () => {
        console.log(
          'Heat map socket connected'
        )
      }
    )

    /*
    |--------------------------------------------------------------------------
    | New feedback
    |--------------------------------------------------------------------------
    */

    socket.on(
      'new-feedback',
      (feedback) => {
        setRestroomData(
          (previous) =>
            previous.map(
              (item) => {
                if (
                  item.id !==
                  feedback.restroomId
                ) {
                  return item
                }

                const type =
                  feedback.feedbackType

                const updated = {
                  ...item,

                  total:
                    item.total +
                    1,

                  happy:
                    item.happy +
                    (type ===
                    'happy'
                      ? 1
                      : 0),

                  okay:
                    item.okay +
                    (type ===
                    'okay'
                      ? 1
                      : 0),

                  unhappy:
                    item.unhappy +
                    (type ===
                      'unhappy' ||
                      type ===
                        'needs_cleaning' ||
                      type ===
                        'emergency'
                      ? 1
                      : 0),

                  lastFeedback:
                    feedback.timestamp ||
                    new Date().toISOString(),

                  battery:
                    feedback.battery ??
                    item.battery,
                }

                /*
                |--------------------------------------------------------------------------
                | Recalculate issue score
                |--------------------------------------------------------------------------
                */

                const negative =
                  updated.unhappy

                const score =
                  updated.total >
                  0
                    ? Math.round(
                        (negative /
                          updated.total) *
                          100
                      )
                    : 0

                return {
                  ...updated,

                  score,

                  status:
                    score >=
                    75
                      ? 'critical'
                      : score >=
                          50
                        ? 'needs_attention'
                        : 'operational',
                }
              }
            )
        )
      }
    )

    /*
    |--------------------------------------------------------------------------
    | New alert
    |--------------------------------------------------------------------------
    */

    socket.on(
      'new-alert',
      (alert) => {
        setRestroomData(
          (previous) =>
            previous.map(
              (item) =>
                item.id ===
                alert.restroomId
                  ? {
                      ...item,

                      alerts:
                        item.alerts +
                        1,

                      status:
                        'critical',
                    }
                  : item
            )
        )
      }
    )

    return () => {
      socket.disconnect()
    }
  }, [period])

  /*
  |--------------------------------------------------------------------------
  | Load floor plans for selected floor
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    async function loadFloorPlans() {
      if (!selectedFloorId) {
        setFloorPlans([])
        setActiveFloorPlan(null)
        return
      }

      try {
        const data = await floorPlanAPI.getByFloor(selectedFloorId)
        const plans = data.floorPlans || []
        setFloorPlans(plans)
        setActiveFloorPlan((prev) => {
          if (prev && plans.some((p) => p.id === prev.id)) return prev
          const plan = plans[0] || null
          return plan ? { ...plan, scale: 1 } : null
        })
      } catch (error) {
        console.error('Floor plans load error:', error)
      }
    }

    loadFloorPlans()
  }, [selectedFloorId])

   /*
  |--------------------------------------------------------------------------
  | Filtered restrooms
  |--------------------------------------------------------------------------
  */

  const filteredRestrooms =
    useMemo(() => {
      if (
        siteFilter ===
        'all'
      ) {
        return restroomData
      }

      return restroomData.filter(
        (room) =>
          room.site ===
            siteFilter ||
          room.location ===
            siteFilter
      )
    }, [
      restroomData,
      siteFilter,
    ])

  /*
  |--------------------------------------------------------------------------
  | Available floors for selector
  |--------------------------------------------------------------------------
  */

  const availableFloors =
    useMemo(() => {
      const floorMap = new Map()
      filteredRestrooms.forEach((room) => {
        if (room.floorId && room.floor) {
          floorMap.set(room.floorId, { id: room.floorId, floorName: room.floor })
        }
      })
      return Array.from(floorMap.values())
    }, [filteredRestrooms])

  /*
  |--------------------------------------------------------------------------
  | Auto-select first available floor
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    if (!selectedFloorId && availableFloors.length > 0) {
      setSelectedFloorId(availableFloors[0].id)
    }
  }, [availableFloors, selectedFloorId])

  /*
  |--------------------------------------------------------------------------
  | Update device position in local data
  |--------------------------------------------------------------------------
  */

  function updateDevicePositionInData(deviceId, x, y) {
    setRestroomData((prev) =>
      prev.map((room) => ({
        ...room,
        devices: (room.devices || []).map((d) =>
          d.id === deviceId ? { ...d, floorPlanPosX: x, floorPlanPosY: y } : d
        ),
      }))
    )
  }

  /*
  |--------------------------------------------------------------------------
  | Save active floor plan
  |--------------------------------------------------------------------------
  */

  const saveActiveFloorPlan = useCallback(async () => {
    if (!activeFloorPlan) return
    try {
      const data = await floorPlanAPI.update(activeFloorPlan.id, {
        posX: Math.round(activeFloorPlan.posX),
        posY: Math.round(activeFloorPlan.posY),
        width: Math.round(activeFloorPlan.width),
        height: Math.round(activeFloorPlan.height),
      })
      setActiveFloorPlan((prev) => (prev ? { ...data.floorPlan, scale: prev.scale || 1 } : prev))
      setFloorPlans((prev) =>
        prev.map((p) => (p.id === data.floorPlan.id ? data.floorPlan : p))
      )
    } catch (error) {
      console.error('Save floor plan error:', error)
    }
  }, [activeFloorPlan])

  /*
  |--------------------------------------------------------------------------
  | Save device position
  |--------------------------------------------------------------------------
  */

  const saveDevicePosition = useCallback(async (deviceId, x, y) => {
    try {
      await floorPlanAPI.updateDevicePosition(deviceId, Math.round(x), Math.round(y))
    } catch (error) {
      console.error('Save device position error:', error)
    }
  }, [])

  /*
  |--------------------------------------------------------------------------
  | Document-level drag handlers
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    function handleMouseMove(e) {
      const state = dragRef.current
      if (!state.active) return

      if (state.type === 'plan') {
        const dx = e.clientX - state.startX
        const dy = e.clientY - state.startY
        setActiveFloorPlan((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            posX: Math.max(0, state.startLeft + dx),
            posY: Math.max(0, state.startTop + dy),
          }
        })
      } else if (state.type === 'resize') {
        const dx = e.clientX - state.startX
        const dy = e.clientY - state.startY
        const scale = activeFloorPlan?.scale || 1
        setActiveFloorPlan((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            width: Math.max(100, state.startWidth + dx / scale),
            height: Math.max(100, state.startHeight + dy / scale),
          }
        })
      }
    }

    function handleMouseUp() {
      const state = dragRef.current
      if (!state.active) return

      if (state.type === 'plan' || state.type === 'resize') {
        saveActiveFloorPlan()
      }

      dragRef.current = {
        active: false,
        type: null,
        startX: 0,
        startY: 0,
        startLeft: 0,
        startTop: 0,
        startWidth: 0,
        startHeight: 0,
        target: null,
        startDeviceX: 0,
        startDeviceY: 0,
        lastX: 0,
        lastY: 0,
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [activeFloorPlan, saveActiveFloorPlan, saveDevicePosition])

  useEffect(() => {
    function handleMouseMove(e) {
      if (!drawingRestroom || !floorPlanRef.current) return
      const { x, y } = getBaseCoords(e)
      setDrawingRestroom((prev) => ({ ...prev, endX: x, endY: y }))
    }

    function handleMouseUp(e) {
      if (!drawingRestroom || !floorPlanRef.current) {
        setDrawingRestroom(null)
        return
      }

      const { x, y } = getBaseCoords(e)

      const left = Math.min(drawingRestroom.startX, x)
      const top = Math.min(drawingRestroom.startY, y)
      const width = Math.abs(x - drawingRestroom.startX)
      const height = Math.abs(y - drawingRestroom.startY)

      if (width > 20 && height > 20) {
        setPendingRestroomRect({ x: left, y: top, width, height })
        setShowRestroomModal(true)
      }

      setDrawingRestroom(null)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [drawingRestroom])

  function getBaseCoords(e) {
    if (!floorPlanRef.current || !activeFloorPlan) return { x: 0, y: 0 }
    const rect = floorPlanRef.current.getBoundingClientRect()
    const scale = activeFloorPlan.scale || 1
    return {
      x: Math.max(0, Math.min((e.clientX - rect.left) / scale, activeFloorPlan.width)),
      y: Math.max(0, Math.min((e.clientY - rect.top) / scale, activeFloorPlan.height)),
    }
  }

  function handleWheel(e) {
    if (!activeFloorPlan) return
    e.preventDefault()
    e.stopPropagation()
    const rect = floorPlanRef.current.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    const oldScale = activeFloorPlan.scale || 1
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1
    const newScale = Math.min(Math.max(oldScale * zoomFactor, 0.5), 4)
    const scaleChange = newScale / oldScale
    const newPosX = mouseX - (mouseX - activeFloorPlan.posX) * scaleChange
    const newPosY = mouseY - (mouseY - activeFloorPlan.posY) * scaleChange
    setActiveFloorPlan((prev) => (prev ? { ...prev, scale: newScale, posX: newPosX, posY: newPosY } : prev))
  }

  useEffect(() => {
    const el = floorPlanRef.current
    if (!el || !activeFloorPlan) return
    const onWheel = (e) => handleWheel(e)
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [activeFloorPlan, handleWheel])

  /*
  |--------------------------------------------------------------------------
  | Floor plan drag handlers
  |--------------------------------------------------------------------------
  */

  function handlePlanMouseDown(e) {
    if (!activeFloorPlan) return
    e.preventDefault()
    e.stopPropagation()
    dragRef.current = {
      active: true,
      type: 'plan',
      startX: e.clientX,
      startY: e.clientY,
      startLeft: activeFloorPlan.posX,
      startTop: activeFloorPlan.posY,
      startWidth: activeFloorPlan.width,
      startHeight: activeFloorPlan.height,
      target: null,
    }
  }

  function handleResizeMouseDown(e) {
    if (!editMode || !activeFloorPlan) return
    e.preventDefault()
    e.stopPropagation()
    dragRef.current = {
      active: true,
      type: 'resize',
      startX: e.clientX,
      startY: e.clientY,
      startLeft: activeFloorPlan.posX,
      startTop: activeFloorPlan.posY,
      startWidth: activeFloorPlan.width,
      startHeight: activeFloorPlan.height,
      target: null,
    }
  }

  function isPointInRestroom(x, y, restroom) {
    return (
      x >= restroom.x &&
      x <= restroom.x + restroom.width &&
      y >= restroom.y &&
      y <= restroom.y + restroom.height
    )
  }

  function findRestroomAtPoint(x, y) {
    for (let i = drawnRestrooms.length - 1; i >= 0; i--) {
      if (isPointInRestroom(x, y, drawnRestrooms[i])) {
        return drawnRestrooms[i]
      }
    }
    return null
  }

  function handleFloorPlanMouseDown(e) {
    if (!activeFloorPlan) return
    if (interactionMode === 'draw-restroom') {
      e.preventDefault()
      e.stopPropagation()
      const { x, y } = getBaseCoords(e)
      setDrawingRestroom({ startX: x, startY: y, endX: x, endY: y })
    }
  }

  function handleCombinedMouseDown(e) {
    if (interactionMode === 'draw-restroom') {
      handleFloorPlanMouseDown(e)
    } else if (interactionMode === 'place-device') {
      // Let click handler place the device
    } else {
      handlePlanMouseDown(e)
    }
  }

  function handleFloorPlanMouseMove(e) {
    if (!drawingRestroom || !floorPlanRef.current) return
    const { x, y } = getBaseCoords(e)
    setDrawingRestroom((prev) => ({ ...prev, endX: x, endY: y }))
  }

  function handleFloorPlanMouseUp(e) {
    if (!drawingRestroom || !floorPlanRef.current) {
      setDrawingRestroom(null)
      return
    }

    const { x, y } = getBaseCoords(e)

    const left = Math.min(drawingRestroom.startX, x)
    const top = Math.min(drawingRestroom.startY, y)
    const width = Math.abs(x - drawingRestroom.startX)
    const height = Math.abs(y - drawingRestroom.startY)

    if (width > 20 && height > 20) {
      setPendingRestroomRect({ x: left, y: top, width, height })
      setShowRestroomModal(true)
    }

    setDrawingRestroom(null)
  }

  async function handleCreateRestroom(name) {
    if (!pendingRestroomRect || !activeFloorPlan || !selectedFloorId) return

    const restroomData = {
      x: pendingRestroomRect.x,
      y: pendingRestroomRect.y,
      width: pendingRestroomRect.width,
      height: pendingRestroomRect.height,
      name: name || `Restroom ${drawnRestrooms.length + 1}`,
    }

    try {
      const data = await floorPlanAPI.createRestroom({
        floorId: selectedFloorId,
        name: restroomData.name,
        organizationId: user?.organizationId || '',
      })
      setDrawnRestrooms((prev) => [...prev, { ...restroomData, id: data.restroom.id, restroomId: data.restroom.id }])
    } catch (error) {
      console.error('Create restroom error:', error)
      setDrawnRestrooms((prev) => [...prev, { ...restroomData, id: `local-${Date.now()}`, restroomId: null }])
    }

    setPendingRestroomRect(null)
    setShowRestroomModal(false)
    setInteractionMode('view')
  }

  function handleDeviceSelectForPlacement(device) {
    setSelectedDeviceForPlacement(device)
    setInteractionMode('place-device')
    setPlaceDeviceMode(false)
    setShowDevicePicker(false)
    setTempMarker(null)
  }

  function handleFloorPlanClick(e) {
    if (!activeFloorPlan || !floorPlanRef.current) return

    const { x, y } = getBaseCoords(e)

    if (interactionMode === 'place-device' && selectedDeviceForPlacement) {
      const relX = Math.round(Math.max(0, Math.min(x, activeFloorPlan.width)))
      const relY = Math.round(Math.max(0, Math.min(y, activeFloorPlan.height)))

      const restroom = findRestroomAtPoint(relX, relY)

      saveDevicePosition(selectedDeviceForPlacement.id, relX, relY)
      if (restroom) {
        floorPlanAPI.updateDevicePosition(selectedDeviceForPlacement.id, relX, relY, restroom.restroomId)
      } else {
        floorPlanAPI.updateDevicePosition(selectedDeviceForPlacement.id, relX, relY, null)
      }

      updateDevicePositionInData(selectedDeviceForPlacement.id, relX, relY)

      setSelectedDeviceForPlacement(null)
      setInteractionMode('view')
      setTempMarker(null)
    } else if (placeDeviceMode) {
      const relX = Math.round(Math.max(0, Math.min(x, activeFloorPlan.width)))
      const relY = Math.round(Math.max(0, Math.min(y, activeFloorPlan.height)))
      setPickerPosition({ x: relX, y: relY })
      setShowDevicePicker(true)
      setTempMarker({ x: relX, y: relY })
    }
  }

  function handleDevicePickerSelect(device) {
    if (!device) {
      setShowDevicePicker(false)
      setTempMarker(null)
      return
    }

    const { x, y } = pickerPosition
    const restroom = findRestroomAtPoint(x, y)

    saveDevicePosition(device.id, x, y)
    if (restroom) {
      floorPlanAPI.updateDevicePosition(device.id, x, y, restroom.restroomId)
    } else {
      floorPlanAPI.updateDevicePosition(device.id, x, y, null)
    }

    updateDevicePositionInData(device.id, x, y)
    setShowDevicePicker(false)
    setTempMarker(null)
    setPlaceDeviceMode(false)
  }

  function cancelInteraction() {
    setInteractionMode('view')
    setSelectedDeviceForPlacement(null)
    setDrawingRestroom(null)
    setTempMarker(null)
    setPlaceDeviceMode(false)
    setShowDevicePicker(false)
    setShowRestroomModal(false)
    setPendingRestroomRect(null)
  }

  /*
  |--------------------------------------------------------------------------
  | File upload handler
  |--------------------------------------------------------------------------
  */

  /*
  |--------------------------------------------------------------------------
  | File upload handler
  |--------------------------------------------------------------------------
  */

  function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      const img = new Image()
      img.onload = async () => {
        const maxDim = 1200
        let { width, height } = img
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width)
            width = maxDim
          } else {
            width = Math.round((width * maxDim) / height)
            height = maxDim
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        const imageData = canvas.toDataURL('image/jpeg', 0.7)

        try {
          const data = await floorPlanAPI.create({
            floorId: selectedFloorId,
            name: file.name,
            imageData,
            width: 400,
            height: 300,
            posX: 50,
            posY: 50,
          })
          setFloorPlans((prev) => [data.floorPlan, ...prev])
          setActiveFloorPlan({ ...data.floorPlan, scale: 1 })
          setUploadError(null)
        } catch (error) {
          console.error('Upload floor plan error:', error)
          setUploadError(error.message || 'Failed to upload floor plan')
        }
      }
      img.src = event.target.result
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  /*
  |--------------------------------------------------------------------------
  | Delete floor plan
  |--------------------------------------------------------------------------
  */

  async function handleDeleteFloorPlan() {
    if (!activeFloorPlan) return
    try {
      await floorPlanAPI.delete(activeFloorPlan.id)
      setFloorPlans((prev) => prev.filter((p) => p.id !== activeFloorPlan.id))
      setActiveFloorPlan(null)
    } catch (error) {
      console.error('Delete floor plan error:', error)
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Flatten devices from filtered restrooms
  |--------------------------------------------------------------------------
  */

  const floorDevices =
    useMemo(() => {
      const devices = []
      filteredRestrooms.forEach((room) => {
        if (selectedFloorId && room.floorId !== selectedFloorId) return
        if (room.devices && room.devices.length > 0) {
          room.devices.forEach((device) => {
            devices.push({
              ...device,
              restroomName: room.name,
              restroomId: room.id,
              score: room.score,
            })
          })
        }
      })
      return devices
    }, [filteredRestrooms, selectedFloorId])

  /*
  |--------------------------------------------------------------------------
  | Summary statistics
  |--------------------------------------------------------------------------
  */

  const statistics =
    useMemo(() => {
      const total =
        filteredRestrooms.length

      const healthy =
        filteredRestrooms.filter(
          (room) =>
            Number(
              room.score
            ) < 25
        ).length

      const attention =
        filteredRestrooms.filter(
          (room) =>
            Number(
              room.score
            ) >= 25 &&
            Number(
              room.score
            ) < 75
        ).length

      const critical =
        filteredRestrooms.filter(
          (room) =>
            Number(
              room.score
            ) >= 75
        ).length

      const alerts =
        filteredRestrooms.reduce(
          (
            sum,
            room
          ) =>
            sum +
            Number(
              room.alerts
            ),
          0
        )

      const offline =
        filteredRestrooms.filter(
          (room) =>
            normalizeStatus(
              room.deviceStatus
            ) ===
            'offline'
        ).length

      const lowBattery =
        filteredRestrooms.filter(
          (room) =>
            room.battery !==
              null &&
            Number(
              room.battery
            ) <= 20
        ).length

      const totalFeedback =
        filteredRestrooms.reduce(
          (
            sum,
            room
          ) =>
            sum +
            Number(
              room.total
            ),
          0
        )

      return {
        total,
        healthy,
        attention,
        critical,
        alerts,
        offline,
        lowBattery,
        totalFeedback,
      }
    }, [
      filteredRestrooms,
    ])

  /*
  |--------------------------------------------------------------------------
  | Critical restroom list
  |--------------------------------------------------------------------------
  */

  const criticalRestrooms =
    useMemo(() => {
      return [
        ...filteredRestrooms,
      ]
        .sort(
          (a, b) =>
            Number(
              b.score
            ) -
            Number(
              a.score
            )
        )
        .slice(0, 5)
    }, [
      filteredRestrooms,
    ])

  /*
  |--------------------------------------------------------------------------
  | Feedback percentage
  |--------------------------------------------------------------------------
  */

  function getFeedbackPercentage(
    value
  ) {
    if (
      !selectedRestroom ||
      selectedRestroom.total <=
        0
    ) {
      return 0
    }

    return Math.round(
      (Number(value) /
        selectedRestroom.total) *
        100
    )
  }

  /*
  |--------------------------------------------------------------------------
  | Format date
  |--------------------------------------------------------------------------
  */

  function formatDate(
    value
  ) {
    if (!value) {
      return '--'
    }

    const date =
      new Date(value)

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return value
    }

    return date.toLocaleString(
      'en-IN',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }
    )
  }

  /*
  |--------------------------------------------------------------------------
  | Heatmap legend
  |--------------------------------------------------------------------------
  */

  function HeatLegend() {
    return (
      <div
        style={{
          background:
            'rgba(255,255,255,0.97)',

          border:
            '1px solid #e2e8f0',

          borderRadius: 14,

          padding: 14,

          boxShadow:
            '0 10px 25px rgba(15,23,42,0.10)',
        }}
      >
        <div
          style={{
            fontSize: 12,

            fontWeight: 700,

            color: '#0f172a',

            marginBottom: 10,
          }}
        >
          Heat Intensity
        </div>

        <div
          style={{
            display: 'flex',

            flexDirection:
              'column',

            gap: 7,
          }}
        >
          <LegendItem
            color="#22c55e"
            label="Healthy"
            description="0–24%"
          />

          <LegendItem
            color="#eab308"
            label="Moderate"
            description="25–49%"
          />

          <LegendItem
            color="#f97316"
            label="High"
            description="50–74%"
          />

          <LegendItem
            color="#ef4444"
            label="Critical"
            description="75–100%"
          />
        </div>
      </div>
    )
  }

  /*
  |--------------------------------------------------------------------------
  | Legend item
  |--------------------------------------------------------------------------
  */

  function LegendItem({
    color,
    label,
    description,
  }) {
    return (
      <div
        style={{
          display:
            'flex',

          alignItems:
            'center',

          gap: 8,
        }}
      >
        <span
          style={{
            width: 10,

            height: 10,

            borderRadius:
              '50%',

            background:
              color,

            flexShrink: 0,
          }}
        />

        <span
          style={{
            fontSize: 10,

            fontWeight: 600,

            color: '#334155',
          }}
        >
          {label}
        </span>

        <span
          style={{
            marginLeft:
              'auto',

            fontSize: 9,

            color: '#94a3b8',
          }}
        >
          {description}
        </span>
      </div>
    )
  }

  /*
  |--------------------------------------------------------------------------
  | Summary card
  |--------------------------------------------------------------------------
  */

  function SummaryCard({
    title,
    value,
    subtitle,
    icon,
    accent,
  }) {
    return (
      <div
        style={{
          background:
            '#ffffff',

          border:
            '1px solid #e2e8f0',

          borderRadius: 14,

          padding: 16,

          minHeight: 105,

          boxShadow:
            '0 3px 10px rgba(15,23,42,0.04)',
        }}
      >
        <div
          style={{
            display:
              'flex',

            alignItems:
              'center',

            justifyContent:
              'space-between',
          }}
        >
          <span
            style={{
              fontSize: 11,

              fontWeight: 600,

              color: '#64748b',
            }}
          >
            {title}
          </span>

          <span
            style={{
              width: 30,

              height: 30,

              borderRadius: 9,

              background:
                `${accent}18`,

              display:
                'flex',

              alignItems:
                'center',

              justifyContent:
                'center',

              fontSize: 15,
            }}
          >
            {icon}
          </span>
        </div>

        <div
          style={{
            marginTop: 10,

            fontSize: 25,

            lineHeight: 1,

            fontWeight: 800,

            color:
              accent ||
              '#0f172a',
          }}
        >
          {value}
        </div>

        <div
          style={{
            marginTop: 7,

            fontSize: 9,

            color: '#94a3b8',
          }}
        >
          {subtitle}
        </div>
      </div>
    )
  }

  /*
  |--------------------------------------------------------------------------
  | Geo View
  |--------------------------------------------------------------------------
  */

  // eslint-disable-next-line no-unused-vars
  function renderGeoView() {
    const locations =
      filteredRestrooms.filter(
        (room) =>
          Number.isFinite(
            Number(
              room.latitude
            )
          ) &&
          Number.isFinite(
            Number(
              room.longitude
            )
          )
      )

    return (
      <div
        style={{
          position:
            'relative',

          height: 560,

          overflow:
            'hidden',

          borderRadius: 18,

          border:
            '1px solid #e2e8f0',
        }}
      >
        <MapContainer
          center={
            DEFAULT_CENTER
          }
          zoom={13}
          scrollWheelZoom={
            true
          }
          style={{
            height:
              '100%',

            width:
              '100%',
          }}
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <GeoMapController
            locations={
              locations
            }
          />

          {locations.map(
            (room) => {
              const latitude =
                Number(
                  room.latitude
                )

              const longitude =
                Number(
                  room.longitude
                )

              const color =
                getHeatColor(
                  room.score
                )

              return (
                <div
                  key={
                    room.id
                  }
                >
                  <Circle
                    center={[
                      latitude,
                      longitude,
                    ]}
                    radius={
                      Number(
                        room.score
                      ) >=
                      75
                        ? 700
                        : 450
                    }
                    pathOptions={{
                      color,

                      fillColor:
                        color,

                      fillOpacity:
                        0.16,

                      weight: 1,
                    }}
                  />

                  <Marker
                    position={[
                      latitude,
                      longitude,
                    ]}
                    icon={createGeoIcon(
                      color
                    )}
                    eventHandlers={{
                      click:
                        () =>
                          setSelectedRestroom(
                            room
                          ),
                    }}
                  >
                    <Popup>
                      <div
                        style={{
                          minWidth:
                            220,
                        }}
                      >
                        <strong
                          style={{
                            fontSize:
                              15,

                            color:
                              '#0f172a',
                          }}
                        >
                          {room.name ||
                            room.id}
                        </strong>

                        <div
                          style={{
                            marginTop:
                              8,

                            fontSize:
                              12,

                            color:
                              '#64748b',
                          }}
                        >
                          {room.site ||
                            room.location ||
                            'Site'}
                        </div>

                        <hr
                          style={{
                            border:
                              'none',

                            borderTop:
                              '1px solid #e2e8f0',

                            margin:
                              '10px 0',
                          }}
                        />

                        <div
                          style={{
                            display:
                              'grid',

                            gridTemplateColumns:
                              '1fr 1fr',

                            gap: 8,

                            fontSize:
                              11,
                          }}
                        >
                          <div>
                            Status
                            <br />
                            <strong>
                              {
                                getSeverityLabel(
                                  room.score
                                )
                              }
                            </strong>
                          </div>

                          <div>
                            Feedback
                            <br />
                            <strong>
                              {
                                room.total
                              }
                            </strong>
                          </div>

                          <div>
                            Alerts
                            <br />
                            <strong>
                              {
                                room.alerts
                              }
                            </strong>
                          </div>

                          <div>
                            Battery
                            <br />
                            <strong>
                              {room.battery ??
                                '--'}
                              {room.battery !=
                                null &&
                                '%'}
                            </strong>
                          </div>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                </div>
              )
            }
          )}
        </MapContainer>

        {locations.length ===
          0 && (
          <div
            style={{
              position:
                'absolute',

              top: 20,

              left: '50%',

              transform:
                'translateX(-50%)',

              zIndex: 1000,

              background:
                '#ffffff',

              padding:
                '10px 16px',

              borderRadius: 10,

              fontSize: 11,

              color: '#64748b',

              boxShadow:
                '0 5px 20px rgba(15,23,42,0.12)',
            }}
          >
            No geographic
            coordinates
            available.
          </div>
        )}

        <div
          style={{
            position:
              'absolute',

            left: 18,

            bottom: 18,

            zIndex: 1000,
          }}
        >
          <HeatLegend />
        </div>
      </div>
    )
  }

  /*
  |--------------------------------------------------------------------------
  | Unified Map
  |--------------------------------------------------------------------------
  */

  function renderUnifiedMap() {
    const geoLocations =
      filteredRestrooms.filter(
        (room) =>
          Number.isFinite(Number(room.latitude)) &&
          Number.isFinite(Number(room.longitude))
      )

    return (
      <div
        style={{
          position: 'relative',
          height: '100%',
          width: '100%',
        }}
        ref={mapContainerRef}
      >
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={13}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <GeoMapController locations={geoLocations} />

          {geoLocations.map((room) => {
            const latitude = Number(room.latitude)
            const longitude = Number(room.longitude)
            const color = getHeatColor(room.score)

            return (
              <div key={room.id}>
                <Circle
                  center={[latitude, longitude]}
                  radius={Number(room.score) >= 75 ? 700 : 450}
                  pathOptions={{
                    color,
                    fillColor: color,
                    fillOpacity: 0.16,
                    weight: 1,
                  }}
                />
                <Marker
                  position={[latitude, longitude]}
                  icon={createGeoIcon(color)}
                  eventHandlers={{
                    click: () => setSelectedRestroom(room),
                  }}
                >
                  <Popup>
                    <div style={{ minWidth: 220 }}>
                      <strong style={{ fontSize: 15, color: '#0f172a' }}>
                        {room.name || room.id}
                      </strong>
                      <div style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>
                        {room.site || room.location || 'Site'}
                      </div>
                      <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '10px 0' }} />
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: 8,
                          fontSize: 11,
                        }}
                      >
                        <div>
                          Status
                          <br />
                          <strong>{getSeverityLabel(room.score)}</strong>
                        </div>
                        <div>
                          Feedback
                          <br />
                          <strong>{room.total}</strong>
                        </div>
                        <div>
                          Alerts
                          <br />
                          <strong>{room.alerts}</strong>
                        </div>
                        <div>
                          Battery
                          <br />
                          <strong>
                            {room.battery != null ? `${room.battery}%` : '--'}
                          </strong>
                        </div>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              </div>
            )
          })}
        </MapContainer>

        {geoLocations.length === 0 && (
          <div
            style={{
              position: 'absolute',
              top: 20,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1000,
              background: '#ffffff',
              padding: '10px 16px',
              borderRadius: 10,
              fontSize: 11,
              color: '#64748b',
              boxShadow: '0 5px 20px rgba(15,23,42,0.12)',
            }}
          >
            No geographic coordinates available.
          </div>
        )}

        {geoLocations.length > 0 && (
          <div
            style={{
              position: 'absolute',
              left: 18,
              bottom: 18,
              zIndex: 1000,
            }}
          >
            <HeatLegend />
          </div>
        )}

        {/* Floor plan overlay */}
        {activeFloorPlan && (
          <div
            ref={floorPlanRef}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: activeFloorPlan.width,
              height: activeFloorPlan.height,
              transform: `translate(${activeFloorPlan.posX}px, ${activeFloorPlan.posY}px) scale(${activeFloorPlan.scale || 1})`,
              transformOrigin: '0 0',
              border: editMode ? '2px dashed #2563eb' : '2px solid rgba(255,255,255,0.6)',
              borderRadius: 8,
              overflow: 'hidden',
              cursor:
                interactionMode === 'draw-restroom'
                  ? 'crosshair'
                  : interactionMode === 'place-device'
                    ? 'copy'
                    : editMode
                      ? 'move'
                      : 'grab',
              zIndex: 1000,
              boxShadow: editMode
                ? '0 0 0 4px rgba(37,99,235,0.15)'
                : '0 8px 30px rgba(15,23,42,0.25)',
            }}
            onMouseDown={handleCombinedMouseDown}
            onMouseMove={handleFloorPlanMouseMove}
            onMouseUp={handleFloorPlanMouseUp}
            onClick={handleFloorPlanClick}
          >
            <img
              src={activeFloorPlan.imageData}
              alt={activeFloorPlan.name}
              draggable={false}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                pointerEvents: 'none',
                display: 'block',
              }}
            />

            {/* Edit mode overlay */}
            {editMode && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(37,99,235,0.03)',
                  pointerEvents: 'none',
                }}
              />
            )}

            {/* Drawn restrooms */}
            <svg
              viewBox={`0 0 ${activeFloorPlan.width} ${activeFloorPlan.height}`}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 1001,
              }}
            >
              {drawnRestrooms.map((room) => (
                <rect
                  key={room.id}
                  x={room.x}
                  y={room.y}
                  width={room.width}
                  height={room.height}
                  fill="rgba(34, 197, 94, 0.15)"
                  stroke="#22c55e"
                  strokeWidth="2"
                  strokeDasharray="6 3"
                />
              ))}
              {drawingRestroom && (
                <rect
                  x={Math.min(drawingRestroom.startX, drawingRestroom.endX)}
                  y={Math.min(drawingRestroom.startY, drawingRestroom.endY)}
                  width={Math.abs(drawingRestroom.endX - drawingRestroom.startX)}
                  height={Math.abs(drawingRestroom.endY - drawingRestroom.startY)}
                  fill="rgba(37, 99, 235, 0.1)"
                  stroke="#2563eb"
                  strokeWidth="2"
                  strokeDasharray="4 2"
                />
              )}
            </svg>

            {/* Temp marker for device placement */}
            {tempMarker && (
              <div
                style={{
                  position: 'absolute',
                  left: tempMarker.x,
                  top: tempMarker.y,
                  transform: 'translate(-50%, -50%)',
                  zIndex: 1003,
                  pointerEvents: 'none',
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: '#f59e0b',
                    border: '3px solid #fff',
                    boxShadow: '0 3px 12px rgba(15,23,42,0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: 8,
                    fontWeight: 700,
                  }}
                >
                  NEW
                </div>
              </div>
            )}

            {/* Device picker popup */}
            {showDevicePicker && (
              <div
                style={{
                  position: 'absolute',
                  left: Math.min(pickerPosition.x, activeFloorPlan.width - 200),
                  top: Math.min(pickerPosition.y + 10, activeFloorPlan.height - 150),
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 10,
                  boxShadow: '0 8px 30px rgba(15,23,42,0.15)',
                  zIndex: 1004,
                  padding: 8,
                  minWidth: 180,
                  maxHeight: 150,
                  overflowY: 'auto',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#334155',
                    marginBottom: 6,
                    padding: '2px 4px',
                  }}
                >
                  Select Device
                </div>
                {floorDevices.length === 0 ? (
                  <div style={{ fontSize: 10, color: '#94a3b8', padding: '4px' }}>No devices available</div>
                ) : (
                  floorDevices.map((device) => (
                    <div
                      key={device.id}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleDevicePickerSelect(device)
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 8px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        background: '#f8fafc',
                        marginBottom: 2,
                        border: '1px solid transparent',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#eff6ff'
                        e.currentTarget.style.borderColor = '#2563eb'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#f8fafc'
                        e.currentTarget.style.borderColor = 'transparent'
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: '#10b981',
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#0f172a' }}>
                          {device.badgeId || device.id}
                        </div>
                        <div style={{ fontSize: 9, color: '#94a3b8' }}>
                          {device.restroomName || '--'}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div
                  onMouseDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleDevicePickerSelect(null)
                  }}
                  style={{
                    marginTop: 4,
                    padding: '4px 8px',
                    fontSize: 9,
                    color: '#ef4444',
                    cursor: 'pointer',
                    textAlign: 'center',
                    borderRadius: 4,
                  }}
                >
                  Cancel
                </div>
              </div>
            )}

            {/* Resize handle */}
            {editMode && (
              <div
                onMouseDown={handleResizeMouseDown}
                style={{
                  position: 'absolute',
                  right: -6,
                  bottom: -6,
                  width: 18,
                  height: 18,
                  background: '#2563eb',
                  border: '2px solid #fff',
                  borderRadius: 4,
                  cursor: 'nwse-resize',
                  zIndex: 1002,
                }}
              />
            )}

            {/* Device markers */}
            {floorDevices.map((device) => {
              const dx = device.floorPlanPosX ?? 50
              const dy = device.floorPlanPosY ?? 50
              const color = getHeatColor(device.score || 0)
              const isSelected = selectedDeviceForPlacement?.id === device.id

              return (
                <div
                  key={device.id}
                  style={{
                    position: 'absolute',
                    left: dx,
                    top: dy,
                    transform: 'translate(-50%, -50%)',
                    cursor:
                      interactionMode === 'place-device'
                        ? 'pointer'
                        : 'pointer',
                    zIndex: 1001,
                    outline: isSelected ? '3px solid #2563eb' : 'none',
                    borderRadius: '50%',
                  }}
                  onClick={(e) => {
                    if (interactionMode === 'place-device') {
                      e.stopPropagation()
                      return
                    }
                    if (!editMode) {
                      setSelectedRestroom({
                        ...device,
                        name: device.restroomName || device.id,
                        floor: device.floor?.floorName || '--',
                        location: device.floor?.location?.city || '--',
                      })
                    }
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: isSelected ? '#2563eb' : color,
                      border: '3px solid #fff',
                      boxShadow: '0 3px 12px rgba(15,23,42,0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: 9,
                      fontWeight: 700,
                    }}
                  >
                    {device.badgeId?.slice(-2) || '??'}
                  </div>
                  {editMode && (
                    <div
                      style={{
                        position: 'absolute',
                        top: -18,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'rgba(15,23,42,0.85)',
                        color: '#fff',
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontSize: 9,
                        whiteSpace: 'nowrap',
                        pointerEvents: 'none',
                      }}
                    >
                      {device.restroomName || device.id}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  /*
  |--------------------------------------------------------------------------
  | Floor Plan
  |--------------------------------------------------------------------------
  */

  // eslint-disable-next-line no-unused-vars
  function renderFloorPlan() {
    return (
      <div
        style={{
          position:
            'relative',

          height: 560,

          borderRadius: 18,

          overflow:
            'hidden',

          border:
            '1px solid #e2e8f0',

          background:
            '#f8fafc',
        }}
      >
        {loading ? (
          <div
            style={{
              height:
                '100%',

              display:
                'flex',

              alignItems:
                'center',

              justifyContent:
                'center',

              color:
                '#64748b',

              fontSize: 13,
            }}
          >
            Loading floor
            plan...
          </div>
        ) : (
          <svg
            viewBox="0 0 1000 560"
            width="100%"
            height="100%"
            preserveAspectRatio="none"
          >
            <defs>
              <filter
                id="floor-shadow"
                x="-20%"
                y="-20%"
                width="140%"
                height="140%"
              >
                <feDropShadow
                  dx="0"
                  dy="5"
                  stdDeviation="7"
                  floodColor="#64748b"
                  floodOpacity="0.16"
                />
              </filter>

              <filter
                id="heat-blur"
                x="-100%"
                y="-100%"
                width="300%"
                height="300%"
              >
                <feGaussianBlur
                  stdDeviation="20"
                />
              </filter>
            </defs>

            {/* ========================================================
                FLOOR OUTLINE
            ========================================================= */}

            <path
              d="
                M 70 70
                L 930 70
                L 930 185
                L 900 185
                L 900 425
                L 930 425
                L 930 490
                L 70 490
                L 70 425
                L 100 425
                L 100 185
                L 70 185
                Z
              "
              fill="#ffffff"
              stroke="#cbd5e1"
              strokeWidth="3"
              filter="url(#floor-shadow)"
            />

            {/* ========================================================
                BAGGAGE CLAIM
            ========================================================= */}

            <path
              d="
                M 110 85
                L 890 85
                L 890 185
                L 110 185
                Z
              "
              fill="#ffffff"
              stroke="#94a3b8"
              strokeWidth="2"
            />

            <text
              x="500"
              y="115"
              textAnchor="middle"
              fontSize="17"
              fontWeight="700"
              fill="#475569"
            >
              BAGGAGE CLAIM
            </text>

            {[
              270,
              330,
              390,
              450,
              550,
              610,
              670,
              730,
            ].map(
              (x) => (
                <rect
                  key={x}
                  x={x}
                  y="125"
                  width="27"
                  height="50"
                  rx="13"
                  fill="#f1f5f9"
                  stroke="#94a3b8"
                  strokeWidth="2"
                />
              )
            )}

            {/* ========================================================
                RENTAL CAR
            ========================================================= */}

            <rect
              x="110"
              y="190"
              width="190"
              height="95"
              fill="#f8fafc"
              stroke="#94a3b8"
              strokeWidth="2"
            />

            <text
              x="205"
              y="238"
              textAnchor="middle"
              fontSize="15"
              fontWeight="700"
              fill="#64748b"
            >
              RENTAL
            </text>

            <text
              x="205"
              y="258"
              textAnchor="middle"
              fontSize="15"
              fontWeight="700"
              fill="#64748b"
            >
              CAR
            </text>

            {/* ========================================================
                TAXI
            ========================================================= */}

            <rect
              x="700"
              y="190"
              width="190"
              height="95"
              fill="#f8fafc"
              stroke="#94a3b8"
              strokeWidth="2"
            />

            <text
              x="795"
              y="238"
              textAnchor="middle"
              fontSize="15"
              fontWeight="700"
              fill="#64748b"
            >
              TAXI
            </text>

            <text
              x="795"
              y="258"
              textAnchor="middle"
              fontSize="15"
              fontWeight="700"
              fill="#64748b"
            >
              SERVICE
            </text>

            {/* ========================================================
                INFORMATION DESK
            ========================================================= */}

            <rect
              x="390"
              y="195"
              width="220"
              height="40"
              fill="#f1f5f9"
              stroke="#94a3b8"
              strokeWidth="2"
            />

            <text
              x="500"
              y="220"
              textAnchor="middle"
              fontSize="12"
              fontWeight="700"
              fill="#475569"
            >
              INFORMATION DESK
            </text>

            {/* ========================================================
                ARRIVALS HALL
            ========================================================= */}

            <rect
              x="300"
              y="245"
              width="400"
              height="175"
              fill="#ffffff"
              stroke="#cbd5e1"
              strokeWidth="2"
            />

            <text
              x="500"
              y="338"
              textAnchor="middle"
              fontSize="16"
              fontWeight="700"
              fill="#64748b"
            >
              ARRIVALS HALL
            </text>

            {/* ========================================================
                CAFE
            ========================================================= */}

            <rect
              x="110"
              y="300"
              width="190"
              height="120"
              fill="#f8fafc"
              stroke="#94a3b8"
              strokeWidth="2"
            />

            <text
              x="205"
              y="365"
              textAnchor="middle"
              fontSize="15"
              fontWeight="700"
              fill="#64748b"
            >
              CAFE
            </text>

            {/* ========================================================
                ATM
            ========================================================= */}

            <rect
              x="700"
              y="300"
              width="190"
              height="120"
              fill="#f8fafc"
              stroke="#94a3b8"
              strokeWidth="2"
            />

            <text
              x="795"
              y="365"
              textAnchor="middle"
              fontSize="15"
              fontWeight="700"
              fill="#64748b"
            >
              ATM
            </text>

            {/* ========================================================
                MAIN ENTRANCE
            ========================================================= */}

            <line
              x1="300"
              y1="440"
              x2="700"
              y2="440"
              stroke="#475569"
              strokeWidth="5"
            />

            <text
              x="500"
              y="470"
              textAnchor="middle"
              fontSize="14"
              fontWeight="700"
              fill="#475569"
            >
              MAIN ENTRANCE
            </text>

            {/* ========================================================
                RESTROOM HEATMAP
            ========================================================= */}

            {filteredRestrooms.map(
              (room) => {
                const score =
                  Number(
                    room.score
                  ) || 0

                const color =
                  getHeatColor(
                    score
                  )

                const radius =
                  Math.min(
                    78,
                    32 +
                      Number(
                        room.total
                      ) *
                        2
                  )

                const selected =
                  selectedRestroom?.id ===
                  room.id

                return (
                  <g
                    key={
                      room.id
                    }
                    onClick={() =>
                      setSelectedRestroom(
                        room
                      )
                    }
                    style={{
                      cursor:
                        'pointer',
                    }}
                  >
                    {/* Outer heat */}

                    <circle
                      cx={
                        room.x
                      }
                      cy={
                        room.y
                      }
                      r={
                        selected
                          ? radius +
                            15
                          : radius
                      }
                      fill={
                        color
                      }
                      opacity="0.32"
                      filter="url(#heat-blur)"
                    />

                    {/* Inner heat */}

                    <circle
                      cx={
                        room.x
                      }
                      cy={
                        room.y
                      }
                      r={
                        radius *
                        0.6
                      }
                      fill={
                        color
                      }
                      opacity="0.28"
                    />

                    {/* Selected ring */}

                    {selected && (
                      <circle
                        cx={
                          room.x
                        }
                        cy={
                          room.y
                        }
                        r="27"
                        fill="none"
                        stroke={
                          color
                        }
                        strokeWidth="3"
                        strokeDasharray="5 4"
                      />
                    )}

                    {/* Restroom marker */}

                    <circle
                      cx={
                        room.x
                      }
                      cy={
                        room.y
                      }
                      r="16"
                      fill={
                        color
                      }
                      stroke="#ffffff"
                      strokeWidth="4"
                    />

                    <text
                      x={
                        room.x
                      }
                      y={
                        room.y +
                        4
                      }
                      textAnchor="middle"
                      fontSize="8"
                      fontWeight="700"
                      fill="#ffffff"
                    >
                      WC
                    </text>

                    {/* Name */}

                    <text
                      x={
                        room.x
                      }
                      y={
                        room.y +
                        37
                      }
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight="700"
                      fill="#334155"
                    >
                      {room.name ||
                        room.id}
                    </text>

                    {/* Score */}

                    <text
                      x={
                        room.x
                      }
                      y={
                        room.y -
                        25
                      }
                      textAnchor="middle"
                      fontSize="9"
                      fontWeight="700"
                      fill={
                        color
                      }
                    >
                      {score}%
                    </text>
                  </g>
                )
              }
            )}
          </svg>
        )}

        {/* Floor legend */}

        <div
          style={{
            position:
              'absolute',

            left: 18,

            bottom: 18,

            zIndex: 5,
          }}
        >
          <HeatLegend />
        </div>

        {/* Map instruction */}

        <div
          style={{
            position:
              'absolute',

            top: 18,

            left: 18,

            zIndex: 5,

            background:
              'rgba(255,255,255,0.95)',

            border:
              '1px solid #e2e8f0',

            borderRadius: 10,

            padding:
              '8px 12px',

            fontSize: 10,

            color: '#64748b',
          }}
        >
          Click a restroom
          to view details
        </div>
      </div>
    )
  }

  /*
  |--------------------------------------------------------------------------
  | Selected restroom panel
  |--------------------------------------------------------------------------
  */

  function renderSelectedRestroom() {
    if (
      !selectedRestroom
    ) {
      return (
        <div
          style={{
            padding: 25,

            textAlign:
              'center',

            color:
              '#64748b',
          }}
        >
          Select a restroom
          from the map to
          view detailed
          information.
        </div>
      )
    }

    const score =
      Number(
        selectedRestroom.score
      ) || 0

    const color =
      getHeatColor(
        score
      )

    const deviceStatus =
      normalizeStatus(
        selectedRestroom.deviceStatus
      )

    return (
      <div>
        {/* Header */}

        <div
          style={{
            display:
              'flex',

            alignItems:
              'center',

            justifyContent:
              'space-between',

            gap: 15,

            marginBottom: 20,
          }}
        >
          <div>
            <div
              style={{
                display:
                  'flex',

                alignItems:
                  'center',

                gap: 9,
              }}
            >
              <span
                style={{
                  width: 12,

                  height: 12,

                  borderRadius:
                    '50%',

                  background:
                    color,
                }}
              />

              <h3
                style={{
                  margin: 0,

                  fontSize: 18,

                  fontWeight:
                    800,

                  color:
                    '#0f172a',
                }}
              >
                {selectedRestroom.name ||
                  selectedRestroom.id}
              </h3>
            </div>

            <div
              style={{
                marginTop: 5,

                fontSize: 11,

                color:
                  '#64748b',
              }}
            >
              {selectedRestroom.site ||
                selectedRestroom.location ||
                'Site'}{' '}
              ·{' '}
              {selectedRestroom.floor ||
                'Floor 1'}
            </div>
          </div>

          <div
            style={{
              padding:
                '7px 12px',

              borderRadius: 20,

              background:
                `${color}18`,

              color,

              fontSize: 11,

              fontWeight: 700,
            }}
          >
            {
              getSeverityLabel(
                score
              )
            }
          </div>
        </div>

        {/* Details */}

        <div
          style={{
            display:
              'grid',

            gridTemplateColumns:
              'repeat(auto-fit,minmax(145px,1fr))',

            gap: 12,
          }}
        >
          <DetailBox
            label="Issue Score"
            value={`${score}%`}
            color={color}
          />

          <DetailBox
            label="Total Feedback"
            value={
              selectedRestroom.total
            }
          />

          <DetailBox
            label="Active Alerts"
            value={
              selectedRestroom.alerts
            }
            color={
              selectedRestroom.alerts >
              0
                ? '#ef4444'
                : '#0f172a'
            }
          />

          <DetailBox
            label="Battery"
            value={
              selectedRestroom.battery !=
              null
                ? `${selectedRestroom.battery}%`
                : '--'
            }
            color={
              selectedRestroom.battery !=
                null &&
              selectedRestroom.battery <=
                20
                ? '#ef4444'
                : '#0f172a'
            }
          />

          <DetailBox
            label="Device"
            value={
              selectedRestroom.deviceStatus ||
              '--'
            }
            color={
              deviceStatus ===
              'offline'
                ? '#ef4444'
                : '#10b981'
            }
          />

          <DetailBox
            label="Last Feedback"
            value={formatDate(
              selectedRestroom.lastFeedback
            )}
            small
          />
        </div>

        {/* Feedback breakdown */}

        <div
          style={{
            marginTop: 20,

            padding: 16,

            borderRadius: 12,

            background:
              '#f8fafc',

            border:
              '1px solid #e2e8f0',
          }}
        >
          <div
            style={{
              fontSize: 12,

              fontWeight: 700,

              color:
                '#334155',

              marginBottom: 14,
            }}
          >
            Feedback Breakdown
          </div>

          <FeedbackBar
            label="Happy"
            value={
              selectedRestroom.happy
            }
            percentage={getFeedbackPercentage(
              selectedRestroom.happy
            )}
            color="#10b981"
          />

          <FeedbackBar
            label="Okay"
            value={
              selectedRestroom.okay
            }
            percentage={getFeedbackPercentage(
              selectedRestroom.okay
            )}
            color="#eab308"
          />

          <FeedbackBar
            label="Unhappy"
            value={
              selectedRestroom.unhappy
            }
            percentage={getFeedbackPercentage(
              selectedRestroom.unhappy
            )}
            color="#ef4444"
          />
        </div>

        {/* Cleaning information */}

        <div
          style={{
            display:
              'grid',

            gridTemplateColumns:
              '1fr 1fr',

            gap: 12,

            marginTop: 12,
          }}
        >
          <InfoRow
            label="Last Cleaning"
            value={formatDate(
              selectedRestroom.lastCleaning
            )}
          />

          <InfoRow
            label="Device Status"
            value={
              selectedRestroom.deviceStatus ||
              'Online'
            }
          />
        </div>
      </div>
    )
  }

  /*
  |--------------------------------------------------------------------------
  | Detail box
  |--------------------------------------------------------------------------
  */

  function DetailBox({
    label,
    value,
    color,
    small,
  }) {
    return (
      <div
        style={{
          padding: 13,

          borderRadius: 11,

          background:
            '#ffffff',

          border:
            '1px solid #e2e8f0',
        }}
      >
        <div
          style={{
            fontSize: 9,

            color:
              '#94a3b8',

            marginBottom: 6,
          }}
        >
          {label}
        </div>

        <div
          style={{
            fontSize:
              small
                ? 11
                : 17,

            fontWeight:
              700,

            color:
              color ||
              '#0f172a',

            lineHeight:
              small
                ? 1.4
                : 1.1,
          }}
        >
          {value}
        </div>
      </div>
    )
  }

  /*
  |--------------------------------------------------------------------------
  | Feedback bar
  |--------------------------------------------------------------------------
  */

  function FeedbackBar({
    label,
    value,
    percentage,
    color,
  }) {
    return (
      <div
        style={{
          marginBottom: 11,
        }}
      >
        <div
          style={{
            display:
              'flex',

            justifyContent:
              'space-between',

            marginBottom: 5,

            fontSize: 10,
          }}
        >
          <span
            style={{
              color:
                '#475569',

              fontWeight:
                600,
            }}
          >
            {label}
          </span> 

          <span
            style={{
              color:
                '#64748b',
            }}
          >
            {value} ·{' '}
            {percentage}%
          </span>
        </div>

        <div
          style={{
            height: 7,

            borderRadius: 10,

            background:
              '#e2e8f0',

            overflow:
              'hidden',
          }}
        >
          <div
            style={{
              width:
                `${percentage}%`,

              height:
                '100%',

              background:
                color,

              borderRadius:
                10,
            }}
          />
        </div>
      </div>
    )
  }

  /*
  |--------------------------------------------------------------------------
  | Info row
  |--------------------------------------------------------------------------
  */

  function InfoRow({
    label,
    value,
  }) {
    return (
      <div
        style={{
          padding: 12,

          borderRadius: 10,

          background:
            '#f8fafc',

          border:
            '1px solid #e2e8f0',
        }}
      >
        <div
          style={{
            fontSize: 9,

            color:
              '#94a3b8',

            marginBottom: 5,
          }}
        >
          {label}
        </div>

        <div
          style={{
            fontSize: 11,

            fontWeight: 600,

            color:
              '#334155',
          }}
        >
          {value}
        </div>
      </div>
    )
  }

  /*
  |--------------------------------------------------------------------------
  | Render
  |--------------------------------------------------------------------------
  */

  return (
    <div className="page">
      {/* Restroom name modal */}
      {showRestroomModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.5)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowRestroomModal(false)
              setPendingRestroomRect(null)
              setInteractionMode('view')
            }
          }}
        >
          <div
            style={{
              background: '#fff',
              padding: 24,
              borderRadius: 16,
              boxShadow: '0 20px 60px rgba(15,23,42,0.25)',
              width: 360,
              maxWidth: '90vw',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                margin: '0 0 8px',
                fontSize: 16,
                fontWeight: 800,
                color: '#0f172a',
              }}
            >
              Name This Restroom
            </h3>
            <p
              style={{
                margin: '0 0 16px',
                fontSize: 11,
                color: '#64748b',
              }}
            >
              Enter a name for the restroom you just drew on the floor plan.
            </p>
            <input
              autoFocus
              value={newRestroomName}
              onChange={(e) => setNewRestroomName(e.target.value)}
              placeholder="e.g. Restroom 1"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreateRestroom(newRestroomName)
                  setNewRestroomName('')
                }
              }}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #cbd5e1',
                borderRadius: 8,
                fontSize: 13,
                outline: 'none',
                marginBottom: 12,
              }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  setShowRestroomModal(false)
                  setPendingRestroomRect(null)
                  setInteractionMode('view')
                  setNewRestroomName('')
                }}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  color: '#475569',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  handleCreateRestroom(newRestroomName)
                  setNewRestroomName('')
                }}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: '1px solid #2563eb',
                  background: '#2563eb',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Save Restroom
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interaction mode banner */}
      {(interactionMode === 'draw-restroom' || interactionMode === 'place-device') && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            background: '#0f172a',
            color: '#fff',
            padding: '10px 20px',
            borderRadius: 12,
            boxShadow: '0 10px 40px rgba(15,23,42,0.35)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          <span>
            {interactionMode === 'draw-restroom'
              ? 'Click and drag on the floor plan to draw a restroom'
              : selectedDeviceForPlacement
                ? `Click on the floor plan to place ${selectedDeviceForPlacement.badgeId || selectedDeviceForPlacement.id}`
                : 'Click on the floor plan to select a device location'}
          </span>
          <button
            type="button"
            onClick={cancelInteraction}
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.3)',
              background: 'rgba(255,255,255,0.1)',
              color: '#fff',
              fontSize: 10,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* ================================================================
          HEADER
      ================================================================= */}

      {/* ================================================================
          UNIFIED MAP TOOLBAR
      ================================================================= */}

      {/* <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 18,
          padding: 14,
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 13,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>Floor</span>
          <select
            value={selectedFloorId}
            onChange={(e) => setSelectedFloorId(e.target.value)}
            style={{
              minWidth: 170,
              padding: '8px 12px',
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              background: '#ffffff',
              color: '#334155',
              fontSize: 11,
              outline: 'none',
            }}
          >
            <option value="">All Floors</option>
            {availableFloors.map((floor) => (
              <option key={floor.id} value={floor.id}>
                {floor.floorName}
              </option>
            ))}
          </select>

          {canEdit && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={!selectedFloorId}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: '1px solid #2563eb',
                background: selectedFloorId ? '#2563eb' : '#94a3b8',
                color: '#fff',
                fontSize: 11,
                fontWeight: 700,
                cursor: selectedFloorId ? 'pointer' : 'not-allowed',
                opacity: selectedFloorId ? 1 : 0.7,
              }}
            >
              + Upload Floor Plan
            </button>
          )}

          {uploadError && canEdit && (
            <div
              style={{
                fontSize: 10,
                color: '#ef4444',
                background: '#fef2f2',
                padding: '4px 8px',
                borderRadius: 6,
                border: '1px solid #fecaca',
              }}
            >
              {uploadError}
            </div>
          )}

          {canEdit && (
            <button
              type="button"
              onClick={() => setEditMode((prev) => !prev)}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: editMode ? '1px solid #ef4444' : '1px solid #cbd5e1',
                background: editMode ? '#fef2f2' : '#f8fafc',
                color: editMode ? '#ef4444' : '#475569',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {editMode ? '✓ Done Editing' : '✎ Edit Layout'}
            </button>
          )}

          {canEdit && activeFloorPlan && editMode && (
            <button
              type="button"
              onClick={handleDeleteFloorPlan}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: '1px solid #ef4444',
                background: '#fff',
                color: '#ef4444',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Delete Plan
            </button>
          )}
        </div>

        <div style={{ fontSize: 10, color: '#64748b' }}>
          {activeFloorPlan
            ? `Plan: ${activeFloorPlan.name}`
            : 'No floor plan loaded'}
        </div>
      </div> */}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        style={{ display: 'none' }}
      />

      {/* ================================================================
          FILTERS
      ================================================================= */}

      <div
        style={{
          display:
            'flex',

          alignItems:
            'center',

          justifyContent:
            'space-between',

          flexWrap:
            'wrap',

          gap: 15,

          padding: 15,

          marginBottom: 18,

          background:
            '#ffffff',

          border:
            '1px solid #e2e8f0',

          borderRadius: 13,
        }}
      >
        <div
          style={{
            display:
              'flex',

            alignItems:
              'center',

            gap: 8,
          }}
        >
          <span
            style={{
              fontSize: 11,

              fontWeight: 700,

              color:
                '#475569',
            }}
          >
            Site
          </span>

          <select
            value={
              siteFilter
            }
            onChange={(e) =>
              setSiteFilter(
                e.target.value
              )
            }
            style={{
              minWidth: 170,

              padding:
                '8px 12px',

              border:
                '1px solid #cbd5e1',

              borderRadius: 8,

              background:
                '#ffffff',

              color:
                '#334155',

              fontSize: 11,

              outline: 'none',
            }}
          >
            <option value="all">
              All Sites
            </option>

            {sites.map(
              (site) => (
                <option
                  key={
                    site.id ||
                    site.name
                  }
                  value={
                    site.name
                  }
                >
                  {site.name}
                </option>
              )
            )}
          </select>
        </div>

        <div
          style={{
            display:
              'flex',

            gap: 5,
          }}
        >
          {periods.map(
            (item) => (
              <button
                key={
                  item.key
                }
                type="button"
                onClick={() =>
                  setPeriod(
                    item.key
                  )
                }
                style={{
                  border:
                    '1px solid #dbeafe',

                  background:
                    period ===
                    item.key
                      ? '#2563eb'
                      : '#f8fafc',

                  color:
                    period ===
                    item.key
                      ? '#ffffff'
                      : '#475569',

                  padding:
                    '8px 12px',

                  borderRadius: 8,

                  fontSize: 10,

                  fontWeight: 700,

                  cursor:
                    'pointer',
                }}
              >
                {
                  item.label
                }
              </button>
            )
          )}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 18,
          padding: 14,
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 13,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>Floor</span>
          <select
            value={selectedFloorId}
            onChange={(e) => setSelectedFloorId(e.target.value)}
            style={{
              minWidth: 170,
              padding: '8px 12px',
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              background: '#ffffff',
              color: '#334155',
              fontSize: 11,
              outline: 'none',
            }}
          >
            <option value="">All Floors</option>
            {availableFloors.map((floor) => (
              <option key={floor.id} value={floor.id}>
                {floor.floorName}
              </option>
            ))}
          </select>

          {canEdit && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={!selectedFloorId}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: '1px solid #2563eb',
                background: selectedFloorId ? '#2563eb' : '#94a3b8',
                color: '#fff',
                fontSize: 11,
                fontWeight: 700,
                cursor: selectedFloorId ? 'pointer' : 'not-allowed',
                opacity: selectedFloorId ? 1 : 0.7,
              }}
            >
              + Upload Floor Plan
            </button>
          )}

          {uploadError && canEdit && (
            <div
              style={{
                fontSize: 10,
                color: '#ef4444',
                background: '#fef2f2',
                padding: '4px 8px',
                borderRadius: 6,
                border: '1px solid #fecaca',
              }}
            >
              {uploadError}
            </div>
          )}

          {canEdit && (
            <button
              type="button"
              onClick={() => setEditMode((prev) => !prev)}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: editMode ? '1px solid #ef4444' : '1px solid #cbd5e1',
                background: editMode ? '#fef2f2' : '#f8fafc',
                color: editMode ? '#ef4444' : '#475569',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {editMode ? '✓ Done Editing' : '✎ Edit Layout'}
            </button>
          )}

          {canEdit && activeFloorPlan && editMode && (
            <button
              type="button"
              onClick={handleDeleteFloorPlan}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: '1px solid #ef4444',
                background: '#fff',
                color: '#ef4444',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Delete Plan
            </button>
          )}
        </div>

        <div style={{ fontSize: 10, color: '#64748b' }}>
          {activeFloorPlan
            ? `Plan: ${activeFloorPlan.name}`
            : 'No floor plan loaded'}
        </div>
      </div>


      {/* ================================================================
          SUMMARY CARDS
      ================================================================= */}

      <div
        style={{
          display:
            'grid',

          gridTemplateColumns:
            'repeat(auto-fit,minmax(150px,1fr))',

          gap: 12,

          marginBottom: 20,
        }}
      >
        <SummaryCard
          title="Total Restrooms"
          value={
            statistics.total
          }
          subtitle="Monitored locations"
          icon="🚻"
          accent="#2563eb"
        />

        <SummaryCard
          title="Healthy"
          value={
            statistics.healthy
          }
          subtitle="Low issue score"
          icon="✓"
          accent="#10b981"
        />

        <SummaryCard
          title="Needs Attention"
          value={
            statistics.attention
          }
          subtitle="Moderate / high issues"
          icon="⚠"
          accent="#f59e0b"
        />

        <SummaryCard
          title="Critical"
          value={
            statistics.critical
          }
          subtitle="Immediate attention"
          icon="!"
          accent="#ef4444"
        />

        <SummaryCard
          title="Active Alerts"
          value={
            statistics.alerts
          }
          subtitle="Requires action"
          icon="🔔"
          accent="#ef4444"
        />

        <SummaryCard
          title="Offline Devices"
          value={
            statistics.offline
          }
          subtitle={`${statistics.lowBattery} low battery`}
          icon="📡"
          accent="#64748b"
        />
      </div>

      {/* ================================================================
          MAP + CRITICAL PANEL
      ================================================================= */}

      <div
        style={{
          display:
            'grid',

          gridTemplateColumns:
            '200px 1fr 285px',

          gap: 18,

          alignItems:
            'start',
        }}
      >

        {/* ============================================================
            TOOLS PANEL
        ============================================================= */}

        <div
          style={{
            background:
              '#ffffff',

            border:
              '1px solid #e2e8f0',

            borderRadius: 16,

            padding: 14,

            position:
              'sticky',

            top: 16,
          }}
        >
          <div
            style={{
              fontSize: 11,

              fontWeight: 800,

              color: '#0f172a',

              marginBottom: 12,
            }}
          >
            Tools
          </div>

          <div
            style={{
              display:
                'flex',

              flexDirection:
                'column',

              gap: 6,
            }}
          >
            <button
              type="button"
              onClick={() => {
                if (interactionMode === 'draw-restroom') {
                  cancelInteraction()
                } else {
                  setInteractionMode('draw-restroom')
                  setPlaceDeviceMode(false)
                  setSelectedDeviceForPlacement(null)
                  setShowDevicePicker(false)
                }
              }}
              style={{
                display: 'flex',

                alignItems:
                  'center',

                gap: 8,

                padding: '10px 12px',

                borderRadius: 10,

                border:
                  interactionMode === 'draw-restroom'
                    ? '1px solid #2563eb'
                    : '1px solid #e2e8f0',

                background:
                  interactionMode === 'draw-restroom'
                    ? '#eff6ff'
                    : '#f8fafc',

                color:
                  interactionMode === 'draw-restroom'
                    ? '#2563eb'
                    : '#334155',

                fontSize: 11,

                fontWeight: 700,

                cursor: 'pointer',
              }}
            >
              <span
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  background: interactionMode === 'draw-restroom' ? '#2563eb' : '#e2e8f0',
                  color: interactionMode === 'draw-restroom' ? '#fff' : '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                +
              </span>
              Restroom
            </button>

            <button
              type="button"
              onClick={() => {
                if (placeDeviceMode) {
                  cancelInteraction()
                } else {
                  setPlaceDeviceMode(true)
                  setInteractionMode('place-device')
                  setSelectedDeviceForPlacement(null)
                  setShowDevicePicker(false)
                }
              }}
              style={{
                display: 'flex',

                alignItems:
                  'center',

                gap: 8,

                padding: '10px 12px',

                borderRadius: 10,

                border:
                  placeDeviceMode
                    ? '1px solid #2563eb'
                    : '1px solid #e2e8f0',

                background:
                  placeDeviceMode
                    ? '#eff6ff'
                    : '#f8fafc',

                color:
                  placeDeviceMode
                    ? '#2563eb'
                    : '#334155',

                fontSize: 11,

                fontWeight: 700,

                cursor: 'pointer',
              }}
            >
              <span
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  background: placeDeviceMode ? '#2563eb' : '#e2e8f0',
                  color: placeDeviceMode ? '#fff' : '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                ◆
              </span>
              Place Device
            </button>
          </div>

          {/* Restroom list */}
          <div
            style={{
              marginTop: 16,

              paddingTop: 12,

              borderTop:
                '1px solid #e2e8f0',
            }}
          >
            <div
              style={{
                fontSize: 10,

                fontWeight: 700,

                color: '#64748b',

                marginBottom: 8,
              }}
            >
              Drawn Restrooms
            </div>

            {drawnRestrooms.length === 0 ? (
              <div
                style={{
                  fontSize: 10,

                  color: '#94a3b8',

                  textAlign: 'center',

                  padding: '8px 0',
                }}
              >
                None yet
              </div>
            ) : (
              <div
                style={{
                  display:
                    'flex',

                  flexDirection:
                    'column',

                  gap: 4,
                }}
              >
                {drawnRestrooms.map((room) => (
                  <div
                    key={room.id}
                    style={{
                      display: 'flex',

                      alignItems:
                        'center',

                      gap: 6,

                      padding: '6px 8px',

                      borderRadius: 6,

                      background: '#f8fafc',

                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 3,
                        background: '#22c55e',
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 10,

                        fontWeight: 600,

                        color: '#334155',

                        flex: 1,

                        overflow: 'hidden',

                        textOverflow:
                          'ellipsis',

                        whiteSpace:
                          'nowrap',
                      }}
                    >
                      {room.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick legend */}
          <div
            style={{
              marginTop: 12,

              paddingTop: 10,

              borderTop:
                '1px solid #e2e8f0',
            }}
          >
            <div
              style={{
                fontSize: 10,

                fontWeight: 700,

                color: '#64748b',

                marginBottom: 6,
              }}
            >
              Legend
            </div>
            <div
              style={{
                display:
                  'flex',

                flexDirection:
                  'column',

                gap: 4,
              }}
            >
              <div
                style={{
                  display:
                    'flex',

                  alignItems:
                    'center',

                  gap: 6,

                  fontSize: 9,

                  color: '#475569',
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 3,
                    background: 'rgba(34,197,94,0.3)',
                    border: '1px solid #22c55e',
                  }}
                />
                Restroom area
              </div>
              <div
                style={{
                  display:
                    'flex',

                  alignItems:
                    'center',

                  gap: 6,

                  fontSize: 9,

                  color: '#475569',
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: getHeatColor(0),
                  }}
                />
                Device
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================
            MAP
        ============================================================= */}

        <div
          style={{
            background:
              '#ffffff',

            border:
              '1px solid #e2e8f0',

            borderRadius: 16,

            padding: 16,

            position:
              'relative',
          }}
        >
          <div
            style={{
              display:
                'flex',

              justifyContent:
                'space-between',

              alignItems:
                'center',

              marginBottom: 14,
            }}
          >
            <div>
              <h3
                style={{
                  margin: 0,

                  fontSize: 17,

                  fontWeight: 800,

                  color:
                    '#0f172a',
                }}
              >
                Unified Site Map
              </h3>

              <p
                style={{
                  margin:
                    '4px 0 0',

                  fontSize: 10,

                  color:
                    '#94a3b8',
                }}
              >
                Geo map with floor plan overlay and device placement
              </p>
            </div>

            <div
              style={{
                fontSize: 10,

                color:
                  '#64748b',
              }}
            >
              {statistics.totalFeedback}{' '}
              feedback
            </div>
          </div>

          <div
            style={{
              position:
                'relative',

              height: 560,

              borderRadius: 18,

              overflow:
                'hidden',

              border:
                '1px solid #e2e8f0',
            }}
          >
            {renderUnifiedMap()}
          </div>
        </div>

        {/* ============================================================
            CRITICAL PANEL
        ============================================================= */}

        <div
          style={{
            background:
              '#ffffff',

            border:
              '1px solid #e2e8f0',

            borderRadius: 16,

            padding: 16,
          }}
        >
          <div
            style={{
              display:
                'flex',

              alignItems:
                'center',

              justifyContent:
                'space-between',

              marginBottom: 14,
            }}
          >
            <div>
              <h3
                style={{
                  margin: 0,

                  fontSize: 15,

                  fontWeight: 800,

                  color:
                    '#0f172a',
                }}
              >
                Critical Restrooms
              </h3>

              <div
                style={{
                  marginTop: 3,

                  fontSize: 9,

                  color:
                    '#94a3b8',
                }}
              >
                Highest issue score
              </div>
            </div>

            <span
              style={{
                width: 28,

                height: 28,

                borderRadius: 8,

                background:
                  '#fef2f2',

                display:
                  'flex',

                alignItems:
                  'center',

                justifyContent:
                  'center',
              }}
            >
              🚨
            </span>
          </div>

          {criticalRestrooms.length ===
          0 ? (
            <div
              style={{
                padding:
                  '25px 10px',

                textAlign:
                  'center',

                color:
                  '#94a3b8',

                fontSize: 11,
              }}
            >
              No restroom
              data available.
            </div>
          ) : (
            <div
              style={{
                display:
                  'flex',

                flexDirection:
                  'column',

                gap: 9,
              }}
            >
              {criticalRestrooms.map(
                (room) => {
                  const score =
                    Number(
                      room.score
                    ) || 0

                  const color =
                    getHeatColor(
                      score
                    )

                  const isSelected =
                    selectedRestroom?.id ===
                    room.id

                  return (
                    <button
                      key={
                        room.id
                      }
                      type="button"
                      onClick={() =>
                        setSelectedRestroom(
                          room
                        )
                      }
                      style={{
                        textAlign:
                          'left',

                        width:
                          '100%',

                        border:
                          isSelected
                            ? `1px solid ${color}`
                            : '1px solid #e2e8f0',

                        background:
                          isSelected
                            ? `${color}08`
                            : '#ffffff',

                        borderRadius: 10,

                        padding: 11,

                        cursor:
                          'pointer',
                      }}
                    >
                      <div
                        style={{
                          display:
                            'flex',

                          alignItems:
                            'center',

                          gap: 8,
                        }}
                      >
                        <span
                          style={{
                            width: 9,

                            height: 9,

                            borderRadius:
                              '50%',

                            background:
                              color,

                            flexShrink:
                              0,
                          }}
                        />

                        <span
                          style={{
                            fontSize:
                              11,

                            fontWeight:
                              700,

                            color:
                              '#334155',

                            flex: 1,
                          }}
                        >
                          {room.name ||
                            room.id}
                        </span>

                        <span
                          style={{
                            fontSize:
                              12,

                            fontWeight:
                              800,

                            color,
                          }}
                        >
                          {score}%
                        </span>
                      </div>

                      <div
                        style={{
                          display:
                            'flex',

                          justifyContent:
                            'space-between',

                          marginTop: 7,

                          fontSize: 9,

                          color:
                            '#94a3b8',
                        }}
                      >
                        <span>
                          {room.total}{' '}
                          feedback
                        </span>

                        <span>
                          {room.alerts}{' '}
                          alerts
                        </span>
                      </div>
                    </button>
                  )
                }
              )}
            </div>
          )}

          {/* Mini device summary */}

          <div
            style={{
              marginTop: 15,

              paddingTop: 14,

              borderTop:
                '1px solid #e2e8f0',
            }}
          >
            <div
              style={{
                fontSize: 11,

                fontWeight:
                  700,

                color:
                  '#334155',

                marginBottom:
                  10,
              }}
            >
              Device Health
            </div>

            <div
              style={{
                display:
                  'grid',

                gridTemplateColumns:
                  '1fr 1fr',

                gap: 8,
              }}
            >
              <SmallStatus
                label="Online"
                value={
                  statistics.total -
                  statistics.offline
                }
                color="#10b981"
              />

              <SmallStatus
                label="Offline"
                value={
                  statistics.offline
                }
                color="#ef4444"
              />

              <SmallStatus
                label="Low Battery"
                value={
                  statistics.lowBattery
                }
                color="#f59e0b"
              />

              <SmallStatus
                label="Alerts"
                value={
                  statistics.alerts
                }
                color="#ef4444"
              />
            </div>
          </div>

          {/* Device placement panel */}

          <div
            style={{
              marginTop: 15,

              paddingTop: 14,

              borderTop:
                '1px solid #e2e8f0',
            }}
          >
            <div
              style={{
                display:
                  'flex',

                alignItems:
                  'center',

                justifyContent:
                  'space-between',

                marginBottom: 10,
              }}
            >
              <div
                style={{
                  fontSize: 11,

                  fontWeight: 700,

                  color: '#334155',
                }}
              >
                Devices
                {selectedFloorId && (
                  <span
                    style={{
                      marginLeft: 6,

                      fontSize: 9,

                      color: '#94a3b8',

                      fontWeight: 600,
                    }}
                  >
                    {floorDevices.length} on this floor
                  </span>
                )}
              </div>

              {interactionMode === 'place-device' && (
                <button
                  type="button"
                  onClick={cancelInteraction}
                  style={{
                    fontSize: 9,

                    color: '#ef4444',

                    fontWeight: 700,

                    cursor: 'pointer',

                    background: 'none',

                    border: 'none',
                  }}
                >
                  Cancel
                </button>
              )}
            </div>

            {interactionMode === 'place-device' && (
              <div
                style={{
                  fontSize: 9,

                  color: '#2563eb',

                  fontWeight: 600,

                  marginBottom: 8,

                  padding: '6px 8px',

                  background: '#eff6ff',

                  borderRadius: 6,

                  border: '1px solid #dbeafe',
                }}
              >
                {selectedDeviceForPlacement
                  ? `Selected: ${selectedDeviceForPlacement.badgeId || selectedDeviceForPlacement.id}. Click floor plan to place.`
                  : 'Select a device below, then click floor plan to place it.'}
              </div>
            )}

            <div
              style={{
                display: 'flex',

                flexDirection: 'column',

                gap: 6,

                maxHeight: 220,

                overflowY: 'auto',
              }}
            >
              {!selectedFloorId ? (
                <div
                  style={{
                    fontSize: 10,

                    color: '#94a3b8',

                    textAlign: 'center',

                    padding: '8px 0',
                  }}
                >
                  Select a floor to view devices
                </div>
              ) : floorDevices.length === 0 ? (
                <div
                  style={{
                    fontSize: 10,

                    color: '#94a3b8',

                    textAlign: 'center',

                    padding: '8px 0',
                  }}
                >
                  No devices on this floor
                </div>
              ) : (
                floorDevices.map((device) => {
                  const hasPosition =
                    device.floorPlanPosX != null &&
                    device.floorPlanPosY != null
                  const isSelected =
                    selectedDeviceForPlacement?.id === device.id

                  return (
                    <div
                      key={device.id}
                      onClick={() => {
                        if (interactionMode === 'place-device') {
                          handleDeviceSelectForPlacement(device)
                        }
                      }}
                      style={{
                        display: 'flex',

                        alignItems: 'center',

                        gap: 8,

                        padding: '7px 9px',

                        borderRadius: 8,

                        border: isSelected
                          ? '1px solid #2563eb'
                          : hasPosition
                            ? '1px solid #e2e8f0'
                            : '1px dashed #cbd5e1',

                        background: isSelected
                          ? '#eff6ff'
                          : hasPosition
                            ? '#f8fafc'
                            : '#fffbeb',

                        cursor: interactionMode === 'place-device' ? 'pointer' : 'default',

                        userSelect: 'none',

                        outline: isSelected ? 'none' : 'none',
                      }}
                    >
                      <span
                        style={{
                          width: 8,

                          height: 8,

                          borderRadius: '50%',

                          background: hasPosition
                            ? '#10b981'
                            : '#f59e0b',

                          flexShrink: 0,
                        }}
                      />
                      <div
                        style={{
                          flex: 1,

                          minWidth: 0,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 10,

                            fontWeight: 700,

                            color: '#0f172a',

                            overflow: 'hidden',

                            textOverflow: 'ellipsis',

                            whiteSpace: 'nowrap',
                          }}
                        >
                          {device.badgeId || device.id}
                        </div>
                        <div
                          style={{
                            fontSize: 9,

                            color: '#94a3b8',

                            overflow: 'hidden',

                            textOverflow: 'ellipsis',

                            whiteSpace: 'nowrap',
                          }}
                        >
                          {device.restroomName || '--'}
                        </div>
                      </div>
                      {!hasPosition && interactionMode === 'place-device' && (
                        <span
                          style={{
                            fontSize: 8,

                            color: '#2563eb',

                            fontWeight: 700,

                            whiteSpace: 'nowrap',
                          }}
                        >
                          Place
                        </span>
                      )}
                      {!hasPosition && editMode && !interactionMode === 'place-device' && (
                        <span
                          style={{
                            fontSize: 8,

                            color: '#f59e0b',

                            fontWeight: 700,

                            whiteSpace: 'nowrap',
                          }}
                        >
                          Place
                        </span>
                      )}
                    </div>
                  )
                })
              )}
            </div>

            {canEdit && selectedFloorId && floorDevices.length > 0 && interactionMode !== 'place-device' && !editMode && (
              <div
                style={{
                  marginTop: 8,

                  fontSize: 9,

                  color: '#64748b',

                  textAlign: 'center',
                }}
              >
                Use Place Device or Edit Layout to position devices
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ================================================================
          SELECTED RESTROOM
      ================================================================= */}

      <div
        style={{
          background:
            '#ffffff',

          border:
            '1px solid #e2e8f0',

          borderRadius: 16,

          padding: 20,

          marginTop: 18,
        }}
      >
        <div
          style={{
            marginBottom: 16,
          }}
        >
          <h3
            style={{
              margin: 0,

              fontSize: 16,

              fontWeight:
                800,

              color:
                '#0f172a',
            }}
          >
            Selected Restroom
          </h3>

          <p
            style={{
              margin:
                '4px 0 0',

              fontSize: 10,

              color:
                '#94a3b8',
            }}
          >
            Detailed operational
            information
          </p>
        </div>

        {renderSelectedRestroom()}
      </div>

      {/* ================================================================
          SITE OVERVIEW
      ================================================================= */}

      {sites.length > 0 && (
        <div
          style={{
            background:
              '#ffffff',

            border:
              '1px solid #e2e8f0',

            borderRadius: 16,

            padding: 20,

            marginTop: 18,
          }}
        >
          <div
            style={{
              marginBottom: 15,
            }}
          >
            <h3
              style={{
                margin: 0,

                fontSize: 16,

                fontWeight:
                  800,

                color:
                  '#0f172a',
              }}
            >
              Site Overview
            </h3>

            <p
              style={{
                margin:
                  '4px 0 0',

                fontSize: 10,

                color:
                  '#94a3b8',
              }}
            >
              Current health
              across monitored
              locations
            </p>
          </div>

          <div
            style={{
              display:
                'grid',

              gridTemplateColumns:
                'repeat(auto-fit,minmax(180px,1fr))',

              gap: 12,
            }}
          >
            {sites.map(
              (site) => {
                const siteRooms =
                  restroomData.filter(
                    (room) =>
                      room.site ===
                        site.name ||
                      room.location ===
                        site.name
                  )

                const siteCritical =
                  siteRooms.filter(
                    (room) =>
                      Number(
                        room.score
                      ) >= 75
                  ).length

                const siteAlerts =
                  siteRooms.reduce(
                    (
                      sum,
                      room
                    ) =>
                      sum +
                      Number(
                        room.alerts
                      ),
                    0
                  )

                return (
                  <div
                    key={
                      site.id ||
                      site.name
                    }
                    style={{
                      padding: 14,

                      border:
                        '1px solid #e2e8f0',

                      borderRadius:
                        12,

                      background:
                        '#f8fafc',
                    }}
                  >
                    <div
                      style={{
                        display:
                          'flex',

                        alignItems:
                          'center',

                        justifyContent:
                          'space-between',

                        marginBottom:
                          10,
                      }}
                    >
                      <span
                        style={{
                          fontSize:
                            12,

                          fontWeight:
                            700,

                          color:
                            '#334155',
                        }}
                      >
                        {
                          site.name
                        }
                      </span>

                      <span
                        style={{
                          width: 9,

                          height: 9,

                          borderRadius:
                            '50%',

                          background:
                            siteCritical >
                            0
                              ? '#ef4444'
                              : '#10b981',
                        }}
                      />
                    </div>

                    <div
                      style={{
                        display:
                          'grid',

                        gridTemplateColumns:
                          '1fr 1fr 1fr',

                        gap: 8,
                      }}
                    >
                      <SiteMetric
                        label="Restrooms"
                        value={
                          siteRooms.length ||
                          site.restrooms ||
                          0
                        }
                      />

                      <SiteMetric
                        label="Critical"
                        value={
                          siteCritical
                        }
                      />

                      <SiteMetric
                        label="Alerts"
                        value={
                          siteAlerts
                        }
                      />
                    </div>
                  </div>
                )
              }
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/*
|--------------------------------------------------------------------------
| Small status
|--------------------------------------------------------------------------
*/

function SmallStatus({
  label,
  value,
  color,
}) {
  return (
    <div
      style={{
        padding: 9,

        borderRadius: 8,

        background:
          '#f8fafc',
      }}
    >
      <div
        style={{
          fontSize: 9,

          color:
            '#94a3b8',
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: 3,

          fontSize: 15,

          fontWeight:
            800,

          color,
        }}
      >
        {value}
      </div>
    </div>
  )
}

/*
|--------------------------------------------------------------------------
| Site metric
|--------------------------------------------------------------------------
*/

function SiteMetric({
  label,
  value,
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 8,

          color:
            '#94a3b8',
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: 3,

          fontSize: 14,

          fontWeight:
            800,

          color:
            '#334155',
        }}
      >
        {value}
      </div>
    </div>
  )
}