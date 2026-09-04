import { Fragment, useEffect, useMemo, useRef, useState, useCallback } from 'react'
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

/**
 * RotatableImageOverlay
 *
 * Appends an <img> into Leaflet's overlayPane, positions it using
 * latLngToLayerPoint, and applies CSS rotate() around the geo-centre.
 * Uses refs so the single stable `update` function always reads fresh
 * values — no stale-closure issues with map event listeners.
 */
function RotatableImageOverlay({ bounds, url, opacity = 0.7, rotation = 0, imgRef: externalImgRef }) {
  const map      = useMap()
  const localRef = useRef(null)
  const imgRef   = externalImgRef || localRef

  // Keep refs current on every render — update() always reads fresh values
  const boundsRef   = useRef(bounds)
  const rotationRef = useRef(rotation)
  const opacityRef  = useRef(opacity)
  boundsRef.current   = bounds
  rotationRef.current = rotation
  opacityRef.current  = opacity

  // Single stable update function — reads from refs, never stale
  const update = useCallback(() => {
    if (!boundsRef.current || !map || !imgRef.current) return

    const [[n, w], [s, e]] = boundsRef.current
    const nwPx = map.latLngToLayerPoint([n, w])
    const sePx = map.latLngToLayerPoint([s, e])

    const wPx = Math.abs(sePx.x - nwPx.x)
    const hPx = Math.abs(sePx.y - nwPx.y)

    const img = imgRef.current
    img.style.left            = `${nwPx.x}px`
    img.style.top             = `${nwPx.y}px`
    img.style.width           = `${wPx}px`
    img.style.height          = `${hPx}px`
    img.style.transformOrigin = '50% 50%'
    img.style.transform       = `rotate(${rotationRef.current}deg)`
    img.style.transition      = 'transform 0.2s ease'
    img.style.opacity         = String(opacityRef.current)
    img.style.display         = 'block'
  }, [map]) // map is the only real dependency — everything else via refs

  const resetOnZoom = useCallback(() => {
    requestAnimationFrame(update)
  }, [update])

  // Mount: create the img element and attach map listeners once
  useEffect(() => {
    if (!map || !url) return

    const pane = map.getPanes().overlayPane
    pane.style.overflow = 'visible'

    const img = document.createElement('img')
    img.src              = url
    img.style.position   = 'absolute'
    img.style.display    = 'none'
    img.style.pointerEvents = 'none'
    pane.appendChild(img)
    imgRef.current = img

    img.onload = update
    update()

    map.on('move',    update)
    map.on('zoom',    resetOnZoom)
    map.on('moveend', update)
    map.on('zoomend', update)

    return () => {
      map.off('move',    update)
      map.off('zoom',    resetOnZoom)
      map.off('moveend', update)
      map.off('zoomend', update)
      if (img.parentNode) img.parentNode.removeChild(img)
      imgRef.current = null
    }
  }, [map, url, update, resetOnZoom])

  // Re-apply whenever bounds / rotation / opacity change
  useEffect(() => {
    update()
  }, [bounds, rotation, opacity, update])

  return null
}

/**
 * DraggablePlanOverlay
 *
 * Makes the floor plan image directly draggable on the map by:
 * 1. Enabling pointer events on the img element
 * 2. Intercepting mousedown/touchstart on the img to start a drag
 * 3. Computing delta from drag start position to update geoBounds
 * 4. Corner markers for resize (rotation-aware positions)
 * 5. Centre marker as a visible drag handle fallback
 */
function rotatePt(lat, lng, cLat, cLng, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const dLat = lat - cLat
  const dLng = lng - cLng
  return {
    lat: cLat + dLat * cos - dLng * sin,
    lng: cLng + dLat * sin + dLng * cos,
  }
}

function cornerIcon(label) {
  return L.divIcon({
    className: '',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    html: `<div style="width:24px;height:24px;background:#0891b2;border:2.5px solid #fff;border-radius:4px;display:grid;place-items:center;color:#fff;font-size:9px;font-weight:800;box-shadow:0 2px 8px rgba(0,0,0,0.55);cursor:nwse-resize;pointer-events:auto;touch-action:none">${label}</div>`,
  })
}

function centerDragIcon() {
  return L.divIcon({
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `<div style="width:28px;height:28px;background:#0891b2;border:3px solid #fff;border-radius:50%;display:grid;place-items:center;cursor:move;box-shadow:0 2px 10px rgba(0,0,0,0.55);font-size:15px">✥</div>`,
  })
}

