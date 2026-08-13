import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ImageOverlay, MapContainer, Marker, Polygon, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useAuth } from '../hooks/useAuth'
import { deviceAPI, floorAPI, floorPlanAPI, locationAPI, zoneAPI } from '../services/api'
import './SiteConfiguration.css'
import './SiteConfigurationOverrides.css'
import './SiteConfigurationFloorStep.css'
import './SiteConfigurationZones.css'
import './SiteConfigurationDrawing.css'
import './SiteConfigurationTheme.css'

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
  ['Place Badges', 'Pin badges on map'],
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
  return <Marker position={[location.latitude, location.longitude]} icon={L.divIcon({ className: 'planner-site-pin', iconSize: [26, 34], iconAnchor: [13, 34], html: '<span>⌖</span>' })} />
}

function Stepper({ currentStep, setCurrentStep, ready }) {
  return <nav className="planner-stepper" aria-label="Site planner steps">
    {steps.map(([title, subtitle], index) => {
      const n = index + 1
      const done = n < currentStep
      const available = n <= currentStep || (n === 2 && ready.site) || (n === 3 && ready.floor) || (n >= 4 && ready.plan)
      return <button className={`planner-step ${n === currentStep ? 'is-active' : ''} ${done ? 'is-done' : ''}`} key={title} disabled={!available} onClick={() => setCurrentStep(n)}>
        <span className="planner-step__number">{done ? '✓' : n}</span><span><strong>{title}</strong><small>{subtitle}</small></span>
      </button>
    })}
  </nav>
}

