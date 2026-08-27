import { Link } from 'react-router-dom'
import StatusBadge from './common/StatusBadge'

const ROOM_LIMIT = 8 // max rooms shown across all floors

export default function RestroomMap({ restrooms = [] }) {
  // Show first ROOM_LIMIT restrooms grouped by site → floor
  const limited = restrooms.slice(0, ROOM_LIMIT)
  const hiddenCount = Math.max(0, restrooms.length - ROOM_LIMIT)

  const sidemap = new Map()
  limited.forEach((r) => {
    const siteKey = r.floor?.location?.id || r.locationId || 'unknown'
    const siteName = r.floor?.location
      ? `${r.floor.location.officeName || r.floor.location.city}`
      : r.locationName || 'Unknown Site'
    const floorKey = r.floor?.floorName ?? `Floor ${r.floor?.floorNumber ?? '?'}`

    if (!sidemap.has(siteKey)) sidemap.set(siteKey, { siteName, floors: new Map() })
    const site = sidemap.get(siteKey)
    if (!site.floors.has(floorKey)) site.floors.set(floorKey, [])
    site.floors.get(floorKey).push(r)
  })

  const sites = Array.from(sidemap.values())

  return (
    <div className="restroom-map card">
      <div className="card__header">
        <h3 className="card__title">Restroom Status</h3>
        <Link to="/restrooms" className="card__link">View all</Link>
      </div>

      {sites.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: 13, padding: '12px 0' }}>
          No restrooms configured.
        </p>
      ) : (
        <>
          <div className="restroom-map__grid">
            {sites.map(({ siteName, floors }) => {
              const sortedFloors = Array.from(floors.entries()).sort(([a], [b]) =>
                String(a).localeCompare(String(b)),
              )
              return (
                <div key={siteName} className="restroom-map__site">
                  <div className="restroom-map__site-header">
                    <span className="restroom-map__site-icon">🏢</span>
                    <strong className="restroom-map__site-name">{siteName}</strong>
                  </div>
                  {sortedFloors.map(([floorKey, rooms]) => (
                    <div key={floorKey} className="restroom-map__floor">
                      <h4>{floorKey}</h4>
                      <div className="restroom-map__rooms">
                        {rooms.map((room) => (
                          <div
                            key={room.id}
                            className={`restroom-map__room restroom-map__room--${room.status}`}
                          >
                            <span className="restroom-map__name">
                              {room.name.split(' - ')[1] ?? room.name}
                            </span>
                            <StatusBadge status={room.status} variant="restroom" />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>

          {hiddenCount > 0 && (
            <div className="card__footer">
              <Link to="/restrooms" className="card__footer-link">
                +{hiddenCount} more restroom{hiddenCount !== 1 ? 's' : ''} — View all →
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  )
}