function DraggablePlanOverlay({ geoBounds, rotation = 0, onBoundsChange, onTransformEnd, imgRef }) {
  const map           = useMap()
  const boundsRef     = useRef(geoBounds)
  const rotRef        = useRef(rotation)
  const onChangeRef   = useRef(onBoundsChange)
  const onTransformEndRef = useRef(onTransformEnd)
  useEffect(() => { boundsRef.current   = geoBounds     }, [geoBounds])
  useEffect(() => { rotRef.current      = rotation      }, [rotation])
  useEffect(() => { onChangeRef.current = onBoundsChange }, [onBoundsChange])
  useEffect(() => { onTransformEndRef.current = onTransformEnd }, [onTransformEnd])

  // ── Stable image drag (mousedown on the <img> itself) ─────────
  useEffect(() => {
    const img = imgRef?.current
    if (!img || !map) return

    let dragStart = null

    function onMouseDown(e) {
      if (e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      map.dragging.disable()
      const b = boundsRef.current
      dragStart = { mouseX: e.clientX, mouseY: e.clientY, origBounds: { ...b }, lastBounds: { ...b } }

      function onMouseMove(me) {
        if (!dragStart) return
        const dx = me.clientX - dragStart.mouseX
        const dy = me.clientY - dragStart.mouseY
        const startPt = map.latLngToContainerPoint([
          (dragStart.origBounds.northLat + dragStart.origBounds.southLat) / 2,
          (dragStart.origBounds.eastLng  + dragStart.origBounds.westLng)  / 2,
        ])
        const endLatLng   = map.containerPointToLatLng({ x: startPt.x + dx, y: startPt.y + dy })
        const startLatLng = map.containerPointToLatLng(startPt)
        const dLat = endLatLng.lat - startLatLng.lat
        const dLng = endLatLng.lng - startLatLng.lng
        const ob = dragStart.origBounds
        dragStart.lastBounds = {
          northLat: ob.northLat + dLat,
          southLat: ob.southLat + dLat,
          eastLng:  ob.eastLng  + dLng,
          westLng:  ob.westLng  + dLng,
        }
        onChangeRef.current(dragStart.lastBounds)
      }

      function onMouseUp() {
        if (dragStart) onTransformEndRef.current?.(dragStart.lastBounds)
        dragStart = null
        map.dragging.enable()
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('mouseup',   onMouseUp)
      }

      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup',   onMouseUp)
    }

    img.style.cursor        = 'move'
    img.style.pointerEvents = 'auto'
    img.addEventListener('mousedown', onMouseDown)
    return () => {
      img.removeEventListener('mousedown', onMouseDown)
      img.style.pointerEvents = 'none'
      img.style.cursor        = ''
    }
  }, [map, imgRef])

  // ── Stable corner & centre drag handlers (stable refs → no re-registration) ──
  const onCenterDragRef = useRef(null)
    // Keep pointer events enabled after map re-renders that reset img styles
    const keepEnabled = () => { img.style.pointerEvents = 'auto'; img.style.cursor = 'move' }
    map.on('moveend', keepEnabled); map.on('zoomend', keepEnabled)
  onCenterDragRef.current = (e) => {
    const b = boundsRef.current
      map.off('moveend', keepEnabled); map.off('zoomend', keepEnabled)
    const oldCLat = (b.northLat + b.southLat) / 2
    const oldCLng = (b.eastLng  + b.westLng)  / 2
    const halfLat = (b.northLat - b.southLat) / 2
    const halfLng = (b.eastLng  - b.westLng)  / 2
    const { lat, lng } = e.target.getLatLng()
    const dLat = lat - oldCLat
    const dLng = lng - oldCLng
    onChangeRef.current({
      northLat: lat + halfLat,
      southLat: lat - halfLat,
      eastLng:  lng + halfLng,
      westLng:  lng - halfLng,
    })
    // Move the site pin with the plan
    onPlanDragRef.current?.({ dLat, dLng })
  }

  const onCornerDragRef = useRef(null)
  onCornerDragRef.current = (corner, latLng) => {
    const b    = boundsRef.current
    const rot  = rotRef.current
    const { lat: vLat, lng: vLng } = latLng
    const cLat2 = (b.northLat + b.southLat) / 2
    const cLng2 = (b.eastLng  + b.westLng)  / 2
    // Un-rotate the dragged visual position back to axis-aligned space
    const { lat: aLat, lng: aLng } = rotatePt(vLat, vLng, cLat2, cLng2, -rot)
    let next = { ...b }
    if (corner === 'NW') { next.northLat = aLat; next.westLng = aLng }
    if (corner === 'NE') { next.northLat = aLat; next.eastLng = aLng }
    if (corner === 'SW') { next.southLat = aLat; next.westLng = aLng }
    if (corner === 'SE') { next.southLat = aLat; next.eastLng = aLng }
    // enforce minimum size so plan never inverts
    if (next.northLat <= next.southLat) {
      if (corner === 'NW' || corner === 'NE') next.northLat = b.southLat + 0.00005
      else next.southLat = b.northLat - 0.00005
    }
    if (next.eastLng <= next.westLng) {
      if (corner === 'NE' || corner === 'SE') next.eastLng = b.westLng + 0.00005
      else next.westLng = b.eastLng - 0.00005
    }
    onChangeRef.current(next)
    return next
  }

  // Resize using the same four markers, but manage pointer movement ourselves.
  // This avoids Leaflet treating a handle drag as a map/image drag.
  const cornerHandlers = useMemo(() => ({
    NW: { mousedown: (e) => startCornerResize('NW', e) },
    NE: { mousedown: (e) => startCornerResize('NE', e) },
    SW: { mousedown: (e) => startCornerResize('SW', e) },
    SE: { mousedown: (e) => startCornerResize('SE', e) },
  }), [map])

  function startCornerResize(corner, event) {
    const originalEvent = event.originalEvent
    originalEvent?.preventDefault()
    originalEvent?.stopPropagation()
    map.dragging.disable()
    let lastBounds = null

    function move(mouseEvent) {
      lastBounds = onCornerDragRef.current(corner, map.mouseEventToLatLng(mouseEvent))
    }

    function end() {
      map.dragging.enable()
      if (lastBounds) onTransformEndRef.current?.(lastBounds)
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', end)
    }

    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', end)
  }

  if (!geoBounds) return null

  const { northLat, southLat, eastLng, westLng } = geoBounds
  const cLat = (northLat + southLat) / 2
  const cLng = (eastLng  + westLng)  / 2

  // Rotate corner positions to their visual locations on the map
  const corners = [
    { id: 'NW', lat: northLat, lng: westLng },
    { id: 'NE', lat: northLat, lng: eastLng },
    { id: 'SW', lat: southLat, lng: westLng },
    { id: 'SE', lat: southLat, lng: eastLng },
  ].map((c) => ({ ...c, ...rotatePt(c.lat, c.lng, cLat, cLng, rotation) }))

  return (
    <>
      {/* Centre drag handle — drag the ✥ icon to move the entire plan */}
      <Marker
        position={[cLat, cLng]}
        icon={centerDragIcon()}
        zIndexOffset={2000}
        draggable={true}
        eventHandlers={{
          drag: (e) => { onCenterDragRef.current(e) },
          dragend: () => { onTransformEndRef.current?.(boundsRef.current) },
        }}
      />
      {/* Corner resize handles */}
      {corners.map((c) => (
        <Marker
          key={c.id}
          position={[c.lat, c.lng]}
          icon={cornerIcon(c.id)}
          zIndexOffset={1000}
          draggable={false}
          eventHandlers={cornerHandlers[c.id]}
        />
      ))}
    </>
  )
}


const ZONE_COLORS = { restroom: '#38bdf8', corridor: '#94a3b8', lobby: '#34d399', maintenance: '#fbbf24', other: '#a78bfa' }
const TYPE_META = {
  badge: { icon: '◉', label: 'Badge', color: '#8b5cf6' },
  device: { icon: '▣', label: 'Device', color: '#38bdf8' },
  gateway: { icon: '⌁', label: 'Gateway', color: '#f59e0b' },
  restroom: { icon: '🚻', label: 'Restroom', color: '#0ea5e9' },
}

const steps = [
  ['Define Site', 'Name & location'],
  ['Floor Plans', 'Upload & position floor image'],
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
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="" maxNativeZoom={19} maxZoom={22} />
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

function CenterPicker({ initial, initialQuery = '', onCancel, onSave }) {
  const [selected, setSelected] = useState(initial || null)
  const [focus, setFocus] = useState(initial || DEFAULT_CENTER)
  const [query, setQuery] = useState(initialQuery)
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
                <button type="button" key={result.place_id} onClick={() => {
                  const addressPoint = [Number(result.lat), Number(result.lon)]
                  setSelected(addressPoint)
                  setFocus(addressPoint)
                  setResults([])
                }}>
                  {result.display_name}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="planner-picker-map">
          <MapContainer center={focus} zoom={initial ? 15 : 5} className="planner-map-container">
            <MapFocus center={focus} zoom={15} />
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" maxNativeZoom={19} maxZoom={22} />
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
  const planImgRef = useRef(null) // shared ref between RotatableImageOverlay and DraggablePlanOverlay
  const [step, setStep] = useState(1)

  // Listen for tour-driven wizard step changes
  useEffect(() => {
    function handleTourStep(e) {
      const s = e.detail?.step
      if (s >= 1 && s <= 6) setStep(s)
    }
    window.addEventListener('srfs-site-config-step', handleTourStep)
    return () => window.removeEventListener('srfs-site-config-step', handleTourStep)
  }, [])
  const [site, setSite] = useState(null)
  const [floors, setFloors] = useState([])
  const [floor, setFloor] = useState(null)
  const [plans, setPlans] = useState([])       // all floor plans for the active floor
  const [plan, setPlan] = useState(null)        // currently active / being aligned plan
  const [planRotation, setPlanRotation] = useState(0)
  const [planScale, setPlanScale] = useState(1)
  const [planOpacity, setPlanOpacity] = useState(0.7)
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
  const [siteStats, setSiteStats] = useState({ zones: 0, devices: 0, gateways: 0 })
  const [allDevices, setAllDevices] = useState([])
  const [allGateways, setAllGateways] = useState([])
  const [selectedDeviceId, setSelectedDeviceId] = useState(null)
  const [selectedGatewayId, setSelectedGatewayId] = useState(null)
  const [placingType, setPlacingType] = useState(null)
  const [editingZoneId, setEditingZoneId] = useState(null)
  const [editingZoneForm, setEditingZoneForm] = useState({ name: '', type: 'restroom' })
  const [editingZonePoints, setEditingZonePoints] = useState([])
  const [editingZoneRedrawing, setEditingZoneRedrawing] = useState(false)
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

  const currentFloorIdRef = useRef(null)

  useEffect(() => {
    currentFloorIdRef.current = floor?.id || null
  }, [floor])
  const floorCache = useRef({}) // cache: floorId → { plans, zones, restrooms, devices, gateways }
  const [floorLoading, setFloorLoading] = useState(false)
  const [reviewData, setReviewData] = useState({}) // floorId → { plans, zones, devices, gateways }

  useEffect(() => {
    if (!floor) return

    // If we have cached data for this floor, apply it instantly
    const cached = floorCache.current[floor.id]
    if (cached) {
      setPlans(cached.plans)
      setPlan(cached.plans[0] || null)
      if (cached.plans[0]) {
        syncLocationMarkerToPlan(cached.plans[0])
        setPlanRotation(cached.plans[0].rotation || 0)
        setPlanScale(cached.plans[0].scale || 1)
      } else {
        setPlanRotation(0)
        setPlanScale(1)
        setPlanOpacity(0.45)
      }
      setZones(cached.zones)
      setRestrooms(cached.restrooms)
      setDevices(cached.devices)
      setGateways(cached.gateways)
      // Refresh in background silently to pick up any changes
      refreshFloorData(floor.id, true)
      return
    }

    // No cache — clear stale data immediately so UI shows loading state
    setPlans([])
    setPlan(null)
    setPlanRotation(0)
    setPlanScale(1)
    setZones([])
    setRestrooms([])
    setDevices([])
    setGateways([])
    setFloorLoading(true)
    refreshFloorData(floor.id, false)
  }, [floor]) // eslint-disable-line

  async function refreshFloorData(floorId, silent) {
    // Invalidate cache so next switch always gets fresh data
    delete floorCache.current[floorId]
    try {
      const [planRes, zoneData, restroomData, deviceData, gatewayData, allDevData, allGwData] = await Promise.all([
        floorPlanAPI.getByFloor(floorId),
        zoneAPI.getByFloor(floorId),
        restroomAPI.getByFloor(floorId),
        deviceAPI.getByFloor(floorId),
        gatewayAPI.getAll({ floorId }),
        deviceAPI.getAll(),
        gatewayAPI.getAll(),
      ])

      const allPlans   = planRes.floorPlans || []
      const zones      = zoneData.zones || []
      const restrooms  = restroomData.restrooms || []
      const devices    = deviceData.devices || []
      const gateways   = gatewayData.gateways || []

      // Store in cache for instant switching
      floorCache.current[floorId] = { plans: allPlans, zones, restrooms, devices, gateways }

      // Only apply if this floor is still selected (user hasn't switched again)
      if (currentFloorIdRef.current !== floorId) return

      const planData = allPlans[0] || null
      setPlans(allPlans)
      setPlan(planData)
      if (planData) {
        syncLocationMarkerToPlan(planData)
        setPlanRotation(planData.rotation || 0)
        setPlanScale(planData.scale || 1)
      } else {
        setPlanRotation(0)
        setPlanScale(1)
        if (!silent) setPlanOpacity(0.45)
      }
      setZones(zones)
      setRestrooms(restrooms)
      setDevices(devices)
      setGateways(gateways)
      setAllDevices(allDevData.devices || [])
      setAllGateways(allGwData.gateways || [])
    } catch {
      if (!silent) setNotice('Could not load floor data.')
    } finally {
      if (!silent) setFloorLoading(false)
    }
  }

  useEffect(() => {
    loadLocations()
  }, [loadLocations])

  // Load all floors' data when entering review step
  useEffect(() => {
    if (step !== 6 || !floors.length) return
    async function loadReview() {
      const results = await Promise.all(
        floors.map(async (f) => {
          // Use cache first, fall back to fetch
          if (floorCache.current[f.id]) {
            return [f.id, floorCache.current[f.id]]
          }
          const [planRes, zoneData, deviceData, gatewayData] = await Promise.all([
            floorPlanAPI.getByFloor(f.id),
            zoneAPI.getByFloor(f.id),
            deviceAPI.getByFloor(f.id),
            gatewayAPI.getAll({ floorId: f.id }),
          ])
          return [f.id, {
            plans:    planRes.floorPlans || [],
            zones:    zoneData.zones     || [],
            devices:  deviceData.devices  || [],
            gateways: gatewayData.gateways || [],
          }]
        })
      )
      setReviewData(Object.fromEntries(results))
    }
    loadReview().catch(() => {})
  }, [step, floors]) // eslint-disable-line
  useEffect(() => {
    if (!selectedLocationId || !floors.length) return
    loadSiteStats(selectedLocationId, floors)
  }, [zones.length, devices.length, gateways.length]) // eslint-disable-line

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
    setEditingZoneRedrawing(false)
    setDrawing(false)
    setPoints([])
  }, [step])

  useEffect(() => {
    if (step === 3 && floor) {
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

  const [geocoding, setGeocoding] = useState(false)
  async function geocodeAddress() {
    const query = [siteForm.description, siteForm.location].filter(Boolean).join(', ')
    if (!query.trim()) { setNotice('Enter a location or description first.'); return }
    setGeocoding(true)
    try {
      const token = localStorage.getItem('srfs_token')
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const response = await fetch(`${API_URL}/api/locations/search?q=${encodeURIComponent(query)}`, { headers })
      if (!response.ok) throw new Error('Search failed')
      const data = await response.json()
      const first = data.results?.[0]
      if (!first) { setNotice('No coordinates found for that address. Try a more specific address.'); return }
      setSiteForm((v) => ({ ...v, latitude: String(Number(first.lat).toFixed(6)), longitude: String(Number(first.lon).toFixed(6)) }))
      setNotice(`Coordinates set from address: ${first.display_name || query}`)
    } catch {
      setNotice('Could not fetch coordinates. Check your address and try again.')
    } finally {
      setGeocoding(false)
    }
  }

  const siteRef = useRef(site)
  const origSiteRef = useRef(null) // site position at drag start
  siteRef.current = site

  function handleSitePinMove(lat, lng) {
    setSiteForm((v) => ({ ...v, latitude: String(lat), longitude: String(lng) }))
    const current = siteRef.current
    if (current) {
      const next = { ...current, latitude: lat, longitude: lng }
      siteRef.current = next
      setSite(next)
    }
  }

  function syncLocationMarkerToPlan(planData) {
    const b = planData?.geoBounds
    if (!b) return
    handleSitePinMove(
      (b.northLat + b.southLat) / 2,
      (b.eastLng + b.westLng) / 2,
    )
  }

  function handlePlanLocationPinMove(lat, lng) {
    const previousLocation = siteRef.current
    if (previousLocation && plan?.geoBounds) {
      const dLat = lat - previousLocation.latitude
      const dLng = lng - previousLocation.longitude
      setPlan((currentPlan) => {
        if (!currentPlan?.geoBounds) return currentPlan
        const b = currentPlan.geoBounds
        return {
          ...currentPlan,
          geoBounds: {
            northLat: b.northLat + dLat,
            southLat: b.southLat + dLat,
            eastLng: b.eastLng + dLng,
            westLng: b.westLng + dLng,
          },
        }
      })
    }
    handleSitePinMove(lat, lng)
  }

  function handlePlanDrag({ dLat, dLng }) {
    // dLat/dLng is the absolute delta from the drag-start position
    // Use the original site position captured at drag start
    const orig = origSiteRef.current
    if (!orig) return
    const newLat = orig.latitude  + dLat
    const newLng = orig.longitude + dLng
    const next = { ...siteRef.current, latitude: newLat, longitude: newLng }
    siteRef.current = next
    setSite(next)
    setSiteForm((v) => ({ ...v, latitude: String(newLat), longitude: String(newLng) }))
  }

  function handlePlanBoundsChange(nextBounds) {
    setPlan((currentPlan) => currentPlan ? { ...currentPlan, geoBounds: nextBounds } : currentPlan)
  }

  async function savePlanAlignment(nextBounds, nextRotation, nextScale) {
    if (!plan?.id) return
    const geoBounds = nextBounds || plan.geoBounds
    const rotation = nextRotation ?? planRotation
    const scale = nextScale ?? planScale
    if (!geoBounds) return
    try {
      await floorPlanAPI.update(plan.id, { geoBounds, rotation, scale })
      if (floor?.id && floorCache.current[floor.id]) {
        floorCache.current[floor.id] = {
          ...floorCache.current[floor.id],
          plans: floorCache.current[floor.id].plans.map((p) =>
            p.id === plan.id ? { ...p, geoBounds, rotation, scale } : p
          ),
        }
      }
    } catch (error) {
      console.error('Auto-save plan alignment error:', error)
    }
  }

  async function handlePlanTransformEnd(nextBounds) {
    if (!nextBounds) return
    const latitude = (nextBounds.northLat + nextBounds.southLat) / 2
    const longitude = (nextBounds.eastLng + nextBounds.westLng) / 2
    handleSitePinMove(latitude, longitude)
    await savePlanAlignment(nextBounds, planRotation, planScale)
  }

  async function loadLocations() {
    try {
      const data = await locationAPI.getAll(user?.organizationId)
      setLocations(data.locations || [])
    } catch { }
  }

  async function loadSiteStats(locationId, allFloors) {
    if (!locationId || !allFloors?.length) {
      setSiteStats({ zones: 0, devices: 0, gateways: 0 })
      return
    }
    try {
      const results = await Promise.all(
        allFloors.map((f) => Promise.all([
          zoneAPI.getByFloor(f.id),
          deviceAPI.getByFloor(f.id),
          gatewayAPI.getAll({ floorId: f.id }),
        ]))
      )
      const stats = results.reduce((acc, [z, d, g]) => ({
        zones:    acc.zones    + (z.zones?.length    || 0),
        devices:  acc.devices  + (d.devices?.length  || 0),
        gateways: acc.gateways + (g.gateways?.length || 0),
      }), { zones: 0, devices: 0, gateways: 0 })
      setSiteStats(stats)
    } catch {
      // non-critical — silently ignore
    }
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
        
        const [planRes, zoneData, restroomData, deviceData, gatewayData] = await Promise.all([
          floorPlanAPI.getByFloor(firstFloor.id),
          zoneAPI.getByFloor(firstFloor.id),
          restroomAPI.getByFloor(firstFloor.id),
          deviceAPI.getByFloor(firstFloor.id),
          gatewayAPI.getAll({ floorId: firstFloor.id }),
        ])
        
        if (selectedLocationIdRef.current !== locationId) return
        
        const allPlans = planRes.floorPlans || []
        setPlans(allPlans)
        const planData = allPlans[0] || null
        setPlan(planData)
        if (planData) {
          syncLocationMarkerToPlan(planData)
          setPlanRotation(planData.rotation || 0)
          setPlanScale(planData.scale || 1)
        } else {
          setPlanRotation(0)
          setPlanScale(1)
          setPlanOpacity(0.45)
        }
        setZones(zoneData.zones || [])
        setRestrooms(restroomData.restrooms || [])
        setDevices(deviceData.devices || [])
        setGateways(gatewayData.gateways || [])
      } else {
        setPlans([])
        setPlan(null)
        setZones([])
        setRestrooms([])
        setDevices([])
        setGateways([])
      }
      
      if (selectedLocationIdRef.current !== locationId) return
      
      await loadAllDevices()
      await loadAllGateways()
      await loadSiteStats(locationId, floors)
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
      setSiteStats({ zones: 0, devices: 0, gateways: 0 })    }
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

  function invalidateFloorCache() {
    if (floor?.id) delete floorCache.current[floor.id]
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

  async function removePlan(targetPlan) {
    const p = targetPlan || plan
    if (!p || !window.confirm('Remove this floor plan image?')) return
    setBusy(true)
    try {
      await floorPlanAPI.delete(p.id)
      const remaining = plans.filter((fp) => fp.id !== p.id)
      setPlans(remaining)
      // Invalidate floor cache so deleted plan does not reappear on floor switch
      if (floor && floor.id && floorCache.current[floor.id]) {
        floorCache.current[floor.id] = { ...floorCache.current[floor.id], plans: remaining }
      }
      if (plan?.id === p.id) {
        const next = remaining[0] || null
        setPlan(next)
        setPlanRotation(next?.rotation || 0)
        setPlanScale(next?.scale || 1)
      }
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
      invalidateFloorCache()
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
        const planName = `${floor.floorName} Plan ${plans.length + 1}`
        const data = await floorPlanAPI.create({ floorId: floor.id, name: planName, imageData: src, width: image.width, height: image.height, geoBounds })
        setPlans((prev) => [...prev, data.floorPlan])
        setPlan(data.floorPlan)
        setPlanRotation(0)
        setPlanScale(1)
        setPlanOpacity(0.45)
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
    const next = ((planRotation + angle) % 360 + 360) % 360
    setPlanRotation(next)
    await savePlanAlignment(plan.geoBounds, next, planScale)
  }

  async function scalePlan(delta) {
    if (!plan?.geoBounds) return
    const b = plan.geoBounds
    const centerLat = (b.northLat + b.southLat) / 2
    const centerLng = (b.eastLng + b.westLng) / 2
    const halfLat = (b.northLat - b.southLat) / 2
    const halfLng = (b.eastLng - b.westLng) / 2
    const factor = 1 + delta
    const nextBounds = {
      northLat: centerLat + halfLat * factor,
      southLat: centerLat - halfLat * factor,
      eastLng: centerLng + halfLng * factor,
      westLng: centerLng - halfLng * factor,
    }
    const newScale = Math.max(0.1, Math.min(5, planScale + delta))
    setPlan({ ...plan, geoBounds: nextBounds })
    setPlanScale(newScale)
    await savePlanAlignment(nextBounds, planRotation, newScale)
  }

  async function adjustPlan(direction) {
    if (!plan) return
    const b = plan.geoBounds
    const lat = b.northLat - b.southLat
    const lng = b.eastLng - b.westLng
    // fine = 1%, coarse = 5% of current extent
    const fine = 0.01
    const coarse = 0.05
    const step_size = direction.startsWith('fine-') ? fine : coarse
    const dir = direction.replace('fine-', '')
    let next = { ...b }
    if (dir === 'left')   { next.westLng -= lng * step_size; next.eastLng -= lng * step_size }
    if (dir === 'right')  { next.westLng += lng * step_size; next.eastLng += lng * step_size }
    if (dir === 'up')     { next.northLat += lat * step_size; next.southLat += lat * step_size }
    if (dir === 'down')   { next.northLat -= lat * step_size; next.southLat -= lat * step_size }
    if (dir === 'grow')   { next.northLat += lat * step_size; next.southLat -= lat * step_size; next.eastLng += lng * step_size; next.westLng -= lng * step_size }
    if (dir === 'shrink') { next.northLat -= lat * step_size; next.southLat += lat * step_size; next.eastLng -= lng * step_size; next.westLng += lng * step_size }
    setPlan({ ...plan, geoBounds: next })
    savePlanAlignment(next, planRotation, planScale)
  }

  function zoomMap(delta) {
    setMapZoom((prev) => Math.max(2, Math.min(22, prev + delta)))
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
    if (!plan) return
    setBusy(true)
    try {
      const updatedPlan = { ...plan, geoBounds: plan.geoBounds, rotation: planRotation, scale: planScale }
      await floorPlanAPI.update(plan.id, { geoBounds: plan.geoBounds, rotation: planRotation, scale: planScale })

      // Update local plans array and plan state to reflect saved values
      const updatedPlans = plans.map((p) => p.id === plan.id ? updatedPlan : p)
      setPlans(updatedPlans)
      setPlan(updatedPlan)

      // KEY FIX: populate the floor cache with the just-saved data so that
      // switching floors and back does NOT lose the aligned plan position.
      if (floor && floor.id) {
        floorCache.current[floor.id] = {
          plans: updatedPlans,
          zones: zones,
          restrooms: restrooms,
          devices: devices,
          gateways: gateways,
        }
      }

      // The location pin can move the plan, so persist its final position too.
      const latitude = Number(site?.latitude)
      const longitude = Number(site?.longitude)
      if (site?.id && Number.isFinite(latitude) && Number.isFinite(longitude)) {
        const locationData = await locationAPI.update(site.id, {
          officeName: siteForm.name.trim(),
          city: siteForm.location.trim(),
          address: `${siteForm.type}${siteForm.description ? ` â€” ${siteForm.description}` : ''}`,
          latitude,
          longitude,
        })
        if (locationData.location) setSite(locationData.location)
      }

      setStep(3)
      setNotice('Floor plan geographically aligned. Draw zones on top of it.')
    } catch (error) {
      setNotice(error.message || 'Unable to save alignment.')
    } finally {
      setBusy(false)
    }
  }

  function onMapClick(point) {
    if (step === 2 && plan) {
      // Click-to-move is disabled — use the drag handles on the floor plan overlay instead
      return
    }
    if (step === 3) {
      if (editingZoneId && editingZoneRedrawing) {
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
    if (movingItemId && (step === 4 || step === 5)) {
      movePlacedItem(movingItemId, movingItemType, point)
      return
    }
    if (step === 4 && selectedDeviceId) {
      placeExistingItem(point, 'device')
      return
    }
    if (step === 5 && selectedGatewayId) {
      placeExistingItem(point, 'gateway')
      return
    }
    if (step === 4 && !selectedDeviceId) {
      setNotice('Select a device from the list before clicking the map.')
      return
    }
    if (step === 5 && !selectedGatewayId) {
      setNotice('Select a gateway from the list before clicking the map.')
      return
    }
  }

  async function finishZone() {
    if (points.length < 3) { setNotice('A zone needs at least three points.'); return }
    try {
      const coordinates = { type: 'Polygon', coordinates: [[...points, points[0]].map(([lat, lng]) => [lng, lat])] }
      const zoneType = zoneForm.type || 'restroom'
      const defaultName = { restroom: 'Restroom', corridor: 'Corridor', lobby: 'Lobby', maintenance: 'Maintenance', other: 'Zone' }
      const zoneName = zoneForm.name.trim() || defaultName[zoneType] || 'Zone'
      const centroid = getPolygonCentroid(points)

      // Only create a linked Restroom record for restroom-type zones
      let restroomId = null
      if (zoneType === 'restroom') {
        const restroomData = await floorPlanAPI.createRestroom({ floorId: floor.id, name: zoneName, organizationId: user?.organizationId || '' })
        restroomId = restroomData.restroom.id
      }

      const payload = { floorId: floor.id, name: zoneName, type: zoneType, coordinates, restroomId, latitude: centroid[0], longitude: centroid[1] }
      await zoneAPI.create(payload)
      const zoneData = await zoneAPI.getByFloor(floor.id)
      setZones(zoneData.zones || [])
      const updatedRestrooms = await restroomAPI.getByFloor(floor.id)
      setRestrooms(updatedRestrooms.restrooms || [])
      setPoints([])
      setZoneForm({ name: '', type: 'restroom' })
      setDrawing(false)
      invalidateFloorCache()
      setNotice(`${zoneName} zone saved.`)
    } catch (error) {
      setNotice(error.message || 'Unable to create zone.')
    }
  }

  function zoneAt(lat, lng) {
    // First try exact point-in-polygon
    const exact = zones.find((zone) => {
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
    if (exact) return exact

    // Fallback: find the nearest zone by centroid within a reasonable radius
    // (handles clicks near zone edges or with slight coordinate imprecision)
    let nearest = null
    let minDist = Infinity
    const MAX_DIST = 0.002 // ~200m in degrees
    for (const zone of zones) {
      if (!Number.isFinite(zone.latitude) || !Number.isFinite(zone.longitude)) continue
      const dist = Math.sqrt((zone.latitude - lat) ** 2 + (zone.longitude - lng) ** 2)
      if (dist < minDist && dist < MAX_DIST) {
        minDist = dist
        nearest = zone
      }
    }
    return nearest || null
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
      invalidateFloorCache()
      const ttnStatus = data.ttnRegistration
      const registrationMessage = ttnStatus?.registered
        ? ' TTN registration completed.'
        : ttnStatus?.error
          ? ` TTN registration failed: ${ttnStatus.error}`
          : ''
      setNotice(`Device placed at ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}${zone?.restroomId ? ` — assigned to restroom: ${zone.name}` : zoneId ? ` in zone: ${zone?.name}` : ' (no zone detected — click inside a drawn zone to assign restroom)'}.${registrationMessage}`)
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
      invalidateFloorCache()
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
    setEditingZoneForm({ name: zone.name, type: zone.type || 'restroom' })
    // Clear any in-progress new-zone drawing so stale points can't trigger finishZone
    setPoints([])
    setZoneForm({ name: '' })
    setDrawing(false)
    setEditingZoneRedrawing(false)
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
    setNotice('Edit the zone name then save, or click "Redraw" to change its boundary.')
  }

  async function saveEditedZone() {
    if (editingZonePoints.length < 3) { setNotice('A zone needs at least three points.'); return }
    const coordinates = { type: 'Polygon', coordinates: [[...editingZonePoints, editingZonePoints[0]].map(([lat, lng]) => [lng, lat])] }
    const centroid = getPolygonCentroid(editingZonePoints)
    const zoneType = editingZoneForm.type || 'restroom'
    const defaultName = { restroom: 'Restroom', corridor: 'Corridor', lobby: 'Lobby', maintenance: 'Maintenance', other: 'Zone' }
    const newName = editingZoneForm.name.trim() || defaultName[zoneType] || 'Zone'
    try {
      const payload = { name: newName, type: zoneType, coordinates, latitude: centroid[0], longitude: centroid[1] }
      await zoneAPI.update(editingZoneId, payload)

      // If this zone is linked to a restroom, rename the restroom to match
      const linkedZone = zones.find((z) => z.id === editingZoneId)
      if (linkedZone?.restroomId && zoneType === 'restroom') {
        try {
          await restroomAPI.update(linkedZone.restroomId, { name: newName })
        } catch {
          // non-fatal
        }
      }

      const [zoneData, restroomData] = await Promise.all([
        zoneAPI.getByFloor(floor.id),
        restroomAPI.getByFloor(floor.id),
      ])
      setZones(zoneData.zones || [])
      setRestrooms(restroomData.restrooms || [])
      setEditingZoneId(null)
      setEditingZonePoints([])
      setEditingZoneRedrawing(false)
      setPoints([])
      setZoneForm({ name: '' })
      setDrawing(false)
      invalidateFloorCache()
      setNotice('Zone updated.')
    } catch (error) {
      setNotice(error.message || 'Unable to update zone.')
    }
  }

  function cancelEditZone() {
    setEditingZoneId(null)
    setEditingZonePoints([])
    setEditingZoneRedrawing(false)
    setPoints([])
    setZoneForm({ name: '' })
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

      <div data-tour="site-config-wizard">
        <Stepper currentStep={step} setCurrentStep={setStep} />
      </div>

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
               <div className="planner-form" data-tour="sc-site-form">
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
                <div className="planner-coordinates" data-tour="sc-coordinates">
                  <strong>Coordinates <b>*</b></strong>
                  <p>Provide the site&apos;s GPS centre point. Use &ldquo;Save coordinates from address&rdquo; to auto-fill from the address, or pick visually on the map.</p>
                  <div>
                    <label>Latitude<input value={siteForm.latitude} placeholder="-90 to 90" onChange={(e) => setSiteForm({ ...siteForm, latitude: e.target.value })} /></label>
                    <label>Longitude<input value={siteForm.longitude} placeholder="-180 to 180" onChange={(e) => setSiteForm({ ...siteForm, longitude: e.target.value })} /></label>
                  </div>
                  <div className="planner-coordinates__actions">
                    {(siteForm.location || siteForm.description) && (
                      <button type="button" className="planner-button" onClick={geocodeAddress} disabled={geocoding}>
                        {geocoding ? '⏳ Fetching…' : '📍 Save coordinates from address'}
                      </button>
                    )}
                    <button type="button" className="planner-button planner-button--dark" onClick={() => setPickerOpen(true)}>⌖ Mark centre on map</button>
                  </div>
                </div>
              </div>
               <div className="planner-form-layout__preview" data-tour="sc-site-preview">
                 <PreviewPanel title="Site preview" empty={!siteForm.name && !previewCoords ? 'Fill in the form to see a live preview of your site.' : null}>
                   <div className="planner-preview-grid">
                     {siteForm.name && <div className="planner-preview-card"><span className="planner-preview-card__label">Name</span><span className="planner-preview-card__value">{siteForm.name}</span></div>}
                     {siteForm.type && <div className="planner-preview-card"><span className="planner-preview-card__label">Type</span><span className="planner-preview-card__value">{siteForm.type}</span></div>}
                     {siteForm.location && <div className="planner-preview-card"><span className="planner-preview-card__label">Location</span><span className="planner-preview-card__value">{siteForm.location}</span></div>}
                     {selectedLocationId && (
                       <>
                         <div className="planner-preview-card"><span className="planner-preview-card__label">Floors</span><span className="planner-preview-card__value">{floors.length}</span></div>
                         <div className="planner-preview-card"><span className="planner-preview-card__label">Zones</span><span className="planner-preview-card__value">{siteStats.zones}</span></div>
                         <div className="planner-preview-card"><span className="planner-preview-card__label">Devices</span><span className="planner-preview-card__value">{siteStats.devices}</span></div>
                         <div className="planner-preview-card"><span className="planner-preview-card__label">Gateways</span><span className="planner-preview-card__value">{siteStats.gateways}</span></div>
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
          <section className="planner-map-shell">
            {/* Mapbar: floor selector + upload/remove */}
            <div className="planner-mapbar">
              <div>
                {floor && (
                  <select value={floor.id} onChange={(e) => setFloor(floors.find((item) => item.id === e.target.value))}>
                    {floors.map((item) => (
                      <option key={item.id} value={item.id}>{item.floorName}{item.floorNumber !== null ? ` (Floor ${item.floorNumber})` : ''}</option>
                    ))}
                  </select>
                )}
                {floorLoading && (
                  <span style={{ fontSize: 12, color: 'var(--primary)', marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 12, height: 12, border: '2px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                    Loading floor…
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {floor && (
                  <>
                    <button type="button" className="planner-button planner-button--ghost" onClick={() => fileRef.current?.click()}>
                      ⇧ {plan ? 'Replace floor plan' : 'Upload floor plan'}
                    </button>
                    {plan && <button type="button" className="planner-button planner-button--danger" onClick={removePlan}>Remove plan</button>}
                    <input ref={fileRef} hidden type="file" accept="image/*" onChange={uploadPlan} />
                  </>
                )}
              </div>
            </div>

            {/* Floor sidebar - outside map so it's always accessible */}
            <div style={{ display: 'flex', alignItems: 'stretch', minHeight: 0 }}>
              {/* Floors panel */}
              <div className="planner-floors-panel">
                <div className="planner-floors-overlay__heading">
                  <strong>Floors</strong>
                  <button
                    type="button"
                    className="planner-button"
                    disabled={!site}
                    title={!site ? 'Save the site first (Step 1)' : 'Add a new floor'}
                    onClick={() => setAddFloorOpen(true)}
                  >
                    + Add Floor
                  </button>
                </div>
                {!site && (
                  <p style={{ color: 'var(--text)', fontSize: 12, margin: '8px 0' }}>
                    Save the site in Step 1 first.
                  </p>
                )}
                {site && floors.length === 0 && (
                  <p style={{ color: 'var(--text)', fontSize: 12, margin: '8px 0' }}>
                    No floors yet. Click "+ Add Floor".
                  </p>
                )}
                {floors.map((item) => (
                  <div key={item.id} className="planner-floor-row">
                    <button
                      type="button"
                      className={`planner-floor ${floor?.id === item.id ? 'is-selected' : ''}`}
                      onClick={() => setFloor(item)}
                    >
                      <span>{item.floorNumber ?? '—'}</span>
                      {item.floorName}
                    </button>
                    <DeleteButton label={`Delete ${item.floorName}`} onClick={() => removeFloor(item.id)} />
                  </div>
                ))}
              </div>

              {/* Map with alignment controls */}
              <div className="planner-map" style={{ flex: 1 }}>
              <MapContainer center={center} zoom={mapZoom} className="planner-map-container" scrollWheelZoom={true} zoomControl={true} maxZoom={22} minZoom={2}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" maxNativeZoom={19} maxZoom={22} />
                <MapFocus center={center} zoom={mapZoom} />
                <MapClick onClick={onMapClick} />
                <SitePin location={site} onLocationChange={handlePlanLocationPinMove} />
                <MapZoomControl onZoomIn={() => zoomMap(1)} onZoomOut={() => zoomMap(-1)} />
                {bounds && <RotatableImageOverlay bounds={bounds} url={plan.imageData} opacity={planOpacity} rotation={planRotation} imgRef={planImgRef} />}
                {bounds && plan && (
                  <DraggablePlanOverlay
                    geoBounds={plan.geoBounds}
                    rotation={planRotation}
                    imgRef={planImgRef}
                    onBoundsChange={handlePlanBoundsChange}
                    onTransformEnd={handlePlanTransformEnd}
                  />
                )}
              </MapContainer>

              {/* Alignment controls — shown once a plan is uploaded */}
              {plan && (
                <div className="planner-align" data-tour="sc-align-controls">
                  <strong>Align floor plan</strong>
                  <small>Drag ✥ to move · use nudge buttons to fine-tune position & size.</small>

                  {/* Nudge: fine (1%) */}
                  <div style={{ fontSize: 11, color: 'var(--text)', marginBottom: 2, marginTop: 4 }}>Fine nudge (1%)</div>
                  <div className="planner-align__controls">
                    <button type="button" onClick={() => adjustPlan('fine-up')}>↑</button>
                    <button type="button" onClick={() => adjustPlan('fine-left')}>←</button>
                    <button type="button" onClick={() => adjustPlan('fine-right')}>→</button>
                    <button type="button" onClick={() => adjustPlan('fine-down')}>↓</button>
                    <button type="button" onClick={() => adjustPlan('fine-grow')}>＋</button>
                    <button type="button" onClick={() => adjustPlan('fine-shrink')}>−</button>
                  </div>

                  {/* Nudge: coarse (5%) */}
                  <div style={{ fontSize: 11, color: 'var(--text)', marginBottom: 2 }}>Coarse nudge (5%)</div>
                  <div className="planner-align__controls">
                    <button type="button" onClick={() => adjustPlan('up')}>↑</button>
                    <button type="button" onClick={() => adjustPlan('left')}>←</button>
                    <button type="button" onClick={() => adjustPlan('right')}>→</button>
                    <button type="button" onClick={() => adjustPlan('down')}>↓</button>
                    <button type="button" onClick={() => adjustPlan('grow')}>＋</button>
                    <button type="button" onClick={() => adjustPlan('shrink')}>−</button>
                  </div>

                  {/* Rotation — slider for precise angle alignment */}
                  <div style={{ marginTop: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: 'var(--text)', fontWeight: 600 }}>↻ Rotation</span>
                      <span style={{
                        fontSize: 12, fontWeight: 700, color: '#0891b2',
                        background: 'rgba(8,145,178,0.12)',
                        border: '1px solid rgba(8,145,178,0.3)',
                        borderRadius: 6, padding: '1px 10px',
                        minWidth: 52, textAlign: 'center',
                        fontVariantNumeric: 'tabular-nums',
                      }}>
                        {planRotation}°
                      </span>
                    </div>
                    {/* Continuous slider — drag to any angle */}
                    <input
                      type="range"
                      min={-180}
                      max={180}
                      step={1}
                      value={planRotation}
                      onChange={(e) => setPlanRotation(Number(e.target.value))}
                      style={{ width: '100%', accentColor: '#0891b2', cursor: 'pointer', marginBottom: 4 }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text)', marginBottom: 6 }}>
                      <span>−180°</span><span>−90°</span><span>0°</span><span>90°</span><span>180°</span>
                    </div>
                    {/* Step buttons for fine-grained rotation */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 3 }}>
                      {[[-15,'↺15°'],[-5,'↺5°'],[-1,'↺1°'],[1,'↻1°'],[5,'↻5°'],[15,'↻15°']].map(([deg, label]) => (
                        <button
                          key={deg}
                          type="button"
                          className="planner-button"
                          style={{ fontSize: 10, padding: '4px 2px', whiteSpace: 'nowrap' }}
                          onClick={() => setPlanRotation((prev) => {
                            const next = prev + deg
                            // keep in -180..180
                            return next > 180 ? next - 360 : next < -180 ? next + 360 : next
                          })}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {/* Reset rotation to 0 */}
                    <button
                      type="button"
                      className="planner-button planner-button--ghost"
                      style={{ width: '100%', marginTop: 4, fontSize: 11 }}
                      onClick={() => setPlanRotation(0)}
                    >
                      Reset rotation
                    </button>
                  </div>

                  {/* Opacity slider */}
                  <label style={{ fontSize: 11, color: 'var(--text)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    Opacity: {Math.round(planOpacity * 100)}%
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={planOpacity}
                      onChange={(e) => setPlanOpacity(Number(e.target.value))}
                      style={{ width: '100%', accentColor: '#0891b2' }}
                    />
                  </label>

                  <div className="planner-align__actions" style={{ marginTop: 4 }}>
                    <button type="button" className="planner-button" onClick={fitPlan}>⊞ Fit</button>
                    <button type="button" className="planner-button planner-button--ghost" onClick={() => { setPlanRotation(0); setPlanScale(1); setPlanOpacity(0.45) }}>Reset</button>
                  </div>
                </div>
              )}

              {/* Map actions panel */}
            </div>{/* end .planner-map */}
            </div>{/* end flex wrapper */}

            {/* Footer */}
            <div className="planner-step-layout__footer" style={{ position: 'relative' }}>
              <button type="button" className="planner-button planner-button--ghost" onClick={() => setStep(1)}>← Back</button>
              {plan ? (
                <button type="button" className="planner-button" disabled={busy} onClick={savePlan}>Save &amp; Continue →</button>
              ) : (
                <button type="button" className="planner-button" onClick={() => setStep(3)}>Continue →</button>
              )}
            </div>
          </section>

          {/* Preview panel below map */}
          <PreviewPanel title="Floor plan preview" empty={!plan ? (floor ? 'Upload a floor plan image to position it on the map.' : 'Select or add a floor first.') : null}>
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
              {!plan && site && (
                <div className="planner-preview-card" style={{ gridColumn: '1/-1' }}>
                  <span className="planner-preview-card__label">Site map</span>
                  <PreviewMap center={center} site={site} />
                </div>
              )}
            </div>
          </PreviewPanel>
        </div>
      )}

      {/* Steps 3–5 — Map workspace */}
      {step >= 3 && step <= 5 && (
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
                {floorLoading && (
                  <span style={{ fontSize: 12, color: 'var(--primary)', marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 12, height: 12, border: '2px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                    Loading floor…
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {step === 3 && (
                  <>
                    <button type="button" className="planner-button planner-button--ghost" onClick={() => geoJsonRef.current?.click()}>⇧ Import GeoJSON</button>
                    <input ref={geoJsonRef} hidden type="file" accept="application/json,.geojson" onChange={importGeoJson} />
                  </>
                )}
              </div>
            </div>
            <div className="planner-map">
              <MapContainer center={center} zoom={mapZoom} className="planner-map-container" scrollWheelZoom={true} zoomControl={true} maxZoom={22} minZoom={2}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" maxNativeZoom={19} maxZoom={22} />
                <MapFocus center={center} zoom={mapZoom} />
                <MapCursor children={(selectedDeviceId && step === 4) || (selectedGatewayId && step === 5) ? 'crosshair' : ''} />
                <MapMouseTracker onMouseMove={setMousePos} />
                <MapClick onClick={onMapClick} />
                <SitePin location={site} onLocationChange={handleSitePinMove} />
                <MapZoomControl onZoomIn={() => zoomMap(1)} onZoomOut={() => zoomMap(-1)} />
                {bounds && <RotatableImageOverlay bounds={bounds} url={plan.imageData} opacity={planOpacity} rotation={planRotation} />}
                {/* Step 3: zones only — Step 4+5: zones as background context */}
                {zones.map((zone) => {
                  const positions = zonePositions(zone)
                  if (!positions.length) return null
                  const latitude = Number(zone.latitude)
                  const longitude = Number(zone.longitude)
                  const hasCentroid = Number.isFinite(latitude) && Number.isFinite(longitude)
                  const color = ZONE_COLORS[zone.type] || ZONE_COLORS.other
                  return (
                    <Fragment key={zone.id}>
                      <Polygon key={`${zone.id}-area`} positions={positions} color={color} fillColor={color} fillOpacity={step === 3 ? 0.35 : 0.15} weight={step === 3 ? 2 : 1} />
                      {zone.type === 'restroom' && hasCentroid && step === 3 && (
                        <Marker key={`${zone.id}-restroom`} position={[latitude, longitude]} icon={divIcon('restroom')} title={zone.name} />
                      )}
                    </Fragment>
                  )
                })}
                {/* Zone drawing helpers — step 3 only */}
                {step === 3 && editingZoneId && !editingZoneRedrawing && editingZonePoints.length > 1 && <Polygon positions={[...editingZonePoints, editingZonePoints[0]]} color="#f59e0b" weight={2.5} dashArray="8 4" fillOpacity={0.1} />}
                {step === 3 && drawing && editingZoneId && editingZoneRedrawing && editingZonePoints.length > 1 && <Polygon positions={[...editingZonePoints, editingZonePoints[0]]} color="#38bdf8" dashArray="6 6" />}
                {step === 3 && drawing && !editingZoneId && points.length > 1 && <Polygon positions={[...points, points[0]]} color="#38bdf8" dashArray="6 6" />}
                {/* Device placement preview cursor — step 4 only */}
                {(selectedDeviceId && step === 4) && mousePos && <PlacementPreview position={[mousePos.lat, mousePos.lng]} type="device" />}
                {/* Gateway placement preview cursor — step 5 only */}
                {(selectedGatewayId && step === 5) && mousePos && <PlacementPreview position={[mousePos.lat, mousePos.lng]} type="gateway" />}
                {/* Placed devices — step 4 only */}
                {step === 4 && devices.map((item) => {
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
                {/* Placed gateways — step 5 only */}
                {step === 5 && gateways.map((item) => {
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


              {step === 3 && (
                <div className="planner-toolbox" data-tour="sc-zone-toolbox">
                  <strong>{editingZoneId ? 'Edit zone' : 'Draw zones'}</strong>
                  {editingZoneId ? (
                    <>
                      <input
                        placeholder="Zone name"
                        value={editingZoneForm.name}
                        onChange={(e) => setEditingZoneForm({ ...editingZoneForm, name: e.target.value })}
                      />
                      {editingZoneRedrawing ? (
                        <>
                          <small>Click the map to place new vertices ({editingZonePoints.length}/3 minimum).</small>
                          <button type="button" className="planner-button" onClick={saveEditedZone}>Save zone</button>
                          <button type="button" className="planner-button planner-button--ghost" onClick={() => {
                            // Restore original boundary from zones state
                            const origZone = zones.find(z => z.id === editingZoneId)
                            if (origZone) {
                              const raw = origZone.coordinates
                              let ring
                              if (typeof raw === 'string') { try { const p = JSON.parse(raw); ring = p?.coordinates?.[0] || p } catch { ring = [] } }
                              else if (Array.isArray(raw)) { ring = raw }
                              else { ring = raw?.coordinates?.[0] || [] }
                              const pts = Array.isArray(ring) ? ring.map(pt => Array.isArray(pt) && pt.length >= 2 ? [Number(pt[1]), Number(pt[0])] : null).filter(Boolean) : []
                              setEditingZonePoints(pts)
                            }
                            setEditingZoneRedrawing(false)
                            setDrawing(false)
                          }}>Cancel redraw</button>
                        </>
                      ) : (
                        <>
                          <small>Rename or change type, then save.</small>
                          {/* Type selector for edit mode */}
                          <select
                            value={editingZoneForm.type || 'restroom'}
                            onChange={(e) => setEditingZoneForm({ ...editingZoneForm, type: e.target.value })}
                            style={{ marginBottom: 4 }}
                          >
                            <option value="restroom">🚻 Restroom</option>
                            <option value="corridor">🚶 Corridor</option>
                            <option value="lobby">🏛 Lobby</option>
                            <option value="maintenance">🔧 Maintenance</option>
                            <option value="other">📦 Other</option>
                          </select>
                          <button type="button" className="planner-button" onClick={saveEditedZone}>Save zone</button>
                          <button type="button" className="planner-button planner-button--ghost" onClick={() => { setEditingZonePoints([]); setEditingZoneRedrawing(true); setDrawing(true) }}>⌗ Redraw boundary</button>
                          <button type="button" className="planner-button planner-button--ghost" onClick={cancelEditZone}>Cancel</button>
                        </>
                      )}
                    </>
                  ) : drawing ? (
                    <>
                      <input placeholder="Zone name" value={zoneForm.name} onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })} />
                      {/* Zone type selector */}
                      <select
                        value={zoneForm.type || 'restroom'}
                        onChange={(e) => setZoneForm({ ...zoneForm, type: e.target.value })}
                        style={{ marginBottom: 4 }}
                      >
                        <option value="restroom">🚻 Restroom</option>
                        <option value="corridor">🚶 Corridor</option>
                        <option value="lobby">🏛 Lobby</option>
                        <option value="maintenance">🔧 Maintenance</option>
                        <option value="other">📦 Other</option>
                      </select>
                      <small>
                        {zoneForm.type === 'restroom'
                          ? '🚻 A linked restroom will be created for device assignment.'
                          : 'ℹ This zone is spatial only — no restroom record created.'}
                      </small>
                      <small>{drawingMode === 'rectangle' ? 'Click two opposite corners.' : `Click to add vertices (${points.length}/3 minimum).`}</small>
                      <button type="button" className="planner-button" onClick={finishZone}>Save zone</button>
                      <button type="button" className="planner-button planner-button--ghost" onClick={() => { setDrawing(false); setPoints([]) }}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <p>Draw zones on the floor plan. Choose a type after starting to draw.</p>
                      <button type="button" className="planner-button" onClick={() => { setDrawingMode('polygon'); setDrawing(true) }}>⌗ Draw polygon</button>
                      <button type="button" className="planner-button planner-button--ghost" onClick={() => { setDrawingMode('rectangle'); setDrawing(true) }}>□ Draw rectangle</button>
                    </>
                  )}
                </div>
              )}

               {step === 3 && (
                <div className="planner-placement">
                  <strong>Zone drawing</strong>
                  <p>Create zones by drawing polygons or rectangles on the map.</p>
                  <div className="planner-placement__footer">
                    <button type="button" className="planner-button planner-button--ghost" onClick={() => setStep(2)}>Back</button>
                    <button type="button" className="planner-button" onClick={() => setStep(4)}>Save &amp; Continue →</button>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="planner-placement" data-tour="sc-device-placement">
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
                    {(() => {
                      // Only show restrooms that are actively linked to a zone on this floor
                      const linkedRestroomIds = new Set(zones.map(z => z.restroomId).filter(Boolean))
                      const activeRestrooms = restrooms.filter(r => linkedRestroomIds.has(r.id))
                      return (
                        <>
                          <small>Saved restrooms ({activeRestrooms.length})</small>
                          {activeRestrooms.length ? (
                            <div>{activeRestrooms.map((restroom) => <span key={restroom.id} className="planner-placement__restroom">{restroom.name}</span>)}</div>
                          ) : <small>No restrooms have been saved on this floor yet.</small>}
                        </>
                      )
                    })()}
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
                     <button type="button" className="planner-button planner-button--ghost" onClick={() => setStep(3)}>Back</button>
                     <button type="button" className="planner-button" onClick={() => setStep(5)}>Save &amp; Continue →</button>
                   </div>
                </div>
              )}

              {step === 5 && (
                <div className="planner-placement" data-tour="sc-gateway-placement">
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
                     <button type="button" className="planner-button planner-button--ghost" onClick={() => setStep(4)}>Back</button>
                     <button type="button" className="planner-button" onClick={() => setStep(6)}>Save &amp; Continue →</button>
                   </div>
                </div>
              )}
            </div>
          </section>

          {/* Step-specific preview below map */}
          {step === 3 && (
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

          {step === 4 && (
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

          {step === 5 && (
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

      {/* Step 6 — Review */}
      {step === 6 && (
        <div className="planner-stage-wrap">
          <section className="planner-review" data-tour="sc-review">
            <h2>Review site configuration</h2>
            <p>All floors, zones, devices and gateways configured for this site.</p>

            {/* Site header */}
            <div className="planner-review-card">
              <div className="planner-review-card__header">
                <span style={{ fontSize: 18 }}>🏢</span>
                <strong>{site?.officeName}</strong>
                <span style={{ fontSize: 12, color: 'var(--text)', marginLeft: 'auto' }}>
                  {site?.city} · {site?.latitude?.toFixed(5)}, {site?.longitude?.toFixed(5)}
                </span>
              </div>
              <div className="planner-review-card__children">
                <div className="planner-review-row">
                  <span>{floors.length} floor{floors.length !== 1 ? 's' : ''} · {siteStats.zones} zone{siteStats.zones !== 1 ? 's' : ''} · {siteStats.devices} device{siteStats.devices !== 1 ? 's' : ''} · {siteStats.gateways} gateway{siteStats.gateways !== 1 ? 's' : ''}</span>
                </div>
              </div>
            </div>

            {/* One card per floor */}
            {floors.map((floorItem) => {
              const fd = reviewData[floorItem.id] || {}
              const floorPlans  = fd.plans    || []
              const floorZones  = fd.zones    || []
              const floorDev    = fd.devices  || []
              const floorGw     = fd.gateways || []
              const isLoading   = !reviewData[floorItem.id]

              return (
                <div key={floorItem.id} className="planner-review-card">
                  <div className="planner-review-card__header">
                    <span style={{ fontSize: 15 }}>🏗</span>
                    <strong>{floorItem.floorName}{floorItem.floorNumber != null ? ` (Floor ${floorItem.floorNumber})` : ''}</strong>
                    <span style={{ fontSize: 11, color: 'var(--text)', marginLeft: 'auto' }}>
                      {isLoading ? 'Loading…' : `${floorZones.length} zones · ${floorDev.length} devices · ${floorGw.length} gateways`}
                    </span>
                    <DeleteButton label={`Delete ${floorItem.floorName}`} onClick={() => removeFloor(floorItem.id)} />
                  </div>

                  {!isLoading && (
                    <div className="planner-review-card__children">

                      {/* Floor plans */}
                      {floorPlans.map((p) => (
                        <div key={p.id} className="planner-review-row">
                          <span>🗺 Floor plan: <strong>{p.name}</strong>{p.rotation ? ` · ${p.rotation}° rotation` : ''}</span>
                          {floorItem.id === floor?.id && (
                            <DeleteButton label="Remove floor plan" onClick={() => removePlan(p)} />
                          )}
                        </div>
                      ))}

                      {/* Zones */}
                      {floorZones.map((z) => (
                        <div key={z.id} className="planner-review-row">
                          <span>
                            {ZONE_COLORS[z.type] ? (
                              <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: ZONE_COLORS[z.type], marginRight: 5 }} />
                            ) : null}
                            {z.type === 'restroom' ? '🚻' : z.type === 'corridor' ? '🚶' : z.type === 'lobby' ? '🏛' : z.type === 'maintenance' ? '🔧' : '📦'} Zone: <strong>{z.name}</strong>
                            <span style={{ color: 'var(--text)', fontSize: 11, marginLeft: 6 }}>{z.type}</span>
                          </span>
                          <DeleteButton label={`Delete ${z.name}`} onClick={() => {
                            if (floorItem.id !== floor?.id) setFloor(floorItem)
                            removeZone(z.id)
                          }} />
                        </div>
                      ))}

                      {/* Devices */}
                      {floorDev.map((d) => (
                        <div key={d.id} className="planner-review-row">
                          <span>
                            <span style={{ marginRight: 4 }}>{TYPE_META[d.deviceType]?.icon || '▣'}</span>
                            {TYPE_META[d.deviceType]?.label || 'Device'}: <strong>{d.name || d.badgeId}</strong>
                            {d.restroomName && d.restroomName !== 'Unassigned' && (
                              <span style={{ color: 'var(--text)', fontSize: 11, marginLeft: 6 }}>→ {d.restroomName}</span>
                            )}
                          </span>
                          <DeleteButton label={`Unlink ${d.name || d.badgeId}`} onClick={() => unlinkDevice(d.id)} />
                        </div>
                      ))}

                      {/* Gateways */}
                      {floorGw.map((g) => (
                        <div key={g.id} className="planner-review-row">
                          <span>
                            <span style={{ marginRight: 4 }}>⌁</span>
                            Gateway: <strong>{g.name}</strong>
                            <span style={{ color: 'var(--text)', fontSize: 11, marginLeft: 6 }}>{g.gatewayEui}</span>
                          </span>
                          <DeleteButton label={`Unlink ${g.name}`} onClick={() => unlinkGateway(g.id)} />
                        </div>
                      ))}

                      {floorPlans.length === 0 && floorZones.length === 0 && floorDev.length === 0 && floorGw.length === 0 && (
                        <div className="planner-review-row">
                          <span style={{ color: 'var(--text)', fontStyle: 'italic' }}>No configuration yet for this floor.</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button type="button" className="planner-button planner-button--ghost" onClick={() => setStep(5)}>← Back</button>
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
          initialQuery={siteForm.location}
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
