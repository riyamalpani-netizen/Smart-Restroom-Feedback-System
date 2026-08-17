import { useEffect, useMemo, useState } from 'react'
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polygon,
  ImageOverlay,
  Tooltip,
  useMap,
} from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const DEFAULT_CENTER = [20.5937, 78.9629]

const ZONE_COLORS = {
  restroom: '#0ea5e9',
  corridor: '#64748b',
  lobby: '#10b981',
  maintenance: '#f59e0b',
  other: '#8b5cf6',
}

const DEVICE_META = {
  badge: { icon: '◉', label: 'Badge', color: '#8b5cf6' },
  device: { icon: '▣', label: 'Device', color: '#0ea5e9' },
  gateway: { icon: '⌁', label: 'Gateway', color: '#f59e0b' },
  sensor: { icon: '●', label: 'Sensor', color: '#22c55e' },
}

function createRestroomIcon(status) {
  const color =
    status === 'good'
      ? '#22c55e'
      : status === 'alert'
        ? '#ef4444'
        : '#94a3b8'

  return L.divIcon({
    className: 'restroom-geo-marker',
    html: `<div style="width:16px;height:16px;background:${color};border:2px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })
}

function createDeviceIcon(deviceType) {
  const meta = DEVICE_META[deviceType] || DEVICE_META.device
  return L.divIcon({
    className: 'dashboard-device-marker',
    iconSize: [30, 30],
    iconAnchor: [15, 28],
    html: `<span class="dashboard-device-marker__pin" style="--marker:${meta.color}">${meta.icon}</span>`,
  })
}

function createSiteIcon() {
  return L.divIcon({
    className: 'dashboard-site-pin',
    iconSize: [28, 34],
    iconAnchor: [14, 34],
    html: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ef4444" width="28" height="34"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5" fill="#fff"/></svg>',
  })
}

function zonePositions(zone) {
  return zone.coordinates?.coordinates?.[0]?.map(([lng, lat]) => [lat, lng]) || []
}

function FitMapBounds({ bounds, center, zoom }) {
  const map = useMap()

  useEffect(() => {
    if (bounds && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [28, 28], maxZoom: 21 })
      return
    }
    if (center) {
      map.setView(center, zoom || 15)
    }
  }, [map, bounds, center, zoom])

  return null
}

function buildMapBounds({ zones, devices, floorPlans, locations, selectedFloorId }) {
  const points = []

  const visibleZones = selectedFloorId
    ? zones.filter((zone) => zone.floorId === selectedFloorId)
    : zones

  visibleZones.forEach((zone) => {
    zonePositions(zone).forEach(([lat, lng]) => points.push([lat, lng]))
  })

  const visibleDevices = selectedFloorId
    ? devices.filter((device) => device.floorId === selectedFloorId)
    : devices

  visibleDevices.forEach((device) => {
    if (Number.isFinite(device.latitude) && Number.isFinite(device.longitude)) {
      points.push([device.latitude, device.longitude])
    }
  })

  const visiblePlans = selectedFloorId
    ? floorPlans.filter((plan) => plan.floorId === selectedFloorId)
    : floorPlans

  visiblePlans.forEach((plan) => {
    const b = plan.geoBounds
    if (!b) return
    points.push(
      [b.northLat, b.westLng],
      [b.northLat, b.eastLng],
      [b.southLat, b.westLng],
      [b.southLat, b.eastLng]
    )
  })

  locations.forEach((location) => {
    if (Number.isFinite(location.latitude) && Number.isFinite(location.longitude)) {
      points.push([location.latitude, location.longitude])
    }
  })

  if (points.length === 0) return null
  return L.latLngBounds(points)
}

export default function RestroomGeoMap({ restrooms = [], mapConfig = null }) {
  const [selectedFloorId, setSelectedFloorId] = useState('')

  const config = mapConfig || {
    locations: [],
    floors: [],
    floorPlans: [],
    zones: [],
    devices: [],
    gateways: [],
  }

  useEffect(() => {
    setSelectedFloorId('')
  }, [config.locations.map((item) => item.id).join(',')])

  const validRestrooms = useMemo(() => {
    return restrooms.filter(
      (r) =>
        Number.isFinite(Number(r.latitude)) &&
        Number.isFinite(Number(r.longitude))
    )
  }, [restrooms])

  const visibleZones = useMemo(() => {
    if (!selectedFloorId) return config.zones
    return config.zones.filter((zone) => zone.floorId === selectedFloorId)
  }, [config.zones, selectedFloorId])

  const visibleDevices = useMemo(() => {
    if (!selectedFloorId) return config.devices
    return config.devices.filter((device) => device.floorId === selectedFloorId)
  }, [config.devices, selectedFloorId])

  const visibleGateways = useMemo(() => {
    if (!selectedFloorId) return config.gateways
    return config.gateways.filter((gateway) => gateway.floorId === selectedFloorId)
  }, [config.gateways, selectedFloorId])

  const visibleFloorPlans = useMemo(() => {
    const plans = selectedFloorId
      ? config.floorPlans.filter((plan) => plan.floorId === selectedFloorId)
      : config.floorPlans
    const seen = new Set()
    return plans.filter((plan) => {
      if (!plan.geoBounds || !plan.imageData || seen.has(plan.floorId)) return false
      seen.add(plan.floorId)
      return true
    })
  }, [config.floorPlans, selectedFloorId])

  const siteLocations = useMemo(() => {
    return config.locations.filter(
      (location) =>
        Number.isFinite(location.latitude) && Number.isFinite(location.longitude)
    )
  }, [config.locations])

  const bounds = useMemo(
    () =>
      buildMapBounds({
        zones: config.zones,
        devices: config.devices,
        floorPlans: config.floorPlans,
        locations: config.locations,
        selectedFloorId: selectedFloorId || null,
      }),
    [config, selectedFloorId]
  )

  const center = useMemo(() => {
    if (bounds && bounds.isValid()) {
      const c = bounds.getCenter()
      return [c.lat, c.lng]
    }

    if (siteLocations.length > 0) {
      const lat =
        siteLocations.reduce((sum, item) => sum + item.latitude, 0) /
        siteLocations.length
      const lng =
        siteLocations.reduce((sum, item) => sum + item.longitude, 0) /
        siteLocations.length
      return [lat, lng]
    }

    if (validRestrooms.length > 0) {
      const lat =
        validRestrooms.reduce((sum, r) => sum + Number(r.latitude), 0) /
        validRestrooms.length
      const lng =
        validRestrooms.reduce((sum, r) => sum + Number(r.longitude), 0) /
        validRestrooms.length
      return [lat, lng]
    }

    return DEFAULT_CENTER
  }, [bounds, siteLocations, validRestrooms])

  const hasSpatialData =
    visibleZones.length > 0 ||
    visibleDevices.length > 0 ||
    visibleGateways.length > 0 ||
    siteLocations.length > 0 ||
    validRestrooms.length > 0

  const locationLabel =
    config.locations.length === 1
      ? config.locations[0].officeName || config.locations[0].city
      : config.locations.length > 1
        ? `${config.locations.length} sites`
        : null

  if (!hasSpatialData) {
    return (
      <div className="card restroom-geo-map">
        <h3 className="card__title">Interactive Restroom Map</h3>
        <p style={{ color: 'var(--text)', padding: '20px 0' }}>
          No location data available. Configure site locations, zones, and devices
          in Site Configuration.
        </p>
      </div>
    )
  }

  return (
    <div className="card restroom-geo-map">
      <div className="restroom-geo-map__header">
        <div>
          <h3 className="card__title">Interactive Restroom Map</h3>
          {locationLabel && (
            <p className="restroom-geo-map__subtitle">{locationLabel}</p>
          )}
        </div>
        {config.floors.length > 1 && (
          <label className="restroom-geo-map__floor-filter">
            Floor
            <select
              value={selectedFloorId}
              onChange={(e) => setSelectedFloorId(e.target.value)}
              className="select"
            >
              <option value="">All floors</option>
              {config.floors.map((floor) => (
                <option key={floor.id} value={floor.id}>
                  {floor.floorName}
                  {floor.floorNumber != null ? ` (${floor.floorNumber})` : ''}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="restroom-geo-map__canvas">
        <MapContainer
          center={center}
          zoom={16}
          maxZoom={22}
          minZoom={3}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom
          zoomControl
        >
          <FitMapBounds bounds={bounds} center={center} zoom={16} />
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="© OpenStreetMap"
          />

          {visibleFloorPlans.map((plan) => {
            const b = plan.geoBounds
            if (!b) return null
            return (
              <ImageOverlay
                key={plan.id}
                bounds={[
                  [b.northLat, b.westLng],
                  [b.southLat, b.eastLng],
                ]}
                url={plan.imageData}
                opacity={0.42}
              />
            )
          })}

          {visibleZones.map((zone) => {
            const positions = zonePositions(zone)
            if (positions.length < 3) return null
            const color = ZONE_COLORS[zone.type] || ZONE_COLORS.other
            return (
              <Polygon
                key={zone.id}
                positions={positions}
                pathOptions={{
                  color,
                  weight: 2.5,
                  fillColor: color,
                  fillOpacity: 0.22,
                  dashArray: zone.type === 'corridor' ? '6 4' : undefined,
                }}
              >
                <Tooltip permanent direction="center" className="zone-map-label">
                  {zone.name}
                </Tooltip>
                <Popup>
                  <strong>{zone.name}</strong>
                  <br />
                  Type: {zone.type}
                </Popup>
              </Polygon>
            )
          })}

          {siteLocations.map((location) => (
            <Marker
              key={location.id}
              position={[location.latitude, location.longitude]}
              icon={createSiteIcon()}
            >
              <Popup>
                <strong>{location.officeName}</strong>
                <br />
                {location.city}
              </Popup>
            </Marker>
          ))}

          {visibleDevices.map((device) => (
            <Marker
              key={device.id}
              position={[device.latitude, device.longitude]}
              icon={createDeviceIcon(device.deviceType)}
            >
              <Popup>
                <strong>
                  {DEVICE_META[device.deviceType]?.label || 'Device'}:{' '}
                  {device.badgeId}
                </strong>
                <br />
                Status: {device.status}
                <br />
                {device.zoneName ? `Zone: ${device.zoneName}` : 'No zone assigned'}
                {device.battery != null && (
                  <>
                    <br />
                    Battery: {device.battery}%
                  </>
                )}
              </Popup>
            </Marker>
          ))}

          {visibleGateways.map((gateway) => {
            const lat = Number(gateway.latitude)
            const lng = Number(gateway.longitude)
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
            return (
              <Marker
                key={gateway.id}
                position={[lat, lng]}
                icon={createDeviceIcon('gateway')}
              >
                <Popup>
                  <strong>Gateway: {gateway.name}</strong>
                  <br />
                  EUI: {gateway.gatewayEui || 'N/A'}
                  <br />
                  Status: {gateway.ttnStatus || 'unknown'}
                </Popup>
              </Marker>
            )
          })}

          {validRestrooms.map((restroom) => (
            <Marker
              key={restroom.id}
              position={[
                Number(restroom.latitude),
                Number(restroom.longitude),
              ]}
              icon={createRestroomIcon(restroom.status)}
            >
              <Popup>
                <strong>{restroom.name}</strong>
                <br />
                Status: {restroom.status}
                <br />
                {restroom.site || restroom.location || restroom.locationName}
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {(visibleZones.length > 0 || visibleDevices.length > 0 || visibleGateways.length > 0) && (
          <div className="restroom-geo-map__legend">
            {visibleZones.length > 0 && (
              <div className="restroom-geo-map__legend-group">
                <strong>Zones</strong>
                {[...new Set(visibleZones.map((zone) => zone.type))].map((type) => (
                  <span key={type} className="restroom-geo-map__legend-item">
                    <i
                      className="restroom-geo-map__legend-swatch"
                      style={{ background: ZONE_COLORS[type] || ZONE_COLORS.other }}
                    />
                    {type}
                  </span>
                ))}
              </div>
            )}
            {visibleDevices.length > 0 && (
              <div className="restroom-geo-map__legend-group">
                <strong>Devices</strong>
                {[...new Set(visibleDevices.map((device) => device.deviceType))].map(
                  (type) => (
                    <span key={type} className="restroom-geo-map__legend-item">
                      <i
                        className="restroom-geo-map__legend-dot"
                        style={{
                          color: DEVICE_META[type]?.color || DEVICE_META.device.color,
                        }}
                      >
                        {DEVICE_META[type]?.icon || '▣'}
                      </i>
                      {DEVICE_META[type]?.label || type}
                    </span>
                  )
                )}
              </div>
            )}
            {visibleGateways.length > 0 && (
              <div className="restroom-geo-map__legend-group">
                <strong>Gateways</strong>
                <span className="restroom-geo-map__legend-item">
                  <i
                    className="restroom-geo-map__legend-dot"
                    style={{ color: DEVICE_META.gateway.color }}
                  >
                    {DEVICE_META.gateway.icon}
                  </i>
                  Gateway
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
