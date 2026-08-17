import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ImageOverlay, MapContainer, Marker, Polygon, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useAuth } from '../hooks/useAuth'
import { deviceAPI, floorAPI, floorPlanAPI, locationAPI, zoneAPI, gatewayAPI } from '../services/api'
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

function divIcon(type) {
  const meta = TYPE_META[type] || TYPE_META.device
  return L.divIcon({
    className: 'planner-marker', iconSize: [34, 34], iconAnchor: [17, 32],
    html: `<span style="--marker:${meta.color}">${meta.icon}</span>`,
  })
}

function MapClick({ onClick }) {
  useMapEvents({ click: (e) => onClick?.(e.latlng) })
  return null
}

function MapFocus({ center, zoom = 16 }) {
  const map = useMap()
  useEffect(() => { if (center) map.setView(center, zoom) }, [map, center, zoom])
  return null
}

function SitePin({ location }) {
  if (!Number.isFinite(location?.latitude) || !Number.isFinite(location?.longitude)) return null
  return <Marker position={[location.latitude, location.longitude]} icon={L.divIcon({ className: 'planner-site-pin', iconSize: [40, 48], iconAnchor: [20, 48], html: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ef4444" width="40" height="48"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5" fill="#fff"/></svg>' }) } />
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
      <MapContainer center={mapCenter} zoom={zoom} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false} dragging={false} doubleClickZoom={false} zoomControl={false}>
        <MapFocus center={mapCenter} zoom={zoom} />
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="" />
        {site && <SitePin location={site} />}
        {bounds && planImage && <ImageOverlay bounds={bounds} url={planImage} opacity={0.55} />}
        {zones.map((zone) => {
          const positions = zone.coordinates?.coordinates?.[0]?.map(([lng, lat]) => [lat, lng]) || []
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

function Stepper({ currentStep, setCurrentStep, ready }) {
  return (
    <nav className="planner-stepper" aria-label="Site planner steps">
      {steps.map(([title, subtitle], index) => {
        const n = index + 1
        const done = n < currentStep
        const available = n <= currentStep || (n === 2 && ready.site) || (n === 3 && ready.floor) || (n >= 4 && ready.plan)
        return (
          <button
            className={`planner-step ${n === currentStep ? 'is-active' : ''} ${done ? 'is-done' : ''}`}
            key={title}
            disabled={!available}
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
          <MapContainer center={focus} zoom={initial ? 15 : 5} style={{ height: '100%', width: '100%' }}>
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
  const [zones, setZones] = useState([])
  const [devices, setDevices] = useState([])
  const [gateways, setGateways] = useState([])
  const [siteForm, setSiteForm] = useState({ name: '', type: '', description: '', location: '', latitude: '', longitude: '' })
  const [floorForm, setFloorForm] = useState({ name: '', number: '' })
  const [zoneForm, setZoneForm] = useState({ name: '', type: 'restroom' })
  const [drawing, setDrawing] = useState(false)
  const [drawingMode, setDrawingMode] = useState('polygon')
  const [points, setPoints] = useState([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [addFloorOpen, setAddFloorOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

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
      deviceAPI.getByFloor(floor.id),
      gatewayAPI.getAll({ floorId: floor.id }),
    ])
      .then(([plans, zoneData, deviceData, gatewayData]) => {
        setPlan(plans.floorPlans?.[0] || null)
        setZones(zoneData.zones || [])
        setDevices(deviceData.devices || [])
        setGateways(gatewayData.gateways || [])
      })
      .catch(() => setNotice('Could not load the saved spatial configuration.'))
  }, [floor])

  function setCoords(coords) {
    setSiteForm((v) => ({ ...v, latitude: String(coords[0]), longitude: String(coords[1]) }))
    setPickerOpen(false)
  }

  async function saveSite() {
    const latitude = Number(siteForm.latitude)
    const longitude = Number(siteForm.longitude)
    if (!siteForm.name.trim() || !siteForm.type || !siteForm.location.trim() || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setNotice('Enter the site name, type, location and centre coordinates to continue.')
      return
    }
    setBusy(true)
    try {
      const data = await locationAPI.create({
        organizationId: user?.organizationId,
        officeName: siteForm.name.trim(),
        city: siteForm.location.trim(),
        address: `${siteForm.type}${siteForm.description ? ` — ${siteForm.description}` : ''}`,
        latitude,
        longitude,
      })
      setSite(data.location)
      const floorData = await floorAPI.getByLocation(data.location.id)
      setFloors(floorData.floors || [])
      setStep(2)
      setNotice('Site saved. Add the floors that belong to it.')
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
      setZones((all) => all.filter((z) => z.id !== zoneId))
      setNotice('Zone removed.')
    } catch (error) {
      setNotice(error.message || 'Unable to delete zone.')
    }
  }

  async function removeDevice(deviceId) {
    if (!window.confirm('Remove this device from the floor plan?')) return
    try {
      await deviceAPI.delete(deviceId)
      setDevices((all) => all.filter((d) => d.id !== deviceId))
      setNotice('Device removed.')
    } catch (error) {
      setNotice(error.message || 'Unable to delete device.')
    }
  }

  async function removeGateway(gatewayId) {
    if (!window.confirm('Remove this gateway from the floor plan?')) return
    try {
      await gatewayAPI.delete(gatewayId)
      setGateways((all) => all.filter((g) => g.id !== gatewayId))
      setNotice('Gateway removed.')
    } catch (error) {
      setNotice(error.message || 'Unable to delete gateway.')
    }
  }

  async function uploadPlan(event) {
    const file = event.target.files?.[0]
    if (!file || !floor) return
    if (!file.type.startsWith('image/')) { setNotice('Please upload an image floor plan.'); return }
    const src = await new Promise((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(file) })
    const image = new Image()
    image.onload = async () => {
      const offset = 0.00035
      const geoBounds = { northLat: center[0] + offset, southLat: center[0] - offset, westLng: center[1] - offset, eastLng: center[1] + offset }
      setBusy(true)
      try {
        const data = await floorPlanAPI.create({ floorId: floor.id, name: `${floor.floorName} Plan`, imageData: src, width: image.width, height: image.height, geoBounds })
        setPlan(data.floorPlan)
        setNotice('Floor plan uploaded. Position it over the selected site, then save.')
      } catch (error) {
        setNotice(error.message || 'Unable to upload plan.')
      } finally {
        setBusy(false)
      }
    }
    image.src = src
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

  async function savePlan() {
    try {
      await floorPlanAPI.update(plan.id, { geoBounds: plan.geoBounds })
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
    if (step === 4 && drawing) {
      setPoints((all) => {
        if (drawingMode !== 'rectangle' || all.length === 0) return [...all, [point.lat, point.lng]]
        const [startLat, startLng] = all[0]
        return [[startLat, startLng], [startLat, point.lng], [point.lat, point.lng], [point.lat, startLng]]
      })
      return
    }
    const typeForStep = step === 5 ? 'device' : step === 6 ? 'gateway' : null
    if (typeForStep) placeItem(point, typeForStep)
  }

  async function finishZone() {
    if (points.length < 3) { setNotice('A zone needs at least three points.'); return }
    try {
      const coordinates = { type: 'Polygon', coordinates: [[...points, points[0]].map(([lat, lng]) => [lng, lat])] }
      const zoneName = zoneForm.name.trim() || `${zoneForm.type} zone`
      const restroomData = await floorPlanAPI.createRestroom({ floorId: floor.id, name: zoneName, organizationId: user?.organizationId || '' })
      const data = await zoneAPI.create({ floorId: floor.id, name: zoneName, type: zoneForm.type, coordinates, restroomId: restroomData.restroom.id })
      setZones((all) => [...all, data.zone])
      setPoints([])
      setZoneForm({ name: '', type: zoneForm.type })
      setNotice('Zone saved. Draw another zone or continue.')
    } catch (error) {
      setNotice(error.message || 'Unable to create zone.')
    }
  }

  function zoneAt(lat, lng) {
    return zones.find((zone) => {
      const ring = zone.coordinates?.coordinates?.[0]
      if (!ring) return false
      let inside = false
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i]
        const [xj, yj] = ring[j]
        if (((yi > lat) !== (yj > lat)) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
      }
      return inside
    })
  }

  async function placeItem(point, type) {
    if (busy || !plan) return
    const b = plan.geoBounds
    const x = ((point.lng - b.westLng) / (b.eastLng - b.westLng)) * plan.width
    const y = ((b.northLat - point.lat) / (b.northLat - b.southLat)) * plan.height
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
        const data = await deviceAPI.create({ name: `${TYPE_META[type].label} ${token}`, floorId: floor.id, zoneId: zone?.id || null, deviceType: type, batteryLevel: 90, floorPlanPosX: x, floorPlanPosY: y, isLayoutAsset: true })
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
        const data = await zoneAPI.create({ floorId: floor.id, name: feature.properties?.name || `Imported zone ${index + 1}`, type: feature.properties?.type || 'other', coordinates: feature.geometry })
        setZones((all) => [...all, data.zone])
      }
      setNotice('GeoJSON zones imported onto this floor plan.')
    } catch {
      setNotice('That GeoJSON file could not be imported.')
    }
  }

  const zonePositions = (zone) => zone.coordinates?.coordinates?.[0]?.map(([lng, lat]) => [lat, lng]) || []
  const devicePosition = (device) => plan && [plan.geoBounds.northLat - (device.floorPlanPosY / plan.height) * (plan.geoBounds.northLat - plan.geoBounds.southLat), plan.geoBounds.westLng + (device.floorPlanPosX / plan.width) * (plan.geoBounds.eastLng - plan.geoBounds.westLng)]
  const gatewayPosition = (gateway) => gateway.latitude && gateway.longitude ? [gateway.latitude, gateway.longitude] : null

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

      <Stepper currentStep={step} setCurrentStep={setStep} ready={ready} />

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
                    {previewCoords && <div className="planner-preview-card" style={{ gridColumn: '1 / -1' }}><span className="planner-preview-card__label">Map</span><PreviewMap center={previewCoords} site={{ latitude: previewCoords[0], longitude: previewCoords[1] }} /></div>}
                  </div>
                </PreviewPanel>
              </div>
            </div>
            <footer><button type="button" className="planner-button" disabled={busy} onClick={saveSite}>Save &amp; Continue →</button></footer>
          </section>
        </div>
      )}

      {/* Step 2 — Floor Plans */}
      {step === 2 && (
        <div className="planner-stage-wrap">
          <section className="planner-step-layout">
            <FloorSidebar floors={floors} floor={floor} onSelect={setFloor} onAdd={() => setAddFloorOpen(true)} onDelete={removeFloor} />
            <main className="planner-step-layout__canvas">
              <MapContainer center={center} zoom={17} style={{ height: '100%', width: '100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="OpenStreetMap" />
                <MapFocus center={center} zoom={17} />
                <MapClick onClick={onMapClick} />
                <SitePin location={site} />
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
              <button type="button" className="planner-button" disabled={!floor} onClick={() => setStep(3)}>Continue →</button>
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
              <MapContainer center={center} zoom={17} style={{ height: '100%', width: '100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />
                <MapFocus center={center} zoom={17} />
                <MapClick onClick={onMapClick} />
                <SitePin location={site} />
                {bounds && <ImageOverlay bounds={bounds} url={plan.imageData} opacity={0.45} />}
                {zones.map((zone) => (
                  <Polygon key={zone.id} positions={zonePositions(zone)} color={ZONE_COLORS[zone.type] || ZONE_COLORS.other} fillColor={ZONE_COLORS[zone.type] || ZONE_COLORS.other} fillOpacity={0.18} />
                ))}
                {drawing && points.length > 1 && <Polygon positions={[...points, points[0]]} color="#38bdf8" dashArray="6 6" />}
                {devices.map((item) => { const position = devicePosition(item); return position ? <Marker key={item.id} position={position} icon={divIcon(item.deviceType)} /> : null })}
                {gateways.map((item) => { const position = gatewayPosition(item); return position ? <Marker key={item.id} position={position} icon={divIcon('gateway')} /> : null })}
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
                  <button type="button" className="planner-button" onClick={savePlan}>✓ Save &amp; Continue</button>
                </div>
              )}

              {step === 4 && (
                <div className="planner-toolbox">
                  <strong>Draw zones</strong>
                  {drawing ? (
                    <>
                      <input placeholder="Zone name" value={zoneForm.name} onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })} />
                      <select value={zoneForm.type} onChange={(e) => setZoneForm({ ...zoneForm, type: e.target.value })}>{Object.keys(ZONE_COLORS).map((type) => <option key={type}>{type}</option>)}</select>
                      <small>{drawingMode === 'rectangle' ? 'Click two opposite corners of the rectangle.' : `Click the plan to add vertices (${points.length}/3 minimum).`}</small>
                      <button type="button" className="planner-button" onClick={finishZone}>Save zone</button>
                      <button type="button" className="planner-button planner-button--ghost" onClick={() => { setDrawing(false); setPoints([]) }}>Cancel</button>
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
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button type="button" className="planner-button planner-button--ghost" onClick={() => setStep(3)}>Back</button>
                    <button type="button" className="planner-button" onClick={() => setStep(5)}>Save &amp; Continue →</button>
                  </div>
                </div>
              )}

              {[5, 6].includes(step) && (
                <div className="planner-placement">
                  <strong>{TYPE_META[step === 5 ? 'device' : 'gateway'].label} placement</strong>
                  <p>Click inside a zone to place an item. Its floor and zone association are saved automatically.</p>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button type="button" className="planner-button planner-button--ghost" onClick={() => setStep(step - 1)}>Back</button>
                    <button type="button" className="planner-button" onClick={() => setStep(step + 1)}>Save &amp; Continue →</button>
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
                      <small>{zone.type}</small>
                    </div>
                    <DeleteButton label={`Delete zone ${zone.name}`} onClick={() => removeZone(zone.id)} />
                  </div>
                ))}
              </div>
            </PreviewPanel>
          )}

          {step === 5 && (
            <PreviewPanel title="Devices preview" empty={devices.length === 0 ? 'No devices placed yet. Click on the map to add devices.' : null}>
              <div className="planner-preview-list">
                {devices.map((device) => (
                  <div key={device.id} className="planner-preview-item">
                    <span className="planner-preview-item__icon" style={{ background: TYPE_META[device.deviceType]?.color || TYPE_META.device.color }}>{TYPE_META[device.deviceType]?.icon || '▣'}</span>
                    <div className="planner-preview-item__info">
                      <strong>{device.badgeId || device.name}</strong>
                      <small>{TYPE_META[device.deviceType]?.label || 'Device'}</small>
                    </div>
                    <DeleteButton label={`Remove ${device.name}`} onClick={() => removeDevice(device.id)} />
                  </div>
                ))}
              </div>
            </PreviewPanel>
          )}

          {step === 6 && (
            <PreviewPanel title="Gateways preview" empty={gateways.length === 0 ? 'No gateways placed yet. Click on the map to add gateways.' : null}>
              <div className="planner-preview-list">
                {gateways.map((gateway) => (
                  <div key={gateway.id} className="planner-preview-item">
                    <span className="planner-preview-item__icon" style={{ background: TYPE_META.gateway.color }}>{TYPE_META.gateway.icon}</span>
                    <div className="planner-preview-item__info">
                      <strong>{gateway.name}</strong>
                      <small>{gateway.gatewayEui}</small>
                    </div>
                    <DeleteButton label={`Remove ${gateway.name}`} onClick={() => removeGateway(gateway.id)} />
                  </div>
                ))}
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
                      <span>Zone: {z.name} ({z.type})</span>
                      <DeleteButton label={`Delete ${z.name}`} onClick={() => removeZone(z.id)} />
                    </div>
                  ))}
                  {item.id === floor?.id && devices.map((d) => (
                    <div key={d.id} className="planner-review-row">
                      <span>{TYPE_META[d.deviceType]?.label || 'Device'}: {d.badgeId || d.name}</span>
                      <DeleteButton label={`Remove ${d.name}`} onClick={() => removeDevice(d.id)} />
                    </div>
                  ))}
                  {item.id === floor?.id && gateways.map((g) => (
                    <div key={g.id} className="planner-review-row">
                      <span>Gateway: {g.name} ({g.gatewayEui})</span>
                      <DeleteButton label={`Remove ${g.name}`} onClick={() => removeGateway(g.id)} />
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
