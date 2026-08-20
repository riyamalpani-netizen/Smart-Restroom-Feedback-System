import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ImageOverlay, MapContainer, Marker, Polygon, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useAuth } from '../hooks/useAuth'
import { deviceAPI, floorAPI, floorPlanAPI, locationAPI, zoneAPI, gatewayAPI, restroomAPI } from '../services/api'
import './SiteConfiguration.css'
import './SiteConfigurationOverrides.css'
import './SiteConfigurationFloorStep.css'
import './SiteConfigurationZones.css'
import './SiteConfigurationDrawing.css'
import './SiteConfigurationTheme.css'
import './SiteConfigurationPreview.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const DEFAULT_CENTER = [30.7333, 76.7794]
const ZONE_COLORS = { restroom: '#38bdf8', corridor: '#94a3b8', lobby: '#34d399', maintenance: '#fbbf24', other: '#a78bfa' }
const TYPE_META = {
  badge: { icon: '◉', label: 'Badge', color: '#8b5cf6' },
  device: { icon: '▣', label: 'Device', color: '#38bdf8' },
  gateway: { icon: '⌁', label: 'Gateway', color: '#f59e0b' },
  restroom: { icon: '🚻', label: 'Restroom', color: '#0ea5e9' },
}

const steps = [
  ['Define Site', 'Name & location'],
  ['Floor Plans', 'Setup floor images'],
  ['Position Floor Plan', 'Place image on map'],
  ['Draw Zones', 'Polygon zone mapping'],
  ['Place Devices', 'Pin devices on map'],
  ['Place Gateways', 'Pin gateways on map'],
  ['Review', 'Review & finalize'],
]

function divIcon(type, label) {
  const meta = TYPE_META[type] || TYPE_META.device
  const labelHtml = label ? `<span class="planner-marker__label">${label}</span>` : ''
  return L.divIcon({
    className: 'planner-marker',
    iconSize: [34, 34],
    iconAnchor: [17, 32],
    html: `<span style="--marker:${meta.color}">${meta.icon}</span>${labelHtml}`,
  })
}

function MapZoomControl({ onZoomIn, onZoomOut }) {
  const map = useMap()
  const [zoom, setZoom] = useState(map.getZoom())
  
  useEffect(() => {
    const updateZoom = () => setZoom(map.getZoom())
    map.on('zoomend', updateZoom)
    return () => { map.off('zoomend', updateZoom) }
  }, [map])
  
  return (
    <div className="planner-map-zoom">
      <button type="button" className="planner-zoom-btn" onClick={onZoomIn ?? (() => map.zoomIn())} title="Zoom in">＋</button>
      <span className="planner-zoom-level">{zoom}</span>
      <button type="button" className="planner-zoom-btn" onClick={onZoomOut ?? (() => map.zoomOut())} title="Zoom out">−</button>
    </div>
  )
}

function MapClick({ onClick }) {
  useMapEvents({ click: (e) => onClick?.(e.latlng) })
  return null
}

function MapMouseTracker({ onMouseMove }) {
  useMapEvents({ mousemove: (e) => onMouseMove?.(e.latlng) })
  return null
}

function MapFocus({ center, zoom = 16 }) {
  const map = useMap()
  const centerRef = useRef(center)
  const zoomRef = useRef(zoom)
  const mapRef = useRef(map)

  mapRef.current = map
  zoomRef.current = zoom

  useEffect(() => {
    const prev = centerRef.current
    const next = center
    if (!prev || !next) return
    const latChanged = prev[0] !== next[0]
    const lngChanged = prev[1] !== next[1]
    if (latChanged || lngChanged) {
      mapRef.current.setView(next, zoomRef.current)
    }
    centerRef.current = next
  }, [center])

  return null
}

function MapCursor({ children }) {
  const map = useMap()
  const container = map.getContainer()
  useEffect(() => {
    if (children) {
      container.style.cursor = children
    } else {
      container.style.cursor = ''
    }
    return () => { container.style.cursor = '' }
  }, [map, container, children])
  return null
}

function PlacementPreview({ position, type }) {
  if (!position) return null
  const meta = TYPE_META[type] || TYPE_META.device
  return (
    <Marker
      position={position}
      icon={L.divIcon({
        className: 'planner-preview-marker',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        html: `<div style="width:40px;height:40px;border-radius:50%;background:${meta.color}22;border:2px solid ${meta.color};display:grid;place-items:center;color:${meta.color};font-size:18px;font-weight:700;animation:planner-pulse 1.5s infinite">${meta.icon}</div>`,
      })}
    />
  )
}

