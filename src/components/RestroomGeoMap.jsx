import { useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const DEFAULT_CENTER = [20.5937, 78.9629]

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

export default function RestroomGeoMap({ restrooms = [] }) {
  const validRestrooms = useMemo(() => {
    return restrooms.filter(
      (r) =>
        Number.isFinite(Number(r.latitude)) &&
        Number.isFinite(Number(r.longitude))
    )
  }, [restrooms])

  const center = useMemo(() => {
    if (validRestrooms.length === 0) return DEFAULT_CENTER

    const lat =
      validRestrooms.reduce((sum, r) => sum + Number(r.latitude), 0) /
      validRestrooms.length
    const lng =
      validRestrooms.reduce((sum, r) => sum + Number(r.longitude), 0) /
      validRestrooms.length

    return [lat, lng]
  }, [validRestrooms])

  if (validRestrooms.length === 0) {
    return (
      <div className="card restroom-geo-map">
        <h3 className="card__title">Interactive Restroom Map</h3>
        <p style={{ color: 'var(--text)', padding: '20px 0' }}>
          No location data available. Configure site locations in Site
          Configuration.
        </p>
      </div>
    )
  }

  return (
    <div className="card restroom-geo-map">
      <h3 className="card__title">Interactive Restroom Map</h3>
      <div
        style={{
          height: 420,
          borderRadius: 8,
          overflow: 'hidden',
          border: '1px solid var(--border)',
        }}
      >
        <MapContainer
          center={center}
          zoom={15}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />
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
                {restroom.locationName}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  )
}