function CenterPicker({ initial, onCancel, onSave }) {
  const [selected, setSelected] = useState(initial || null)
  const [focus, setFocus] = useState(initial || DEFAULT_CENTER)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  async function searchLocation() {
    if (!query.trim()) return
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(query)}`)
      setResults(await response.json())
    } catch { setResults([]) }
  }
  return <div className="planner-modal-backdrop">
    <div className="planner-modal planner-modal--map">
      <button className="planner-modal__close" onClick={onCancel}>×</button>
      <h2>Mark site centre on the map</h2>
      <p>Search by panning and zooming, then click to place the site marker.</p>
      <div className="planner-location-search"><input value={query} placeholder="Search city or address, e.g. Chandigarh, India" onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && searchLocation()} /><button className="planner-button" onClick={searchLocation}>Search</button>{results.length > 0 && <div className="planner-location-results">{results.map((result) => <button key={result.place_id} onClick={() => { setFocus([Number(result.lat), Number(result.lon)]); setResults([]) }}>{result.display_name}</button>)}</div>}</div>
      <div className="planner-picker-map">
        <MapContainer center={focus} zoom={initial ? 15 : 5} style={{ height: '100%', width: '100%' }}>
          <MapFocus center={focus} zoom={15} />
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />
          <MapClick onClick={(point) => setSelected([point.lat, point.lng])} />
          {selected && <Marker position={selected} icon={L.divIcon({ className: 'planner-site-pin', iconSize: [26, 34], iconAnchor: [13, 34], html: '<span>⌖</span>' })} />}
        </MapContainer>
      </div>
      <div className="planner-modal__footer"><span>{selected ? `${selected[0].toFixed(7)}, ${selected[1].toFixed(7)}` : 'No point selected yet'}</span><div><button className="planner-button planner-button--ghost" onClick={onCancel}>Cancel</button><button className="planner-button" disabled={!selected} onClick={() => onSave(selected)}>Save</button></div></div>
    </div>
  </div>
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

  useEffect(() => {
    if (!floor) return
    Promise.all([floorPlanAPI.getByFloor(floor.id), zoneAPI.getByFloor(floor.id), deviceAPI.getByFloor(floor.id)])
      .then(([plans, zoneData, deviceData]) => { setPlan(plans.floorPlans?.[0] || null); setZones(zoneData.zones || []); setDevices(deviceData.devices || []) })
      .catch(() => setNotice('Could not load the saved spatial configuration.'))
  }, [floor])

  function setCoords(coords) {
    setSiteForm((v) => ({ ...v, latitude: String(coords[0]), longitude: String(coords[1]) }))
    setPickerOpen(false)
  }

  async function saveSite() {
    const latitude = Number(siteForm.latitude), longitude = Number(siteForm.longitude)
    if (!siteForm.name.trim() || !siteForm.type || !siteForm.location.trim() || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setNotice('Enter the site name, type, location and centre coordinates to continue.'); return
    }
    setBusy(true)
    try {
      const data = await locationAPI.create({ organizationId: user?.organizationId, officeName: siteForm.name.trim(), city: siteForm.location.trim(), address: `${siteForm.type}${siteForm.description ? ` — ${siteForm.description}` : ''}`, latitude, longitude })
      setSite(data.location); setStep(2); setNotice('Site saved. Add the floors that belong to it.')
    } catch (error) { setNotice(error.message || 'Unable to save site.') } finally { setBusy(false) }
  }

  async function addFloor() {
    if (!floorForm.name.trim() || floorForm.number === '') return
    setBusy(true)
    try {
      const data = await floorAPI.create({ locationId: site.id, floorName: floorForm.name.trim(), floorNumber: Number(floorForm.number) })
      setFloors((all) => [...all, data.floor]); setFloor(data.floor); setFloorForm({ name: '', number: '' }); setAddFloorOpen(false)
    } catch (error) { setNotice(error.message || 'Unable to add floor.') } finally { setBusy(false) }
  }

  async function uploadPlan(event) {
    const file = event.target.files?.[0]
    if (!file || !floor) return
    if (!file.type.startsWith('image/')) { setNotice('Please upload an image floor plan.'); return }
    const src = await new Promise((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(file) })
    const image = new Image(); image.onload = async () => {
      const offset = 0.00035
      const geoBounds = { northLat: center[0] + offset, southLat: center[0] - offset, westLng: center[1] - offset, eastLng: center[1] + offset }
      setBusy(true)
      try { const data = await floorPlanAPI.create({ floorId: floor.id, name: `${floor.floorName} Plan`, imageData: src, width: image.width, height: image.height, geoBounds }); setPlan(data.floorPlan); setNotice('Floor plan uploaded. Position it over the selected site, then save.') } catch (error) { setNotice(error.message || 'Unable to upload plan.') } finally { setBusy(false) }
    }; image.src = src
  }

  async function adjustPlan(direction) {
    if (!plan) return
    const b = plan.geoBounds; const lat = b.northLat - b.southLat; const lng = b.eastLng - b.westLng
    let next = { ...b }
    if (direction === 'left') { next.westLng -= lng * .12; next.eastLng -= lng * .12 }
    if (direction === 'right') { next.westLng += lng * .12; next.eastLng += lng * .12 }
    if (direction === 'up') { next.northLat += lat * .12; next.southLat += lat * .12 }
    if (direction === 'down') { next.northLat -= lat * .12; next.southLat -= lat * .12 }
    if (direction === 'grow') { next.northLat += lat * .12; next.southLat -= lat * .12; next.eastLng += lng * .12; next.westLng -= lng * .12 }
    if (direction === 'shrink') { next.northLat -= lat * .12; next.southLat += lat * .12; next.eastLng -= lng * .12; next.westLng += lng * .12 }
    setPlan({ ...plan, geoBounds: next })
  }

  async function savePlan() { try { await floorPlanAPI.update(plan.id, { geoBounds: plan.geoBounds }); setStep(4); setNotice('Floor plan geographically aligned. Draw zones on top of it.') } catch (error) { setNotice(error.message || 'Unable to save alignment.') } }

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
    const typeForStep = step === 5 ? 'badge' : step === 6 ? 'device' : step === 7 ? 'gateway' : null
    if (typeForStep) placeItem(point, typeForStep)
  }

  async function finishZone() {
    if (points.length < 3) { setNotice('A zone needs at least three points.'); return }
    try {
      const coordinates = { type: 'Polygon', coordinates: [[...points, points[0]].map(([lat, lng]) => [lng, lat])] }
      const data = await zoneAPI.create({ floorId: floor.id, name: zoneForm.name.trim() || `${zoneForm.type} zone`, type: zoneForm.type, coordinates })
      setZones((all) => [...all, data.zone]); setPoints([]); setZoneForm({ name: '', type: zoneForm.type }); setNotice('Zone saved. Draw another zone or continue.')
    } catch (error) { setNotice(error.message || 'Unable to create zone.') }
  }

  function zoneAt(lat, lng) {
    return zones.find((zone) => {
      const ring = zone.coordinates?.coordinates?.[0]; if (!ring) return false
      let inside = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if (((yi > lat) !== (yj > lat)) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside }
      return inside
    })
  }

  async function placeItem(point, type) {
    if (busy || !plan) return
    const b = plan.geoBounds; const x = ((point.lng - b.westLng) / (b.eastLng - b.westLng)) * plan.width; const y = ((b.northLat - point.lat) / (b.northLat - b.southLat)) * plan.height
    setBusy(true)
    const token = Math.random().toString(36).slice(2, 8).toUpperCase(); const zone = zoneAt(point.lat, point.lng)
    try {
      const data = await deviceAPI.create({ deviceEui: `${type.toUpperCase()}-${token}`, badgeId: `${type.toUpperCase()}-${token}`, floorId: floor.id, zoneId: zone?.id || null, deviceType: type, batteryLevel: type === 'gateway' ? 100 : 90, floorPlanPosX: x, floorPlanPosY: y })
      setDevices((all) => [...all, data.device]); setNotice(`${TYPE_META[type].label} placed${zone ? ` in ${zone.name}` : ''}.`)
    } catch (error) { setNotice(error.message || `Unable to place ${type}.`) } finally { setBusy(false) }
  }

  async function importGeoJson(event) {
    const file = event.target.files?.[0]; if (!file) return
    try {
      const geojson = JSON.parse(await file.text()); const features = geojson.type === 'FeatureCollection' ? geojson.features : [geojson]
      for (const [index, feature] of features.entries()) { if (feature.geometry?.type !== 'Polygon') continue; const data = await zoneAPI.create({ floorId: floor.id, name: feature.properties?.name || `Imported zone ${index + 1}`, type: feature.properties?.type || 'other', coordinates: feature.geometry }); setZones((all) => [...all, data.zone]) }
      setNotice('GeoJSON zones imported onto this floor plan.')
    } catch { setNotice('That GeoJSON file could not be imported.') }
  }

  const zonePositions = (zone) => zone.coordinates?.coordinates?.[0]?.map(([lng, lat]) => [lat, lng]) || []
  const devicePosition = (device) => plan && [plan.geoBounds.northLat - (device.floorPlanPosY / plan.height) * (plan.geoBounds.northLat - plan.geoBounds.southLat), plan.geoBounds.westLng + (device.floorPlanPosX / plan.width) * (plan.geoBounds.eastLng - plan.geoBounds.westLng)]

  return <div className="site-planner">
    <header className="site-planner__header"><div><h1>Site Planner Wizard</h1><p>Step {step} — {steps[step - 1][0]}</p><span>{steps[step - 1][1]}</span></div><button className="planner-button planner-button--ghost" onClick={() => setStep(1)}>Back to Site Planner Wizard</button></header>
    <Stepper currentStep={step} setCurrentStep={setStep} ready={ready} />
    {notice && <div className="planner-notice">{notice}<button onClick={() => setNotice('')}>×</button></div>}

    {step === 1 && <section className="planner-form-card"><div className="planner-form">
      <label>Site Name <b>*</b><input value={siteForm.name} placeholder="e.g. Chandigarh Site" onChange={(e) => setSiteForm({ ...siteForm, name: e.target.value })} /></label>
      <label>Site Type <b>*</b><select value={siteForm.type} onChange={(e) => setSiteForm({ ...siteForm, type: e.target.value })}><option value="">Select a site type...</option><option>Office</option><option>Hospital</option><option>School</option><option>Retail</option><option>Home</option></select></label>
      <label>Location <b>*</b><input value={siteForm.location} placeholder="e.g. Chandigarh, India" onChange={(e) => setSiteForm({ ...siteForm, location: e.target.value })} /></label>
      <label>Description <em>(optional)</em><textarea value={siteForm.description} placeholder="e.g. Main campus building" onChange={(e) => setSiteForm({ ...siteForm, description: e.target.value })} /></label>
      <div className="planner-coordinates"><strong>Coordinates <b>*</b></strong><p>Provide the site’s GPS centre point. Use “Mark centre on map” to pick visually.</p><div><label>Latitude<input value={siteForm.latitude} placeholder="-90 to 90" onChange={(e) => setSiteForm({ ...siteForm, latitude: e.target.value })} /></label><label>Longitude<input value={siteForm.longitude} placeholder="-180 to 180" onChange={(e) => setSiteForm({ ...siteForm, longitude: e.target.value })} /></label></div><button className="planner-button planner-button--dark" onClick={() => setPickerOpen(true)}>⌖ Mark centre on map</button></div>
    </div><footer><button className="planner-button" disabled={busy} onClick={saveSite}>Save & Continue →</button></footer></section>}

    {step === 2 && <section className="planner-workspace"><aside className="planner-sidebar"><div className="planner-sidebar__heading"><strong>Floors</strong><button className="planner-button" onClick={() => setAddFloorOpen(true)}>＋ Add Floor</button></div>{floors.length ? floors.map((item) => <button key={item.id} className={`planner-floor ${floor?.id === item.id ? 'is-selected' : ''}`} onClick={() => setFloor(item)}><span>{item.floorNumber ?? '—'}</span>{item.floorName}</button>) : <div className="planner-empty">No floors yet.<button onClick={() => setAddFloorOpen(true)}>＋ Add your first floor</button></div>}</aside><main className="planner-stage planner-stage--empty"><div><strong>{floor ? floor.floorName : 'Add a floor to begin'}</strong><p>Select a floor to upload and align its image on the map.</p>{floor && <button className="planner-button" onClick={() => setStep(3)}>Next: Floor plan →</button>}</div></main></section>}

    {step === 2 && <section className="planner-floor-map"><aside className="planner-floor-map__sidebar"><div className="planner-sidebar__heading"><strong>Floors</strong><button className="planner-button" onClick={() => setAddFloorOpen(true)}>+ Add Floor</button></div>{floors.map((item) => <button key={item.id} className={`planner-floor ${floor?.id === item.id ? 'is-selected' : ''}`} onClick={() => setFloor(item)}><span>{item.floorNumber ?? '-'}</span>{item.floorName}</button>)}{floors.length === 0 && <div className="planner-empty">No floors yet.</div>}</aside><main className="planner-floor-map__canvas"><MapContainer center={center} zoom={17} style={{ height: '100%', width: '100%' }}><TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="OpenStreetMap" /><MapFocus center={center} zoom={17} /><SitePin location={site} /></MapContainer><div className="planner-floor-map__tools">⌖<br />▧</div></main><footer className="planner-floor-map__footer"><button className="planner-button planner-button--ghost" onClick={() => setStep(1)}>Back</button><button className="planner-button" disabled={!floor} onClick={() => setStep(3)}>Save & Continue →</button></footer></section>}

    {step === 2 && <section className="planner-floor-plan-map"><aside className="planner-floor-map__sidebar"><div className="planner-sidebar__heading"><strong>Floors</strong><button className="planner-button" onClick={() => setAddFloorOpen(true)}>+ Add Floor</button></div>{floors.map((item) => <button key={item.id} className={`planner-floor ${floor?.id === item.id ? 'is-selected' : ''}`} onClick={() => setFloor(item)}><span>{item.floorNumber ?? '-'}</span>{item.floorName}</button>)}{floor && <button className="planner-button planner-floor-plan-map__upload" onClick={() => fileRef.current?.click()}>Upload floor plan</button>}<input ref={fileRef} hidden type="file" accept="image/*" onChange={uploadPlan} /></aside><main className="planner-floor-map__canvas"><MapContainer center={center} zoom={17} style={{ height: '100%', width: '100%' }}><TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="OpenStreetMap" /><MapFocus center={center} zoom={17} /><MapClick onClick={onMapClick} /><SitePin location={site} />{bounds && <ImageOverlay bounds={bounds} url={plan.imageData} opacity={0.45} />}</MapContainer>{plan && <div className="planner-floor-plan-map__align"><strong>Align tracing image</strong><small>Click the map to move the floor plan.</small><div><button onClick={() => adjustPlan('up')}>Up</button><button onClick={() => adjustPlan('left')}>Left</button><button onClick={() => adjustPlan('right')}>Right</button><button onClick={() => adjustPlan('down')}>Down</button><button onClick={() => adjustPlan('grow')}>Zoom in</button><button onClick={() => adjustPlan('shrink')}>Zoom out</button></div></div>}</main><footer className="planner-floor-map__footer"><button className="planner-button planner-button--ghost" onClick={() => setStep(1)}>Back</button><button className="planner-button" disabled={!floor} onClick={plan ? savePlan : () => setStep(3)}>{plan ? 'Save & Continue' : 'Continue to upload'}</button></footer></section>}

    {step >= 3 && <section className="planner-map-shell"><div className="planner-mapbar"><div>{floor && <select value={floor.id} onChange={(e) => setFloor(floors.find((item) => item.id === e.target.value))}>{floors.map((item) => <option key={item.id} value={item.id}>{item.floorName}{item.floorNumber !== null ? ` (Floor ${item.floorNumber})` : ''}</option>)}</select>}</div>{step === 3 && <button className="planner-button planner-button--ghost" onClick={() => fileRef.current?.click()}>⇧ Upload floor plan</button>}{step === 3 && <input ref={fileRef} hidden type="file" accept="image/*" onChange={uploadPlan} />}{step === 4 && <button className="planner-button planner-button--ghost" onClick={() => geoJsonRef.current?.click()}>⇧ Upload GeoJSON</button>}{step === 4 && <input ref={geoJsonRef} hidden type="file" accept="application/json,.geojson" onChange={importGeoJson} />}</div>
      <div className="planner-map"><MapContainer center={center} zoom={17} style={{ height: '100%', width: '100%' }}><TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" /><MapFocus center={center} zoom={17} /><MapClick onClick={onMapClick} /><SitePin location={site} />{bounds && <ImageOverlay bounds={bounds} url={plan.imageData} opacity={0.45} />}{zones.map((zone) => <Polygon key={zone.id} positions={zonePositions(zone)} color={ZONE_COLORS[zone.type] || ZONE_COLORS.other} fillColor={ZONE_COLORS[zone.type] || ZONE_COLORS.other} fillOpacity={.18} />)}{drawing && points.length > 1 && <Polygon positions={[...points, points[0]]} color="#38bdf8" dashArray="6 6" />}{devices.map((item) => { const position = devicePosition(item); return position ? <Marker key={item.id} position={position} icon={divIcon(item.deviceType)} /> : null })}</MapContainer>
        {step === 3 && plan && <div className="planner-align"><strong>Align tracing image</strong><small>Move and scale the plan against the site map.</small><div className="planner-align__controls"><button onClick={() => adjustPlan('up')}>↑</button><button onClick={() => adjustPlan('left')}>←</button><button onClick={() => adjustPlan('right')}>→</button><button onClick={() => adjustPlan('down')}>↓</button><button onClick={() => adjustPlan('grow')}>＋</button><button onClick={() => adjustPlan('shrink')}>−</button></div><button className="planner-button" onClick={savePlan}>✓ Save & Continue</button></div>}
        {step === 4 && <div className="planner-toolbox"><strong>Draw zones</strong>{drawing ? <><input placeholder="Zone name" value={zoneForm.name} onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })} /><select value={zoneForm.type} onChange={(e) => setZoneForm({ ...zoneForm, type: e.target.value })}>{Object.keys(ZONE_COLORS).map((type) => <option key={type}>{type}</option>)}</select><small>{drawingMode === 'rectangle' ? 'Click two opposite corners of the rectangle.' : `Click the plan to add vertices (${points.length}/3 minimum).`}</small><button className="planner-button" onClick={finishZone}>Save zone</button><button className="planner-button planner-button--ghost" onClick={() => { setDrawing(false); setPoints([]) }}>Cancel</button></> : <><p>Define spatial zones for restrooms, corridors, lobbies and maintenance areas.</p><button className="planner-button" onClick={() => { setDrawingMode('polygon'); setDrawing(true) }}>⌗ Draw polygon</button><button className="planner-button planner-button--ghost" onClick={() => { setDrawingMode('rectangle'); setDrawing(true) }}>□ Draw rectangle</button></>}</div>}
        {step === 4 && <div className="planner-placement"><strong>Zone drawing</strong><p>Create zones by drawing polygons or rectangles on the map.</p><div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button className="planner-button planner-button--ghost" onClick={() => setStep(3)}>Back</button>
          <button className="planner-button" onClick={() => setStep(5)}>Save & Continue →</button>
        </div></div>}
        {[5, 6, 7].includes(step) && <div className="planner-placement"><strong>{TYPE_META[step === 5 ? 'badge' : step === 6 ? 'device' : 'gateway'].label} placement</strong><p>Click inside a zone to place an item. Its floor and zone association are saved automatically.</p><div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button className="planner-button planner-button--ghost" onClick={() => setStep(4)}>Back</button>
          <button className="planner-button" onClick={() => step < 7 ? setStep(step + 1) : setStep(8)}>Save & Continue →</button>
        </div></div>}
      </div>
    </section>}

    {step === 8 && <section className="planner-review"><h2>Review site configuration</h2><p>Everything below is spatially connected to the selected site centre.</p><div className="planner-review__tree"><strong>{site?.officeName}</strong><span>↳ {site?.latitude?.toFixed(6)}, {site?.longitude?.toFixed(6)}</span>{floors.map((item) => <div key={item.id}><strong>↳ {item.floorName}</strong>{item.id === floor?.id && <><span>↳ Floor plan: {plan?.name || 'Not uploaded'}</span>{zones.map((z) => <span key={z.id}>↳ Zone: {z.name} ({z.type})</span>)}{devices.map((d) => <span key={d.id}>↳ {TYPE_META[d.deviceType]?.label || 'Device'}: {d.badgeId}</span>)}</>}</div>)}</div><button className="planner-button" onClick={() => navigate('/dashboard')}>Finish</button></section>}
    {pickerOpen && <CenterPicker initial={siteForm.latitude ? [Number(siteForm.latitude), Number(siteForm.longitude)] : null} onCancel={() => setPickerOpen(false)} onSave={setCoords} />}
    {addFloorOpen && <div className="planner-modal-backdrop"><div className="planner-modal planner-modal--small"><button className="planner-modal__close" onClick={() => setAddFloorOpen(false)}>×</button><h2>Add Floor</h2><label>Floor Name <b>*</b><input autoFocus value={floorForm.name} placeholder="e.g. Ground Floor" onChange={(e) => setFloorForm({ ...floorForm, name: e.target.value })} /></label><label>Floor Number <b>*</b><input type="number" value={floorForm.number} placeholder="0 for ground, 1 for first floor" onChange={(e) => setFloorForm({ ...floorForm, number: e.target.value })} /></label><div className="planner-modal__actions"><button className="planner-button planner-button--ghost" onClick={() => setAddFloorOpen(false)}>Cancel</button><button className="planner-button" disabled={busy} onClick={addFloor}>Add Floor</button></div></div></div>}
  </div>
}