function SitePin({ location, onLocationChange }) {
  if (!Number.isFinite(location?.latitude) || !Number.isFinite(location?.longitude)) return null
  return (
    <Marker
      position={[location.latitude, location.longitude]}
      icon={L.divIcon({ className: 'planner-site-pin', iconSize: [40, 48], iconAnchor: [20, 48], html: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ef4444" width="40" height="48"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5" fill="#fff"/></svg>' }) }
      draggable
      eventHandlers={{
        dragend: (e) => {
          const pos = e.target.getLatLng()
          onLocationChange?.(pos.lat, pos.lng)
        },
      }}
    />
  )
}

function PreviewPanel({ title, children, empty }) {
  return (
    <div className="planner-preview-panel">
      <div className="planner-preview-panel__header">
        <h3>{title}</h3>
        <span className="planner-preview-panel__badge">Live preview</span>
      </div>
      <div className="planner-preview-panel__body">
        {empty ? <div className="planner-preview-panel__empty">{empty}</div> : children}
      </div>
    </div>
  )
}

function PreviewMap({ center, zoom = 15, site, bounds, planImage, zones = [], height = '180px' }) {
  const mapCenter = center || DEFAULT_CENTER
  return (
    <div className="planner-preview-map" style={{ height }}>
      <MapContainer center={mapCenter} zoom={zoom} className="planner-map-container" scrollWheelZoom={false} dragging={false} doubleClickZoom={false} zoomControl={false}>
        <MapFocus center={mapCenter} zoom={zoom} />
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="" />
        {site && <SitePin location={site} />}
        {bounds && planImage && <ImageOverlay bounds={bounds} url={planImage} opacity={0.55} />}
        {zones.map((zone) => {
          const raw = zone.coordinates
          let ring
          if (!raw) return null
          if (typeof raw === 'string') {
            try { const p = JSON.parse(raw); ring = p?.coordinates?.[0] || p } catch { return null }
          } else if (Array.isArray(raw)) {
            ring = raw
          } else {
            ring = raw.coordinates?.[0]
          }
          if (!ring || !Array.isArray(ring)) return null
          const positions = ring.map((pt) => Array.isArray(pt) && pt.length >= 2 ? [Number(pt[1]), Number(pt[0])] : null).filter(Boolean)
          if (!positions.length) return null
          return <Polygon key={zone.id} positions={positions} color={ZONE_COLORS[zone.type] || ZONE_COLORS.other} fillColor={ZONE_COLORS[zone.type] || ZONE_COLORS.other} fillOpacity={0.25} />
        })}
      </MapContainer>
    </div>
  )
}

function DeleteButton({ onClick, label = 'Remove' }) {
  return (
    <button type="button" className="planner-button planner-button--danger planner-button--icon" onClick={onClick} title={label} aria-label={label}>
      ✕
    </button>
  )
}

function Stepper({ currentStep, setCurrentStep }) {
  return (
    <nav className="planner-stepper" aria-label="Site planner steps">
      {steps.map(([title, subtitle], index) => {
        const n = index + 1
        const done = n < currentStep
        return (
          <button
            className={`planner-step ${n === currentStep ? 'is-active' : ''} ${done ? 'is-done' : ''}`}
            key={title}
            onClick={() => setCurrentStep(n)}
          >
            <span className="planner-step__number">{done ? '✓' : n}</span>
            <span><strong>{title}</strong><small>{subtitle}</small></span>
          </button>
        )
      })}
    </nav>
  )
}

function FloorSidebar({ floors, floor, onSelect, onAdd, onDelete }) {
  return (
    <aside className="planner-step-layout__sidebar">
      <div className="planner-sidebar__heading">
        <strong>Floors</strong>
        <button type="button" className="planner-button" onClick={onAdd}>+ Add Floor</button>
      </div>
      {floors.length ? floors.map((item) => (
        <div key={item.id} className="planner-floor-row">
          <button type="button" className={`planner-floor ${floor?.id === item.id ? 'is-selected' : ''}`} onClick={() => onSelect(item)}>
            <span>{item.floorNumber ?? '—'}</span>
            {item.floorName}
          </button>
          <DeleteButton label={`Delete ${item.floorName}`} onClick={() => onDelete(item.id)} />
        </div>
      )) : (
        <div className="planner-empty">
          No floors yet.
          <button type="button" onClick={onAdd}>+ Add your first floor</button>
        </div>
      )}
    </aside>
  )
}

function CenterPicker({ initial, onCancel, onSave }) {
  const [selected, setSelected] = useState(initial || null)
  const [focus, setFocus] = useState(initial || DEFAULT_CENTER)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])

  async function searchLocation() {
    if (!query.trim()) return
    try {
      const token = localStorage.getItem('srfs_token')
      const headers = {}
      if (token) headers.Authorization = `Bearer ${token}`
      const response = await fetch(`${API_URL}/api/locations/search?q=${encodeURIComponent(query)}`, { headers })
      if (!response.ok) { setResults([]); return }
      const data = await response.json()
      setResults(data.results || [])
    } catch { setResults([]) }
  }

  return (
    <div className="planner-modal-backdrop">
      <div className="planner-modal planner-modal--map">
        <button type="button" className="planner-modal__close" onClick={onCancel}>×</button>
        <h2>Mark site centre on the map</h2>
        <p>Search by panning and zooming, then click to place the site marker.</p>
        <div className="planner-location-search">
          <input value={query} placeholder="Search city or address, e.g. Chandigarh, India" onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && searchLocation()} />
          <button type="button" className="planner-button" onClick={searchLocation}>Search</button>
          {results.length > 0 && (
            <div className="planner-location-results">
              {results.map((result) => (
                <button type="button" key={result.place_id} onClick={() => { setFocus([Number(result.lat), Number(result.lon)]); setResults([]) }}>
                  {result.display_name}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="planner-picker-map">
          <MapContainer center={focus} zoom={initial ? 15 : 5} className="planner-map-container">
            <MapFocus center={focus} zoom={15} />
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />
            <MapClick onClick={(point) => setSelected([point.lat, point.lng])} />
            {selected && <Marker position={selected} icon={L.divIcon({ className: 'planner-site-pin', iconSize: [40, 48], iconAnchor: [20, 48], html: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ef4444" width="40" height="48"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5" fill="#fff"/></svg>' }) } />}
          </MapContainer>
        </div>
        <div className="planner-modal__footer">
          <span>{selected ? `${selected[0].toFixed(7)}, ${selected[1].toFixed(7)}` : 'No point selected yet'}</span>
          <div>
            <button type="button" className="planner-button planner-button--ghost" onClick={onCancel}>Cancel</button>
            <button type="button" className="planner-button" disabled={!selected} onClick={() => onSave(selected)}>Save</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SiteConfiguration() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const fileRef = useRef(null)
  const geoJsonRef = useRef(null)
  const [step, setStep] = useState(1)
  const [site, setSite] = useState(null)
  const [floors, setFloors] = useState([])
  const [floor, setFloor] = useState(null)
  const [plan, setPlan] = useState(null)
  const [planRotation, setPlanRotation] = useState(0)
  const [planScale, setPlanScale] = useState(1)
  const [mapZoom, setMapZoom] = useState(17)
  const [zones, setZones] = useState([])
  const [restrooms, setRestrooms] = useState([])
  const [devices, setDevices] = useState([])
  const [gateways, setGateways] = useState([])
  const [siteForm, setSiteForm] = useState({ name: '', type: '', description: '', location: '', latitude: '', longitude: '' })
  const [locations, setLocations] = useState([])
  const [selectedLocationId, setSelectedLocationId] = useState('')
  const selectedLocationIdRef = useRef('')
  const [floorForm, setFloorForm] = useState({ name: '', number: '' })
  const [zoneForm, setZoneForm] = useState({ name: '', type: 'restroom' })
  const [drawing, setDrawing] = useState(false)
  const [drawingMode, setDrawingMode] = useState('polygon')
  const [points, setPoints] = useState([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [addFloorOpen, setAddFloorOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [allDevices, setAllDevices] = useState([])
  const [allGateways, setAllGateways] = useState([])
  const [selectedDeviceId, setSelectedDeviceId] = useState(null)
  const [selectedGatewayId, setSelectedGatewayId] = useState(null)
  const [placingType, setPlacingType] = useState(null)
  const [editingZoneId, setEditingZoneId] = useState(null)
  const [editingZoneForm, setEditingZoneForm] = useState({ name: '', type: 'restroom' })
  const [editingZonePoints, setEditingZonePoints] = useState([])
  const [movingItemId, setMovingItemId] = useState(null)
  const [movingItemType, setMovingItemType] = useState(null)
  const [mousePos, setMousePos] = useState(null)

  const center = useMemo(() => Number.isFinite(site?.latitude) ? [site.latitude, site.longitude] : DEFAULT_CENTER, [site])
  const bounds = useMemo(() => {
    const b = plan?.geoBounds
    return b ? [[b.northLat, b.westLng], [b.southLat, b.eastLng]] : null
  }, [plan])
  const ready = { site: !!site, floor: !!floor, plan: !!plan }
  const progress = Math.round((step / steps.length) * 100)

  useEffect(() => {
    if (!floor) return
    Promise.all([
      floorPlanAPI.getByFloor(floor.id),
      zoneAPI.getByFloor(floor.id),
      restroomAPI.getByFloor(floor.id),
      deviceAPI.getByFloor(floor.id),
      gatewayAPI.getAll({ floorId: floor.id }),
    ])
      .then(([plans, zoneData, restroomData, deviceData, gatewayData]) => {
        const planData = plans.floorPlans?.[0] || null
        setPlan(planData)
        if (planData) {
          setPlanRotation(planData.rotation || 0)
          setPlanScale(planData.scale || 1)
        } else {
          setPlanRotation(0)
          setPlanScale(1)
        }
        setZones(zoneData.zones || [])
        setRestrooms(restroomData.restrooms || [])
        setDevices(deviceData.devices || [])
        setGateways(gatewayData.gateways || [])
        // Load all devices/gateways separately so a failure doesn't break the floor load
        loadAllDevices()
        loadAllGateways()
      })
      .catch(() => setNotice('Could not load the saved spatial configuration.'))
  }, [floor])

  useEffect(() => {
    loadLocations()
  }, [loadLocations])

  useEffect(() => {
    if (selectedLocationId) {
      loadSiteConfiguration(selectedLocationId)
    }
  }, [selectedLocationId])

  useEffect(() => {
    setSelectedDeviceId(null)
    setSelectedGatewayId(null)
    setPlacingType(null)
    setMovingItemId(null)
    setMovingItemType(null)
    setEditingZoneId(null)
    setEditingZonePoints([])
    setDrawing(false)
    setPoints([])
  }, [step])

  useEffect(() => {
    if (step === 4 && floor) {
      Promise.all([zoneAPI.getByFloor(floor.id), restroomAPI.getByFloor(floor.id)])
        .then(([zoneData, restroomData]) => {
          setZones(zoneData.zones || [])
          setRestrooms(restroomData.restrooms || [])
        })
        .catch(() => setNotice('Could not load zones for this floor.'))
    }
  }, [step, floor])

  function setCoords(coords) {
    setSiteForm((v) => ({ ...v, latitude: String(coords[0]), longitude: String(coords[1]) }))
    setPickerOpen(false)
  }

  function handleSitePinMove(lat, lng) {
    setSiteForm((v) => ({ ...v, latitude: String(lat), longitude: String(lng) }))
    if (site) {
      setSite({ ...site, latitude: lat, longitude: lng })
    }
  }

  async function loadLocations() {
    try {
      const data = await locationAPI.getAll(user?.organizationId)
      setLocations(data.locations || [])
    } catch { }
  }

  async function loadSiteConfiguration(locationId) {
    if (!locationId) return
    setBusy(true)
    try {
      const floorData = await floorAPI.getByLocation(locationId)
      const floors = floorData.floors || []
      
      if (selectedLocationIdRef.current !== locationId) return
      
      setFloors(floors)
      
      if (floors.length > 0) {
        const firstFloor = floors[0]
        setFloor(firstFloor)
        
        const [plans, zoneData, restroomData, deviceData, gatewayData] = await Promise.all([
          floorPlanAPI.getByFloor(firstFloor.id),
          zoneAPI.getByFloor(firstFloor.id),
          restroomAPI.getByFloor(firstFloor.id),
          deviceAPI.getByFloor(firstFloor.id),
          gatewayAPI.getAll({ floorId: firstFloor.id }),
        ])
        
        if (selectedLocationIdRef.current !== locationId) return
        
        const planData = plans.floorPlans?.[0] || null
        setPlan(planData)
        if (planData) {
          setPlanRotation(planData.rotation || 0)
          setPlanScale(planData.scale || 1)
        } else {
          setPlanRotation(0)
          setPlanScale(1)
        }
        setZones(zoneData.zones || [])
        setRestrooms(restroomData.restrooms || [])
        setDevices(deviceData.devices || [])
        setGateways(gatewayData.gateways || [])
      } else {
        setPlan(null)
        setZones([])
        setRestrooms([])
        setDevices([])
        setGateways([])
      }
      
      if (selectedLocationIdRef.current !== locationId) return
      
      await loadAllDevices()
      await loadAllGateways()
    } catch (error) {
      setNotice('Could not load site configuration.')
    } finally {
      setBusy(false)
    }
  }

  async function selectExistingSite(locationId) {
    setSelectedLocationId(locationId)
    selectedLocationIdRef.current = locationId
    
    if (locationId && locations.length > 0) {
      const loc = locations.find((l) => l.id === locationId)
      if (loc) {
        setSiteForm({
          name: loc.officeName || '',
          type: loc.address?.split(' — ')[0] || '',
          description: loc.address?.split(' — ').slice(1).join(' — ') || '',
          location: loc.city || '',
          latitude: String(loc.latitude || ''),
          longitude: String(loc.longitude || ''),
        })
        setSite({
          id: loc.id,
          officeName: loc.officeName,
          city: loc.city,
          address: loc.address,
          latitude: loc.latitude,
          longitude: loc.longitude,
        })
        await loadSiteConfiguration(locationId)
      }
    } else {
      setSiteForm({ name: '', type: '', description: '', location: '', latitude: '', longitude: '' })
      setSite(null)
      setFloors([])
      setFloor(null)
      setPlan(null)
      setZones([])
      setRestrooms([])
      setDevices([])
      setGateways([])
    }
  }

  async function saveSite() {
    const latitude = Number(siteForm.latitude)
    const longitude = Number(siteForm.longitude)
    const hasExistingSite = Boolean(selectedLocationId && site)
    
    if (!hasExistingSite && (!siteForm.name.trim() || !siteForm.type || !siteForm.location.trim() || !Number.isFinite(latitude) || !Number.isFinite(longitude))) {
      setNotice('Enter the site name, type, location and centre coordinates to continue, or select an existing site.')
      return
    }
    
    setBusy(true)
    try {
      let data
      if (selectedLocationId) {
        data = await locationAPI.update(selectedLocationId, {
          officeName: siteForm.name.trim(),
          city: siteForm.location.trim(),
          address: `${siteForm.type}${siteForm.description ? ` — ${siteForm.description}` : ''}`,
          latitude,
          longitude,
        })
        setNotice('Site updated. Continue to configure floors.')
      } else {
        data = await locationAPI.create({
          organizationId: user?.organizationId,
          officeName: siteForm.name.trim(),
          city: siteForm.location.trim(),
          address: `${siteForm.type}${siteForm.description ? ` — ${siteForm.description}` : ''}`,
          latitude,
          longitude,
        })
        setNotice('Site saved. Add the floors that belong to it.')
      }
      setSite(data.location)
      const floorData = await floorAPI.getByLocation(data.location.id)
      setFloors(floorData.floors || [])
      setStep(2)
    } catch (error) {
      setNotice(error.message || 'Unable to save site.')
    } finally {
      setBusy(false)
    }
  }

  async function addFloor() {
    if (!floorForm.name.trim() || floorForm.number === '') return
    setBusy(true)
    try {
      const data = await floorAPI.create({ locationId: site.id, floorName: floorForm.name.trim(), floorNumber: Number(floorForm.number) })
      setFloors((all) => [...all, data.floor])
      setFloor(data.floor)
      setFloorForm({ name: '', number: '' })
      setAddFloorOpen(false)
      setNotice(`Floor "${data.floor.floorName}" added.`)
    } catch (error) {
      setNotice(error.message || 'Unable to add floor.')
    } finally {
      setBusy(false)
    }
  }

  async function removeFloor(floorId) {
    if (!window.confirm('Delete this floor and all its plans, zones, devices, and gateways?')) return
    setBusy(true)
    try {
      await floorAPI.delete(floorId)
      const nextFloors = floors.filter((f) => f.id !== floorId)
      setFloors(nextFloors)
      if (floor?.id === floorId) {
        setFloor(nextFloors[0] || null)
        setPlan(null)
        setZones([])
        setRestrooms([])
        setDevices([])
        setGateways([])
      }
      setNotice('Floor removed.')
    } catch (error) {
      setNotice(error.message || 'Unable to delete floor.')
    } finally {
      setBusy(false)
    }
  }

  async function removePlan() {
    if (!plan || !window.confirm('Remove this floor plan image?')) return
    setBusy(true)
    try {
      await floorPlanAPI.delete(plan.id)
      setPlan(null)
      setPlanRotation(0)
      setPlanScale(1)
      setNotice('Floor plan removed.')
    } catch (error) {
      setNotice(error.message || 'Unable to delete floor plan.')
    } finally {
      setBusy(false)
    }
  }

  async function removeZone(zoneId) {
    if (!window.confirm('Delete this zone?')) return
    try {
      await zoneAPI.delete(zoneId)
      const zoneData = await zoneAPI.getByFloor(floor.id)
      setZones(zoneData.zones || [])
      const restroomData = await restroomAPI.getByFloor(floor.id)
      setRestrooms(restroomData.restrooms || [])
      setNotice('Zone removed.')
    } catch (error) {
      setNotice(error.message || 'Unable to delete zone.')
    }
  }

  async function removeDevice(deviceId) {
    if (!window.confirm('Delete this device permanently? This cannot be undone.')) return
    setBusy(true)
    try {
      await deviceAPI.delete(deviceId)
      setDevices((prev) => prev.filter((device) => device.id !== deviceId))
      setAllDevices((prev) => prev.filter((device) => device.id !== deviceId))
      setNotice('Device deleted.')
    } catch (error) {
      setNotice(error.message || 'Unable to delete device.')
    } finally {
      setBusy(false)
    }
  }

  async function removeGateway(gatewayId) {
    if (!window.confirm('Delete this gateway permanently? This cannot be undone.')) return
    setBusy(true)
    try {
      await gatewayAPI.delete(gatewayId)
      setGateways((prev) => prev.filter((gateway) => gateway.id !== gatewayId))
      setAllGateways((prev) => prev.filter((gateway) => gateway.id !== gatewayId))
      setNotice('Gateway deleted.')
    } catch (error) {
      setNotice(error.message || 'Unable to delete gateway.')
    } finally {
      setBusy(false)
    }
  }

  async function uploadPlan(event) {
    const file = event.target.files?.[0]
    if (!file || !floor) return
    if (!file.type.startsWith('image/')) { setNotice('Please upload an image floor plan.'); return }
    const src = await new Promise((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(file) })
    const image = new Image()
    image.onload = async () => {
      const aspect = image.width / image.height
      let offsetLat = 0.0006
      let offsetLng = 0.0006
      if (aspect > 1) {
        offsetLng = offsetLat * aspect
      } else {
        offsetLat = offsetLng / aspect
      }
      const geoBounds = { northLat: center[0] + offsetLat, southLat: center[0] - offsetLat, westLng: center[1] - offsetLng, eastLng: center[1] + offsetLng }
      setBusy(true)
      try {
        const data = await floorPlanAPI.create({ floorId: floor.id, name: `${floor.floorName} Plan`, imageData: src, width: image.width, height: image.height, geoBounds })
        setPlan(data.floorPlan)
        setPlanRotation(0)
        setPlanScale(1)
        setNotice('Floor plan uploaded. Position it over the selected site, then save.')
      } catch (error) {
        setNotice(error.message || 'Unable to upload plan.')
      } finally {
        setBusy(false)
      }
    }
    image.src = src
  }

  async function rotatePlan(angle) {
    if (!plan?.geoBounds) return
    const b = plan.geoBounds
    const centerLat = (b.northLat + b.southLat) / 2
    const centerLng = (b.eastLng + b.westLng) / 2
    const halfLat = (b.northLat - b.southLat) / 2
    const halfLng = (b.eastLng - b.westLng) / 2
    const next = {
      northLat: centerLat + halfLng,
      southLat: centerLat - halfLng,
      eastLng: centerLng + halfLat,
      westLng: centerLng - halfLat,
    }
    setPlan({ ...plan, geoBounds: next })
    setPlanRotation((prev) => prev + angle)
  }

  async function scalePlan(delta) {
    if (!plan) return
    const b = plan.geoBounds
    const centerLat = (b.northLat + b.southLat) / 2
    const centerLng = (b.eastLng + b.westLng) / 2
    const halfLat = (b.northLat - b.southLat) / 2
    const halfLng = (b.eastLng - b.westLng) / 2
    const factor = 1 + delta
    const next = {
      northLat: centerLat + halfLat * factor,
      southLat: centerLat - halfLat * factor,
      eastLng: centerLng + halfLng * factor,
      westLng: centerLng - halfLng * factor,
    }
    setPlan({ ...plan, geoBounds: next })
    setPlanScale((prev) => Math.max(0.1, prev + delta))
  }

  async function adjustPlan(direction) {
    if (!plan) return
    const b = plan.geoBounds
    const lat = b.northLat - b.southLat
    const lng = b.eastLng - b.westLng
    let next = { ...b }
    if (direction === 'left') { next.westLng -= lng * 0.12; next.eastLng -= lng * 0.12 }
    if (direction === 'right') { next.westLng += lng * 0.12; next.eastLng += lng * 0.12 }
    if (direction === 'up') { next.northLat += lat * 0.12; next.southLat += lat * 0.12 }
    if (direction === 'down') { next.northLat -= lat * 0.12; next.southLat -= lat * 0.12 }
    if (direction === 'grow') { next.northLat += lat * 0.12; next.southLat -= lat * 0.12; next.eastLng += lng * 0.12; next.westLng -= lng * 0.12 }
    if (direction === 'shrink') { next.northLat -= lat * 0.12; next.southLat += lat * 0.12; next.eastLng -= lng * 0.12; next.westLng += lng * 0.12 }
    setPlan({ ...plan, geoBounds: next })
  }

  function zoomMap(delta) {
    setMapZoom((prev) => Math.max(1, Math.min(23, prev + delta)))
  }

  function fitPlan() {
    if (!plan?.geoBounds) return
    const b = plan.geoBounds
    const centerLat = (b.northLat + b.southLat) / 2
    const centerLng = (b.eastLng + b.westLng) / 2
    const latDiff = Math.abs(b.northLat - b.southLat)
    const lngDiff = Math.abs(b.eastLng - b.westLng)
    const maxDiff = Math.max(latDiff, lngDiff)
    const zoom = Math.max(1, Math.min(22, Math.round(16 - Math.log2(maxDiff * 111000 / 0.15))))
    setMapZoom(zoom)
  }

  async function savePlan() {
    try {
      await floorPlanAPI.update(plan.id, { geoBounds: plan.geoBounds, rotation: planRotation, scale: planScale })
      setStep(4)
      setNotice('Floor plan geographically aligned. Draw zones on top of it.')
    } catch (error) {
      setNotice(error.message || 'Unable to save alignment.')
    }
  }

  function onMapClick(point) {
    if ((step === 2 || step === 3) && plan) {
      const currentBounds = plan.geoBounds
      const halfLat = (currentBounds.northLat - currentBounds.southLat) / 2
      const halfLng = (currentBounds.eastLng - currentBounds.westLng) / 2
      setPlan({ ...plan, geoBounds: { northLat: point.lat + halfLat, southLat: point.lat - halfLat, eastLng: point.lng + halfLng, westLng: point.lng - halfLng } })
      setNotice('Floor plan moved. Use the controls for fine positioning or scaling, then save.')
      return
    }
    if (step === 4) {
      if (editingZoneId && drawing) {
        setEditingZonePoints((all) => {
          if (drawingMode !== 'rectangle' || all.length === 0) return [...all, [point.lat, point.lng]]
          const [startLat, startLng] = all[0]
          return [[startLat, startLng], [startLat, point.lng], [point.lat, point.lng], [point.lat, startLng]]
        })
        return
      }
      if (drawing && !editingZoneId) {
        setPoints((all) => {
          if (drawingMode !== 'rectangle' || all.length === 0) return [...all, [point.lat, point.lng]]
          const [startLat, startLng] = all[0]
          return [[startLat, startLng], [startLat, point.lng], [point.lat, point.lng], [point.lat, startLng]]
        })
        return
      }
    }
    if (movingItemId && (step === 5 || step === 6)) {
      movePlacedItem(movingItemId, movingItemType, point)
      return
    }
    if (step === 5 && selectedDeviceId) {
      placeExistingItem(point, 'device')
      return
    }
    if (step === 6 && selectedGatewayId) {
      placeExistingItem(point, 'gateway')
      return
    }
    if (step === 5 && !selectedDeviceId) {
      setNotice('Select a device from the list before clicking the map.')
      return
    }
    if (step === 6 && !selectedGatewayId) {
      setNotice('Select a gateway from the list before clicking the map.')
      return
    }
  }

  async function finishZone() {
    if (points.length < 3) { setNotice('A zone needs at least three points.'); return }
    try {
      const coordinates = { type: 'Polygon', coordinates: [[...points, points[0]].map(([lat, lng]) => [lng, lat])] }
      const zoneName = zoneForm.name.trim() || 'Restroom zone'
      const centroid = getPolygonCentroid(points)
      const restroomData = await floorPlanAPI.createRestroom({ floorId: floor.id, name: zoneName, organizationId: user?.organizationId || '' })
      const payload = { floorId: floor.id, name: zoneName, type: 'restroom', coordinates, restroomId: restroomData.restroom.id, latitude: centroid[0], longitude: centroid[1] }
      const data = await zoneAPI.create(payload)
      const zoneData = await zoneAPI.getByFloor(floor.id)
      setZones(zoneData.zones || [])
      const updatedRestrooms = await restroomAPI.getByFloor(floor.id)
      setRestrooms(updatedRestrooms.restrooms || [])
      setPoints([])
      setZoneForm({ name: '' })
      setNotice('Restroom zone saved.')
    } catch (error) {
      setNotice(error.message || 'Unable to create zone.')
    }
  }

  function zoneAt(lat, lng) {
    return zones.find((zone) => {
      const raw = zone.coordinates
      if (!raw) return false
      let ring
      if (typeof raw === 'string') {
        try { const p = JSON.parse(raw); ring = p?.coordinates?.[0] || p } catch { return false }
      } else if (Array.isArray(raw)) {
        ring = raw
      } else {
        ring = raw.coordinates?.[0]
      }
      if (!ring || !Array.isArray(ring)) return false
      let inside = false
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = Number(ring[i][0]), yi = Number(ring[i][1])
        const xj = Number(ring[j][0]), yj = Number(ring[j][1])
        if (((yi > lat) !== (yj > lat)) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
      }
      return inside
    })
  }

  function getPolygonCentroid(points) {
    if (!points.length) return [0, 0]
    let lat = 0, lng = 0
    for (const [la, ln] of points) { lat += la; lng += ln }
    return [lat / points.length, lng / points.length]
  }

  function getZoneName(zoneId) {
    if (!zoneId) return null
    const zone = zones.find((z) => z.id === zoneId)
    return zone?.name || null
  }

  async function loadAllDevices() {
    try {
      const data = await deviceAPI.getAll()
      setAllDevices(data.devices || [])
    } catch { }
  }

  async function loadAllGateways() {
    try {
      const data = await gatewayAPI.getAll()
      setAllGateways(data.gateways || [])
    } catch { }
  }

  async function updateDevicePlacement(deviceId, point, zone) {
    const zoneId = zone?.id || null
    let x = null
    let y = null
    if (plan?.geoBounds) {
      const b = plan.geoBounds
      x = ((point.lng - b.westLng) / (b.eastLng - b.westLng)) * plan.width
      y = ((b.northLat - point.lat) / (b.northLat - b.southLat)) * plan.height
    }
    setBusy(true)
    try {
      const data = await deviceAPI.update(deviceId, {
        floorId: floor.id,
        zoneId,
        restroomId: zone?.restroomId || null,
        floorPlanPosX: x,
        floorPlanPosY: y,
        latitude: point.lat,
        longitude: point.lng,
      })
      const placedDevice = { ...data.device, floorPlanPosX: x, floorPlanPosY: y, latitude: point.lat, longitude: point.lng }
      setDevices((prev) => {
        const exists = prev.some((device) => device.id === deviceId)
        return exists
          ? prev.map((device) => device.id === deviceId ? { ...device, ...placedDevice } : device)
          : [...prev, placedDevice]
      })
      setAllDevices((prev) => prev.map((device) => device.id === deviceId ? { ...device, ...placedDevice } : device))
      setNotice(`Device placed at ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}${zoneId ? ` in zone` : ''}.`)
      return true
    } catch (error) {
      setNotice(error.message || 'Unable to place device.')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function updateGatewayPlacement(gatewayId, point, zoneId) {
    setBusy(true)
    try {
      const data = await gatewayAPI.update(gatewayId, {
        floorId: floor.id,
        zoneId: zoneId || null,
        latitude: point.lat,
        longitude: point.lng,
      })
      const placedGateway = { ...data.gateway, latitude: point.lat, longitude: point.lng }
      setGateways((prev) => {
        const exists = prev.some((gateway) => gateway.id === gatewayId)
        return exists
          ? prev.map((gateway) => gateway.id === gatewayId ? { ...gateway, ...placedGateway } : gateway)
          : [...prev, placedGateway]
      })
      setAllGateways((prev) => prev.map((gateway) => gateway.id === gatewayId ? { ...gateway, ...placedGateway } : gateway))
      setNotice(`Gateway placed at ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}${zoneId ? ` in zone` : ''}.`)
      return true
    } catch (error) {
      setNotice(error.message || 'Unable to place gateway.')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function placeExistingItem(point, type) {
    if (busy) {
      setNotice('Please wait, the system is busy...')
      return
    }
    if (!floor) {
      setNotice('Please select or create a floor first.')
      return
    }
    if (floor.locationId && site?.id && floor.locationId !== site.id) {
      setNotice('This floor belongs to a different site. Switch to that site first.')
      return
    }
    const zone = zoneAt(point.lat, point.lng)
    if (type === 'device' && selectedDeviceId) {
      const existingDevice = allDevices.find((d) => d.id === selectedDeviceId)
      if (existingDevice?.locationId && site?.id && existingDevice.locationId !== site.id) {
        setNotice(`This device belongs to a different site. Remove it from there first.`)
        return
      }
      const placed = await updateDevicePlacement(selectedDeviceId, point, zone)
      if (placed) {
        setSelectedDeviceId(null)
        setPlacingType(null)
        setNotice('Device placed successfully.')
      }
    } else if (type === 'gateway' && selectedGatewayId) {
      const existingGateway = allGateways.find((g) => g.id === selectedGatewayId)
      if (existingGateway?.locationId && site?.id && existingGateway.locationId !== site.id) {
        setNotice(`This gateway belongs to a different site. Remove it from there first.`)
        return
      }
      const placed = await updateGatewayPlacement(selectedGatewayId, point, zone?.id || null)
      if (placed) {
        setSelectedGatewayId(null)
        setPlacingType(null)
        setNotice('Gateway placed successfully.')
      }
    }
  }

  async function movePlacedItem(itemId, itemType, point) {
    if (busy) return
    const zone = zoneAt(point.lat, point.lng)
    if (itemType === 'device') {
      const existingDevice = allDevices.find((d) => d.id === itemId)
      if (existingDevice?.locationId && site?.id && existingDevice.locationId !== site.id) {
        setNotice(`This device belongs to a different site. Remove it from there first.`)
        setMovingItemId(null)
        setMovingItemType(null)
        return
      }
      const moved = await updateDevicePlacement(itemId, point, zone)
      if (moved) {
        setMovingItemId(null)
        setMovingItemType(null)
      }
    } else if (itemType === 'gateway') {
      const existingGateway = allGateways.find((g) => g.id === itemId)
      if (existingGateway?.locationId && site?.id && existingGateway.locationId !== site.id) {
        setNotice(`This gateway belongs to a different site. Remove it from there first.`)
        setMovingItemId(null)
        setMovingItemType(null)
        return
      }
      const moved = await updateGatewayPlacement(itemId, point, zone?.id || null)
      if (moved) {
        setMovingItemId(null)
        setMovingItemType(null)
      }
    }
  }

  function startEditZone(zone) {
    setEditingZoneId(zone.id)
    setEditingZoneForm({ name: zone.name })
    const raw = zone.coordinates
    let ring
    if (typeof raw === 'string') {
      try { const p = JSON.parse(raw); ring = p?.coordinates?.[0] || p } catch { ring = [] }
    } else if (Array.isArray(raw)) {
      ring = raw
    } else {
      ring = raw?.coordinates?.[0] || []
    }
    const positions = Array.isArray(ring) ? ring.map((pt) => Array.isArray(pt) && pt.length >= 2 ? [Number(pt[1]), Number(pt[0])] : null).filter(Boolean) : []
    setEditingZonePoints(positions)
    setDrawing(true)
    setNotice('Redraw the zone on the map, then save.')
  }

  async function saveEditedZone() {
    if (editingZonePoints.length < 3) { setNotice('A zone needs at least three points.'); return }
    const coordinates = { type: 'Polygon', coordinates: [[...editingZonePoints, editingZonePoints[0]].map(([lat, lng]) => [lng, lat])] }
    const centroid = getPolygonCentroid(editingZonePoints)
    try {
      const payload = { name: editingZoneForm.name.trim() || 'Restroom zone', type: 'restroom', coordinates, latitude: centroid[0], longitude: centroid[1] }
      await zoneAPI.update(editingZoneId, payload)
      const zoneData = await zoneAPI.getByFloor(floor.id)
      setZones(zoneData.zones || [])
      setEditingZoneId(null)
      setEditingZonePoints([])
      setDrawing(false)
      setNotice('Zone updated.')
    } catch (error) {
      setNotice(error.message || 'Unable to update zone.')
    }
  }

  function cancelEditZone() {
    setEditingZoneId(null)
    setEditingZonePoints([])
    setDrawing(false)
    setNotice('Zone edit cancelled.')
  }

  async function unlinkDevice(deviceId) {
    if (!window.confirm('Remove this device from the floor plan? It will remain in Device Management.')) return
    setBusy(true)
    try {
      await deviceAPI.update(deviceId, { restroomId: null, floorId: null, zoneId: null, floorPlanPosX: null, floorPlanPosY: null, latitude: null, longitude: null })
      setDevices((prev) => prev.map((d) => d.id === deviceId ? { ...d, restroomId: null, floorId: null, zoneId: null, floorPlanPosX: null, floorPlanPosY: null, latitude: null, longitude: null } : d))
      setNotice('Device unlinked from floor plan.')
    } catch (error) {
      setNotice(error.message || 'Unable to unlink device.')
    } finally {
      setBusy(false)
    }
  }

  async function unlinkGateway(gatewayId) {
    if (!window.confirm('Remove this gateway from the floor plan? It will remain in Gateway Management.')) return
    setBusy(true)
    try {
      await gatewayAPI.update(gatewayId, { locationId: null, floorId: null, zoneId: null, latitude: null, longitude: null })
      setGateways((prev) => prev.map((g) => g.id === gatewayId ? { ...g, locationId: null, floorId: null, zoneId: null, latitude: null, longitude: null } : g))
      setNotice('Gateway unlinked from floor plan.')
    } catch (error) {
      setNotice(error.message || 'Unable to unlink gateway.')
    } finally {
      setBusy(false)
    }
  }

  async function placeItem(point, type) {
    if (busy) return
    let x = null
    let y = null
    if (plan?.geoBounds) {
      const b = plan.geoBounds
      x = ((point.lng - b.westLng) / (b.eastLng - b.westLng)) * plan.width
      y = ((b.northLat - point.lat) / (b.northLat - b.southLat)) * plan.height
    }
    setBusy(true)
    const token = Math.random().toString(36).slice(2, 8).toUpperCase()
    const zone = zoneAt(point.lat, point.lng)
    try {
      if (type === 'gateway') {
        const gwEui = Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase()
        const data = await gatewayAPI.create({ name: `${TYPE_META[type].label} ${token}`, gatewayEui: gwEui, floorId: floor.id, zoneId: zone?.id || null, latitude: point.lat, longitude: point.lng })
        setGateways((all) => [...all, data.gateway])
        setNotice(`${TYPE_META[type].label} placed${zone ? ` in ${zone.name}` : ''}.`)
      } else {
        const data = await deviceAPI.create({ name: `${TYPE_META[type].label} ${token}`, floorId: floor.id, zoneId: zone?.id || null, restroomId: zone?.restroomId || null, deviceType: type, batteryLevel: 90, floorPlanPosX: x, floorPlanPosY: y, latitude: point.lat, longitude: point.lng, isLayoutAsset: true })
        setDevices((all) => [...all, data.device])
        setNotice(`${TYPE_META[type].label} placed${zone ? ` in ${zone.name}` : ''}.`)
      }
    } catch (error) {
      setNotice(error.message || `Unable to place ${type}.`)
    } finally {
      setBusy(false)
    }
  }

  async function importGeoJson(event) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const geojson = JSON.parse(await file.text())
      const features = geojson.type === 'FeatureCollection' ? geojson.features : [geojson]
      for (const [index, feature] of features.entries()) {
        if (feature.geometry?.type !== 'Polygon') continue
        const ring = feature.geometry.coordinates?.[0] || []
        const centroid = ring.length > 0 ? [ring.reduce((s, c) => s + c[1], 0) / ring.length, ring.reduce((s, c) => s + c[0], 0) / ring.length] : [0, 0]
        const payload = { floorId: floor.id, name: feature.properties?.name || `Imported zone ${index + 1}`, type: 'restroom', coordinates: feature.geometry, latitude: centroid[0], longitude: centroid[1] }
        await zoneAPI.create(payload)
      }
      const zoneData = await zoneAPI.getByFloor(floor.id)
      setZones(zoneData.zones || [])
      setNotice('GeoJSON zones imported onto this floor plan.')
    } catch {
      setNotice('That GeoJSON file could not be imported.')
    }
  }

  const zonePositions = (zone) => {
    const raw = zone.coordinates
    if (!raw) return []
    let ring
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw)
        ring = parsed?.coordinates?.[0] || parsed
      } catch {
        return []
      }
    } else if (Array.isArray(raw)) {
      ring = raw
    } else {
      ring = raw.coordinates?.[0]
    }
    if (!ring || !Array.isArray(ring)) return []
    return ring.map((pt) => {
      if (Array.isArray(pt) && pt.length >= 2) return [Number(pt[1]), Number(pt[0])]
      return null
    }).filter(Boolean)
  }
  const devicePosition = (device) => {
    if (plan && Number.isFinite(device.floorPlanPosX) && Number.isFinite(device.floorPlanPosY)) {
      return [plan.geoBounds.northLat - (device.floorPlanPosY / plan.height) * (plan.geoBounds.northLat - plan.geoBounds.southLat), plan.geoBounds.westLng + (device.floorPlanPosX / plan.width) * (plan.geoBounds.eastLng - plan.geoBounds.westLng)]
    }
    if (Number.isFinite(device.latitude) && Number.isFinite(device.longitude)) {
      return [device.latitude, device.longitude]
    }
    return null
  }
  const gatewayPosition = (gateway) => Number.isFinite(gateway.latitude) && Number.isFinite(gateway.longitude) ? [gateway.latitude, gateway.longitude] : null

  const previewCoords = siteForm.latitude && siteForm.longitude
    ? [Number(siteForm.latitude), Number(siteForm.longitude)]
    : null

  return (
    <div className="site-planner">
      <header className="site-planner__header">
        <div>
          <h1>Site Configuration</h1>
          <p>Step {step} of {steps.length} — {steps[step - 1][0]}</p>
          <span>{steps[step - 1][1]}</span>
        </div>
        {step > 1 && (
          <button type="button" className="planner-button planner-button--ghost" onClick={() => setStep(1)}>
            ← Start over
          </button>
        )}
      </header>

      <Stepper currentStep={step} setCurrentStep={setStep} />

      <div className="planner-progress" aria-hidden="true">
        <div className="planner-progress__bar" style={{ width: `${progress}%` }} />
      </div>

      {notice && (
        <div className="planner-notice">
          {notice}
          <button type="button" onClick={() => setNotice('')}>×</button>
        </div>
      )}

      {/* Step 1 — Define Site */}
      {step === 1 && (
        <div className="planner-stage-wrap">
          <section className="planner-form-card">
            <div className="planner-form-layout">
               <div className="planner-form">
                {selectedLocationId ? (
                  <label>
                    <span>Editing site</span>
                    <button type="button" className="planner-button planner-button--ghost" onClick={() => selectExistingSite('')}>＋ Create New Site Instead</button>
                  </label>
                ) : (
                  <label>
                    <span>Create New Site</span>
                    <select value={selectedLocationId} onChange={(e) => selectExistingSite(e.target.value)}>
                      <option value="">-- Select an existing site to edit --</option>
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>{loc.officeName || loc.city} {loc.latitude && loc.longitude ? `(${Number(loc.latitude).toFixed(4)}, ${Number(loc.longitude).toFixed(4)})` : ''}</option>
                      ))}
                    </select>
                  </label>
                )}
                <label>Site Name <b>*</b><input value={siteForm.name} placeholder="e.g. Chandigarh Site" onChange={(e) => setSiteForm({ ...siteForm, name: e.target.value })} /></label>
                <label>Site Type <b>*</b><select value={siteForm.type} onChange={(e) => setSiteForm({ ...siteForm, type: e.target.value })}><option value="">Select a site type...</option><option>Office</option><option>Hospital</option><option>School</option><option>Retail</option><option>Home</option></select></label>
                <label>Location <b>*</b><input value={siteForm.location} placeholder="e.g. Chandigarh, India" onChange={(e) => setSiteForm({ ...siteForm, location: e.target.value })} /></label>
                <label>Description <em>(optional)</em><textarea value={siteForm.description} placeholder="e.g. Main campus building" onChange={(e) => setSiteForm({ ...siteForm, description: e.target.value })} /></label>
                <div className="planner-coordinates">
                  <strong>Coordinates <b>*</b></strong>
                  <p>Provide the site&apos;s GPS centre point. Use &ldquo;Mark centre on map&rdquo; to pick visually.</p>
                  <div>
                    <label>Latitude<input value={siteForm.latitude} placeholder="-90 to 90" onChange={(e) => setSiteForm({ ...siteForm, latitude: e.target.value })} /></label>
                    <label>Longitude<input value={siteForm.longitude} placeholder="-180 to 180" onChange={(e) => setSiteForm({ ...siteForm, longitude: e.target.value })} /></label>
                  </div>
                  <button type="button" className="planner-button planner-button--dark" onClick={() => setPickerOpen(true)}>⌖ Mark centre on map</button>
                </div>
              </div>
               <div className="planner-form-layout__preview">
                 <PreviewPanel title="Site preview" empty={!siteForm.name && !previewCoords ? 'Fill in the form to see a live preview of your site.' : null}>
                   <div className="planner-preview-grid">
                     {siteForm.name && <div className="planner-preview-card"><span className="planner-preview-card__label">Name</span><span className="planner-preview-card__value">{siteForm.name}</span></div>}
                     {siteForm.type && <div className="planner-preview-card"><span className="planner-preview-card__label">Type</span><span className="planner-preview-card__value">{siteForm.type}</span></div>}
                     {siteForm.location && <div className="planner-preview-card"><span className="planner-preview-card__label">Location</span><span className="planner-preview-card__value">{siteForm.location}</span></div>}
                     {selectedLocationId && (
                       <>
                         <div className="planner-preview-card"><span className="planner-preview-card__label">Floors</span><span className="planner-preview-card__value">{floors.length}</span></div>
                         <div className="planner-preview-card"><span className="planner-preview-card__label">Zones</span><span className="planner-preview-card__value">{zones.length}</span></div>
                         <div className="planner-preview-card"><span className="planner-preview-card__label">Devices</span><span className="planner-preview-card__value">{devices.length}</span></div>
                         <div className="planner-preview-card"><span className="planner-preview-card__label">Gateways</span><span className="planner-preview-card__value">{gateways.length}</span></div>
                       </>
                     )}
                     {previewCoords && <div className="planner-preview-card" style={{ gridColumn: '1 / -1' }}><span className="planner-preview-card__label">Map</span><PreviewMap center={previewCoords} site={{ latitude: previewCoords[0], longitude: previewCoords[1] }} /></div>}
                   </div>
                 </PreviewPanel>
               </div>
            </div>
            <footer style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <button type="button" className="planner-button planner-button--ghost" onClick={() => navigate('/dashboard')}>← Back to Dashboard</button>
              <button type="button" className="planner-button" disabled={busy} onClick={saveSite}>Save &amp; Continue →</button>
            </footer>
          </section>
        </div>
      )}

      {/* Step 2 — Floor Plans */}
      {step === 2 && (
        <div className="planner-stage-wrap">
          <section className="planner-step-layout">
            <FloorSidebar floors={floors} floor={floor} onSelect={setFloor} onAdd={() => setAddFloorOpen(true)} onDelete={removeFloor} />
            <main className="planner-step-layout__canvas">
              <MapContainer center={center} zoom={mapZoom} className="planner-map-container" scrollWheelZoom={true} zoomControl={true} maxZoom={23} minZoom={2}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="OpenStreetMap" />
                <MapFocus center={center} zoom={mapZoom} />
                <MapClick onClick={onMapClick} />
                <SitePin location={site} onLocationChange={handleSitePinMove} />
                <MapZoomControl onZoomIn={() => zoomMap(1)} onZoomOut={() => zoomMap(-1)} />
                {bounds && <ImageOverlay bounds={bounds} url={plan.imageData} opacity={0.45} />}
              </MapContainer>
              {floor && (
                <button type="button" className="planner-button planner-floor-plan-map__upload" style={{ position: 'absolute', zIndex: 600, top: 14, right: 14 }} onClick={() => fileRef.current?.click()}>
                  {plan ? 'Replace floor plan' : 'Upload floor plan'}
                </button>
              )}
              <input ref={fileRef} hidden type="file" accept="image/*" onChange={uploadPlan} />
            </main>
            <footer className="planner-step-layout__footer">
              <button type="button" className="planner-button planner-button--ghost" onClick={() => setStep(1)}>Back</button>
              <button type="button" className="planner-button" onClick={() => setStep(3)}>Continue →</button>
            </footer>
          </section>
          <PreviewPanel title="Floors & site preview" empty={!site ? 'Save the site first.' : null}>
            <div className="planner-preview-grid">
              {site && (
                <>
                  <div className="planner-preview-card"><span className="planner-preview-card__label">Site</span><span className="planner-preview-card__value">{site.officeName}</span></div>
                  <div className="planner-preview-card"><span className="planner-preview-card__label">Floors</span><span className="planner-preview-card__value">{floors.length} configured</span></div>
                  {floor && <div className="planner-preview-card"><span className="planner-preview-card__label">Selected floor</span><span className="planner-preview-card__value">{floor.floorName}</span></div>}
                  {plan && <div className="planner-preview-card"><span className="planner-preview-card__label">Floor plan</span><span className="planner-preview-card__value">{plan.name}</span></div>}
                  <div className="planner-preview-card" style={{ gridColumn: '1 / -1' }}>
                    <span className="planner-preview-card__label">Site map</span>
                    <PreviewMap center={center} site={site} bounds={bounds} planImage={plan?.imageData} />
                  </div>
                </>
              )}
              {floors.length > 0 && (
                <div className="planner-preview-list" style={{ gridColumn: '1 / -1' }}>
                  {floors.map((item) => (
                    <div key={item.id} className="planner-preview-item">
                      <div className="planner-preview-item__info">
                        <strong>{item.floorName}</strong>
                        <small>Floor {item.floorNumber ?? '—'}</small>
                      </div>
                      <DeleteButton label={`Delete ${item.floorName}`} onClick={() => removeFloor(item.id)} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </PreviewPanel>
        </div>
      )}

      {/* Steps 3–6 — Map workspace */}
      {step >= 3 && step <= 6 && (
        <div className="planner-stage-wrap">
          <section className="planner-map-shell">
            <div className="planner-mapbar">
              <div>
                {floor && (
                  <select value={floor.id} onChange={(e) => setFloor(floors.find((item) => item.id === e.target.value))}>
                    {floors.map((item) => (
                      <option key={item.id} value={item.id}>{item.floorName}{item.floorNumber !== null ? ` (Floor ${item.floorNumber})` : ''}</option>
                    ))}
                  </select>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {step === 3 && (
                  <>
                    <button type="button" className="planner-button planner-button--ghost" onClick={() => fileRef.current?.click()}>⇧ Upload floor plan</button>
                    {plan && <button type="button" className="planner-button planner-button--danger" onClick={removePlan}>Remove plan</button>}
                    <input ref={fileRef} hidden type="file" accept="image/*" onChange={uploadPlan} />
                  </>
                )}
                {step === 4 && (
                  <>
                    <button type="button" className="planner-button planner-button--ghost" onClick={() => geoJsonRef.current?.click()}>⇧ Import GeoJSON</button>
                    <input ref={geoJsonRef} hidden type="file" accept="application/json,.geojson" onChange={importGeoJson} />
                  </>
                )}
              </div>
            </div>
            <div className="planner-map">
              <MapContainer center={center} zoom={mapZoom} className="planner-map-container" scrollWheelZoom={true} zoomControl={true} maxZoom={23} minZoom={2}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />
                <MapFocus center={center} zoom={mapZoom} />
                <MapCursor children={(selectedDeviceId && step === 5) || (selectedGatewayId && step === 6) ? 'crosshair' : ''} />
                <MapMouseTracker onMouseMove={setMousePos} />
                <MapClick onClick={onMapClick} />
                <SitePin location={site} onLocationChange={handleSitePinMove} />
                <MapZoomControl onZoomIn={() => zoomMap(1)} onZoomOut={() => zoomMap(-1)} />
                {bounds && <ImageOverlay bounds={bounds} url={plan.imageData} opacity={0.45} />}
                {zones.map((zone) => {
                  const positions = zonePositions(zone)
                  if (!positions.length) return null
                  const latitude = Number(zone.latitude)
                  const longitude = Number(zone.longitude)
                  const hasCentroid = Number.isFinite(latitude) && Number.isFinite(longitude)
                  const color = ZONE_COLORS[zone.type] || ZONE_COLORS.other
                  return (
                    <Fragment key={zone.id}>
                      <Polygon key={`${zone.id}-area`} positions={positions} color={color} fillColor={color} fillOpacity={0.35} weight={2} />
                      {zone.type === 'restroom' && hasCentroid && (
                        <Marker key={`${zone.id}-restroom`} position={[latitude, longitude]} icon={divIcon('restroom')} title={zone.name} />
                      )}
                    </Fragment>
                  )
                })}
                {drawing && editingZoneId && editingZonePoints.length > 1 && <Polygon positions={[...editingZonePoints, editingZonePoints[0]]} color="#38bdf8" dashArray="6 6" />}
                {drawing && !editingZoneId && points.length > 1 && <Polygon positions={[...points, points[0]]} color="#38bdf8" dashArray="6 6" />}
                {(selectedDeviceId && step === 5) && mousePos && <PlacementPreview position={[mousePos.lat, mousePos.lng]} type="device" />}
                {(selectedGatewayId && step === 6) && mousePos && <PlacementPreview position={[mousePos.lat, mousePos.lng]} type="gateway" />}
                {devices.map((item) => {
                  const position = devicePosition(item)
                  if (!position) return null
                  const isMoving = movingItemId === item.id
                  return (
                    <Marker
                      key={item.id}
                      position={position}
                      icon={divIcon(item.deviceType, item.badgeId || item.name)}
                      title={item.badgeId || item.name}
                      draggable
                      eventHandlers={{
                        dragstart: () => {
                          setMovingItemId(item.id)
                          setMovingItemType('device')
                          setSelectedDeviceId(null)
                          setPlacingType(null)
                        },
                        dragend: (e) => {
                          const pos = e.target.getLatLng()
                          movePlacedItem(item.id, 'device', pos)
                        },
                      }}
                      opacity={isMoving ? 0.5 : 1}
                    />
                  )
                })}
                {gateways.map((item) => {
                  const position = gatewayPosition(item)
                  if (!position) return null
                  const isMoving = movingItemId === item.id
                  return (
                    <Marker
                      key={item.id}
                      position={position}
                      icon={divIcon('gateway', item.name)}
                      title={item.name}
                      draggable
                      eventHandlers={{
                        dragstart: () => {
                          setMovingItemId(item.id)
                          setMovingItemType('gateway')
                          setSelectedGatewayId(null)
                          setPlacingType(null)
                        },
                        dragend: (e) => {
                          const pos = e.target.getLatLng()
                          movePlacedItem(item.id, 'gateway', pos)
                        },
                      }}
                      opacity={isMoving ? 0.5 : 1}
                    />
                  )
                })}
              </MapContainer>

              {step === 3 && plan && (
                <div className="planner-align">
                  <strong>Align tracing image</strong>
                  <small>Move and scale the plan against the site map.</small>
                  <div className="planner-align__controls">
                    <button type="button" onClick={() => adjustPlan('up')}>↑</button>
                    <button type="button" onClick={() => adjustPlan('left')}>←</button>
                    <button type="button" onClick={() => adjustPlan('right')}>→</button>
                    <button type="button" onClick={() => adjustPlan('down')}>↓</button>
                    <button type="button" onClick={() => adjustPlan('grow')}>＋</button>
                    <button type="button" onClick={() => adjustPlan('shrink')}>−</button>
                  </div>
                   <div className="planner-align__actions">
                     <button type="button" className="planner-button" onClick={() => rotatePlan(90)}>↻ Rotate</button>
                     <button type="button" className="planner-button" onClick={() => scalePlan(0.1)}>Enlarge</button>
                     <button type="button" className="planner-button" onClick={() => scalePlan(-0.1)}>Shrink</button>
                     <button type="button" className="planner-button planner-button--ghost" onClick={fitPlan}>⊞ Fit</button>
                     <button type="button" className="planner-button planner-button--ghost" onClick={() => { setPlanRotation(0); setPlanScale(1) }}>Reset</button>
                   </div>
                   <div className="planner-align__footer">
                     <button type="button" className="planner-button planner-button--ghost" onClick={() => setStep(2)}>← Back</button>
                     <button type="button" className="planner-button" onClick={savePlan}>Save &amp; Continue →</button>
                   </div>
                </div>
              )}

              {step >= 3 && step <= 6 && (
                <>
                  {step === 3 && plan && (
                    <div className="planner-plan-actions">
                      <strong>Plan actions</strong>
                      <button type="button" className="planner-button planner-button--ghost" onClick={() => fileRef.current?.click()}>✎ Edit plan</button>
                      <button type="button" className="planner-button planner-button--danger" onClick={removePlan}>🗑 Delete plan</button>
                      <button type="button" className="planner-button" onClick={() => rotatePlan(90)}>↻ Rotate</button>
                      <button type="button" className="planner-button" onClick={() => scalePlan(0.1)}>⤢ Enlarge</button>
                      <button type="button" className="planner-button" onClick={() => scalePlan(-0.1)}>⤡ Shrink</button>
                      <input ref={fileRef} hidden type="file" accept="image/*" onChange={uploadPlan} />
                    </div>
                  )}

                  <div className="planner-map-actions">
                    <strong>Map actions</strong>
                    <button type="button" className="planner-button" onClick={() => zoomMap(1)}>＋ Zoom in</button>
                    <button type="button" className="planner-button" onClick={() => zoomMap(-1)}>− Zoom out</button>
                    <button type="button" className="planner-button planner-button--ghost" onClick={() => { setZones([]); setRestrooms([]); setDevices([]); setGateways([]); setPlanRotation(0); setPlanScale(1); setNotice('Map data cleared.'); }}>🗑 Delete map data</button>
                    <button type="button" className="planner-button" onClick={() => setMapZoom((prev) => prev + 1)}>↻ Rotate view</button>
                    <button type="button" className="planner-button" onClick={() => setMapZoom(17)}>⤢ Reset view</button>
                  </div>
                </>
              )}

              {step === 4 && (
                <div className="planner-toolbox">
                  <strong>{editingZoneId ? 'Edit zone' : 'Draw zones'}</strong>
                  {drawing ? (
                    <>
                      <input placeholder="Zone name" value={editingZoneId ? editingZoneForm.name : zoneForm.name} onChange={(e) => editingZoneId ? setEditingZoneForm({ ...editingZoneForm, name: e.target.value }) : setZoneForm({ ...zoneForm, name: e.target.value })} />
                      <small>{editingZoneId ? 'Redraw the zone boundary on the map.' : (drawingMode === 'rectangle' ? 'Click two opposite corners of the rectangle.' : `Click the plan to add vertices (${editingZonePoints.length > 0 ? editingZonePoints.length : points.length}/3 minimum).`)}</small>
                      <button type="button" className="planner-button" onClick={editingZoneId ? saveEditedZone : finishZone}>Save zone</button>
                      <button type="button" className="planner-button planner-button--ghost" onClick={editingZoneId ? cancelEditZone : () => { setDrawing(false); setPoints([]) }}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <p>Define spatial zones for restrooms, corridors, lobbies and maintenance areas.</p>
                      <button type="button" className="planner-button" onClick={() => { setDrawingMode('polygon'); setDrawing(true) }}>⌗ Draw polygon</button>
                      <button type="button" className="planner-button planner-button--ghost" onClick={() => { setDrawingMode('rectangle'); setDrawing(true) }}>□ Draw rectangle</button>
                    </>
                  )}
                </div>
              )}

               {step === 4 && (
                <div className="planner-placement">
                  <strong>Zone drawing</strong>
                  <p>Create zones by drawing polygons or rectangles on the map.</p>
                  <div className="planner-placement__footer">
                    <button type="button" className="planner-button planner-button--ghost" onClick={() => setStep(3)}>Back</button>
                    <button type="button" className="planner-button" onClick={() => setStep(5)}>Save &amp; Continue →</button>
                  </div>
                </div>
              )}

              {step === 5 && (
                <div className="planner-placement">
                  <strong>Device placement</strong>
                  <p>Select an existing device from Device Management and click on the map to place it. Restrooms saved in the previous step are listed below.</p>
                    {selectedDeviceId && (() => {
                     const device = allDevices.find((d) => d.id === selectedDeviceId)
                     if (!device) return null
                     return (
                       <div className="planner-placement__info">
                         <strong>Selected device:</strong>
                         <span>Name: {device.name || device.badgeId}</span>
                         <span>Type: {device.deviceType || 'sensor'}</span>
                         <span>EUI: {device.deviceEui || '—'}</span>
                         {device.zoneId && <span style={{ color: '#38bdf8' }}>Zone: {getZoneName(device.zoneId)}</span>}
                         {device.restroomName && device.restroomName !== 'Unassigned' && <span style={{ color: '#0ea5e9' }}>Restroom: {device.restroomName}</span>}
                         {device.floorId && <span style={{ color: '#f59e0b' }}>Floor: {device.floorId === floor?.id ? 'Current floor' : device.floorId}</span>}
                       </div>
                     )
                   })()}
                  <div className="planner-placement__restrooms">
                    <small>Saved restrooms ({restrooms.length})</small>
                    {restrooms.length ? (
                      <div>{restrooms.map((restroom) => <span key={restroom.id} className="planner-placement__restroom">{restroom.name}</span>)}</div>
                    ) : <small>No restrooms have been saved on this floor yet.</small>}
                  </div>
                   <select value={selectedDeviceId || ''} onChange={(e) => { setSelectedDeviceId(e.target.value || null); setPlacingType(e.target.value ? 'device' : null); setMovingItemId(null); setMovingItemType(null) }}>
                    <option value="">Select a device...</option>
                    {allDevices
                      .filter((d) => !d.locationId || !site?.id || d.locationId === site.id)
                      .map((d) => {
                        const placed = d.floorId === floor?.id ? '✓ this floor' : d.floorId ? '↩ other floor' : 'unplaced'
                        return (
                          <option key={d.id} value={d.id}>
                            {d.badgeId || d.name} ({placed})
                          </option>
                        )
                      })}
                  </select>
                   {selectedDeviceId && <small>Device selected. Click on the map to place it.</small>}
                   <div className="planner-placement__footer">
                     <button type="button" className="planner-button planner-button--ghost" onClick={() => setStep(4)}>Back</button>
                     <button type="button" className="planner-button" onClick={() => setStep(6)}>Save &amp; Continue →</button>
                   </div>
                </div>
              )}

              {step === 6 && (
                <div className="planner-placement">
                  <strong>Gateway placement</strong>
                  <p>Select an existing gateway from Gateway Management and click on the map to place it.</p>
                   {selectedGatewayId && (() => {
                    const gateway = allGateways.find((g) => g.id === selectedGatewayId)
                    if (!gateway) return null
                    return (
                      <div className="planner-placement__info">
                        <strong>Selected gateway:</strong>
                        <span>Name: {gateway.name}</span>
                        <span>EUI: {gateway.gatewayEui}</span>
                        <span>Status: {gateway.status || 'offline'}</span>
                        {gateway.zoneId && <span style={{ color: '#38bdf8' }}>Zone: {getZoneName(gateway.zoneId)}</span>}
                        {gateway.floorId && <span style={{ color: '#f59e0b' }}>Floor: {gateway.floorId === floor?.id ? 'Current floor' : gateway.floorId}</span>}
                      </div>
                    )
                  })()}
                   <select value={selectedGatewayId || ''} onChange={(e) => { setSelectedGatewayId(e.target.value || null); setPlacingType(e.target.value ? 'gateway' : null); setMovingItemId(null); setMovingItemType(null) }}>
                    <option value="">Select a gateway...</option>
                    {allGateways
                      .filter((g) => !g.locationId || !site?.id || g.locationId === site.id)
                      .map((g) => {
                        const placed = g.floorId === floor?.id ? '✓ this floor' : g.floorId ? '↩ other floor' : 'unplaced'
                        return (
                          <option key={g.id} value={g.id}>
                            {g.name} ({placed})
                          </option>
                        )
                      })}
                  </select>
                   {selectedGatewayId && <small>Gateway selected. Click on the map to place it.</small>}
                   <div className="planner-placement__footer">
                     <button type="button" className="planner-button planner-button--ghost" onClick={() => setStep(5)}>Back</button>
                     <button type="button" className="planner-button" onClick={() => setStep(7)}>Save &amp; Continue →</button>
                   </div>
                </div>
              )}
            </div>
          </section>

          {/* Step-specific preview below map */}
          {step === 3 && (
            <PreviewPanel title="Floor plan alignment preview" empty={!plan ? 'Upload a floor plan to see the alignment preview.' : null}>
              <div className="planner-preview-grid">
                {plan && (
                  <>
                    <div className="planner-preview-card"><span className="planner-preview-card__label">Plan name</span><span className="planner-preview-card__value">{plan.name}</span></div>
                    <div className="planner-preview-card"><span className="planner-preview-card__label">Dimensions</span><span className="planner-preview-card__value">{plan.width} × {plan.height} px</span></div>
                    <div className="planner-preview-card"><span className="planner-preview-card__label">Thumbnail</span><img className="planner-preview-thumb" src={plan.imageData} alt={plan.name} /></div>
                    <div className="planner-preview-card" style={{ gridColumn: 'span 2' }}>
                      <span className="planner-preview-card__label">Aligned on map</span>
                      <PreviewMap center={center} site={site} bounds={bounds} planImage={plan.imageData} height="200px" />
                    </div>
                  </>
                )}
              </div>
            </PreviewPanel>
          )}

          {step === 4 && (
            <PreviewPanel title="Zones preview" empty={zones.length === 0 ? 'No zones drawn yet. Use the map tools above to create zones.' : null}>
              <div className="planner-preview-list">
                {zones.map((zone) => (
                  <div key={zone.id} className="planner-preview-item">
                    <span className="planner-preview-item__dot" style={{ background: ZONE_COLORS[zone.type] || ZONE_COLORS.other }} />
                     <div className="planner-preview-item__info">
                        <strong>{zone.name}</strong>
                        <small>Restroom · {zone.latitude?.toFixed(5)}, {zone.longitude?.toFixed(5)}</small>
                      </div>
                    <button type="button" className="planner-button planner-button--ghost" onClick={() => startEditZone(zone)}>✎ Edit</button>
                    <DeleteButton label={`Delete ${zone.name}`} onClick={() => removeZone(zone.id)} />
                  </div>
                ))}
              </div>
            </PreviewPanel>
          )}

          {step === 5 && (
            <PreviewPanel title="Devices preview" empty={devices.length === 0 ? 'No devices placed yet. Select a device and click the map.' : null}>
              <div className="planner-preview-list">
                {devices.map((device) => {
                  const position = devicePosition(device)
                  return (
                    <div key={device.id} className="planner-preview-item">
                      <span className="planner-preview-item__icon" style={{ background: TYPE_META[device.deviceType]?.color || TYPE_META.device.color }}>{TYPE_META[device.deviceType]?.icon || '▣'}</span>
                       <div className="planner-preview-item__info">
                         <strong>{device.badgeId || device.name}</strong>
                         <small>{device.name || 'Device'} · {device.restroomName && device.restroomName !== 'Unassigned' ? device.restroomName : 'No restroom'} · {getZoneName(device.zoneId) || 'No zone'} · {device.latitude?.toFixed(5)}, {device.longitude?.toFixed(5)}</small>
                       </div>
                      <button type="button" className="planner-button planner-button--ghost" onClick={() => { setMovingItemId(device.id); setMovingItemType('device'); setSelectedDeviceId(null); setPlacingType(null); setNotice('Click the map to move this device.') }}>✎ Move</button>
                      <DeleteButton label={`Delete ${device.name}`} onClick={() => removeDevice(device.id)} />
                    </div>
                  )
                })}
              </div>
            </PreviewPanel>
          )}

          {step === 6 && (
            <PreviewPanel title="Gateways preview" empty={gateways.length === 0 ? 'No gateways placed yet. Select a gateway and click the map.' : null}>
              <div className="planner-preview-list">
                {gateways.map((gateway) => {
                  const position = gatewayPosition(gateway)
                  return (
                    <div key={gateway.id} className="planner-preview-item">
                      <span className="planner-preview-item__icon" style={{ background: TYPE_META.gateway.color }}>{TYPE_META.gateway.icon}</span>
                      <div className="planner-preview-item__info">
                        <strong>{gateway.name}</strong>
                        <small>{gateway.gatewayEui} · {getZoneName(gateway.zoneId) || 'No zone'} · {gateway.latitude?.toFixed(5)}, {gateway.longitude?.toFixed(5)}</small>
                      </div>
                      <button type="button" className="planner-button planner-button--ghost" onClick={() => { setMovingItemId(gateway.id); setMovingItemType('gateway'); setSelectedGatewayId(null); setPlacingType(null); setNotice('Click the map to move this gateway.') }}>✎ Move</button>
                      <DeleteButton label={`Delete ${gateway.name}`} onClick={() => removeGateway(gateway.id)} />
                    </div>
                  )
                })}
              </div>
            </PreviewPanel>
          )}
        </div>
      )}

      {/* Step 7 — Review */}
      {step === 7 && (
        <div className="planner-stage-wrap">
          <section className="planner-review">
            <h2>Review site configuration</h2>
            <p>Everything below is spatially connected to the selected site centre. Remove any item you no longer need.</p>

            <div className="planner-review-card">
              <div className="planner-review-card__header">
                <strong>{site?.officeName}</strong>
              </div>
              <div className="planner-review-card__children">
                <span>{site?.latitude?.toFixed(6)}, {site?.longitude?.toFixed(6)}</span>
              </div>
            </div>

            {floors.map((item) => (
              <div key={item.id} className="planner-review-card">
                <div className="planner-review-card__header">
                  <strong>{item.floorName}</strong>
                  <DeleteButton label={`Delete ${item.floorName}`} onClick={() => removeFloor(item.id)} />
                </div>
                <div className="planner-review-card__children">
                  {item.id === floor?.id && plan && (
                    <div className="planner-review-row">
                      <span>Floor plan: {plan.name}</span>
                      <DeleteButton label="Remove floor plan" onClick={removePlan} />
                    </div>
                  )}
                  {item.id === floor?.id && zones.map((z) => (
                    <div key={z.id} className="planner-review-row">
                       <span>Restroom: {z.name} · {z.latitude?.toFixed(5)}, {z.longitude?.toFixed(5)}</span>
                      <DeleteButton label={`Delete ${z.name}`} onClick={() => removeZone(z.id)} />
                    </div>
                  ))}
                  {item.id === floor?.id && devices.map((d) => (
                    <div key={d.id} className="planner-review-row">
                      <span>{TYPE_META[d.deviceType]?.label || 'Device'}: {d.badgeId || d.name} · {d.latitude?.toFixed(5)}, {d.longitude?.toFixed(5)}</span>
                      <DeleteButton label={`Unlink ${d.name}`} onClick={() => unlinkDevice(d.id)} />
                    </div>
                  ))}
                  {item.id === floor?.id && gateways.map((g) => (
                    <div key={g.id} className="planner-review-row">
                      <span>Gateway: {g.name} ({g.gatewayEui}) · {g.latitude?.toFixed(5)}, {g.longitude?.toFixed(5)}</span>
                      <DeleteButton label={`Unlink ${g.name}`} onClick={() => unlinkGateway(g.id)} />
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button type="button" className="planner-button planner-button--ghost" onClick={() => setStep(6)}>Back</button>
              <button type="button" className="planner-button" onClick={() => navigate('/dashboard')}>Finish &amp; go to dashboard</button>
            </div>
          </section>

          <PreviewPanel title="Configuration map preview">
            <PreviewMap center={center} site={site} bounds={bounds} planImage={plan?.imageData} zones={zones} height="220px" />
          </PreviewPanel>
        </div>
      )}

      {pickerOpen && (
        <CenterPicker
          initial={siteForm.latitude ? [Number(siteForm.latitude), Number(siteForm.longitude)] : null}
          onCancel={() => setPickerOpen(false)}
          onSave={setCoords}
        />
      )}

      {addFloorOpen && (
        <div className="planner-modal-backdrop">
          <div className="planner-modal planner-modal--small">
            <button type="button" className="planner-modal__close" onClick={() => setAddFloorOpen(false)}>×</button>
            <h2>Add Floor</h2>
            <label>Floor Name <b>*</b><input autoFocus value={floorForm.name} placeholder="e.g. Ground Floor" onChange={(e) => setFloorForm({ ...floorForm, name: e.target.value })} /></label>
            <label>Floor Number <b>*</b><input type="number" value={floorForm.number} placeholder="0 for ground, 1 for first floor" onChange={(e) => setFloorForm({ ...floorForm, number: e.target.value })} /></label>
            <div className="planner-modal__actions">
              <button type="button" className="planner-button planner-button--ghost" onClick={() => setAddFloorOpen(false)}>Cancel</button>
              <button type="button" className="planner-button" disabled={busy} onClick={addFloor}>Add Floor</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
