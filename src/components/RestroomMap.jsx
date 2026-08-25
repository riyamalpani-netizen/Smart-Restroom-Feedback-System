import { Link } from 'react-router-dom'
import StatusBadge from './common/StatusBadge'

export default function RestroomMap({ restrooms = [], limit = 6 }) {
  // Group restrooms by site (location), then by floor within each site
  const siteMap = new Map()

  restrooms.forEach((r) => {
    const siteKey = r.floor?.location?.id || r.locationId || 'unknown'
    const siteName =
      r.floor?.location
        ? `${r.floor.location.city} — ${r.floor.location.officeName}`
        : r.locationName || 'Unknown Site'
    const floorKey = r.floor?.floorNumber ?? r.floor?.floorName ?? 'Unknown'

    if (!siteMap.has(siteKey)) {
      siteMap.set(siteKey, { siteName, floors: new Map() })
    }
    const site = siteMap.get(siteKey)
    if (!site.floors.has(floorKey)) {
      site.floors.set(floorKey, [])
    }
    site.floors.get(floorKey).push(r)
  })

  const sites = Array.from(siteMap.values())

  if (sites.length === 0) {
    return (
      <div className="restroom-map card">
        <div className="card__header">
          <h3 className="card__title">Restroom Status Overview</h3>
          <Link to="/restrooms" className="card__link">View all</Link>
        </div>
        <p style={{ color: 'var(--text)', fontSize: 14 }}>No restrooms configured.</p>
      </div>
    )
  }

  return (
    <div className="restroom-map card">
      <div className="card__header">
        <h3 className="card__title">Restroom Status Overview</h3>
        <Link to="/restrooms" className="card__link">View all</Link>
      </div>

      <div className="restroom-map__grid">
        {sites.map(({ siteName, floors }) => {
          const sortedFloors = Array.from(floors.entries()).sort(([a], [b]) => {
            if (typeof a === 'number' && typeof b === 'number') return a - b
            return String(a).localeCompare(String(b))
          })

          return (
            <div key={siteName} className="restroom-map__site">
              <div className="restroom-map__site-header">
                <span className="restroom-map__site-icon">🏢</span>
                <strong className="restroom-map__site-name">{siteName}</strong>
              </div>

              {sortedFloors.map(([floorKey, rooms]) => (
                <div key={floorKey} className="restroom-map__floor">
                  <h4>Floor {floorKey}</h4>
                  <div className="restroom-map__rooms">
                    {rooms.slice(0, limit).map((room) => (
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
    </div>
  )
}
