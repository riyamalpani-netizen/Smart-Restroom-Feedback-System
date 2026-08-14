import { Link } from 'react-router-dom'
import StatusBadge from './common/StatusBadge'

export default function RestroomMap({ restrooms = [], limit = 6 }) {
  const floors = [...new Set(restrooms.map((r) => r.floor?.floorNumber ?? r.floor?.floorName ?? 'Unknown'))].sort((a, b) => {
    if (typeof a === 'number' && typeof b === 'number') return a - b
    return String(a).localeCompare(String(b))
  })

  return (
    <div className="restroom-map card">
      <div className="card__header">
        <h3 className="card__title">Restroom Status Overview</h3>
        <Link to="/restrooms" className="card__link">View all</Link>
      </div>
      <div className="restroom-map__grid">
        {floors.slice(0, 2).map((floor) => (
          <div key={floor} className="restroom-map__floor">
            <h4>Floor {floor}</h4>
            <div className="restroom-map__rooms">
              {restrooms
                .filter((r) => (r.floor?.floorNumber ?? r.floor?.floorName ?? 'Unknown') === floor)
                .slice(0, limit)
                .map((room) => (
                  <div
                    key={room.id}
                    className={`restroom-map__room restroom-map__room--${room.status}`}
                  >
                    <span className="restroom-map__name">{room.name.split(' - ')[1] ?? room.name}</span>
                    <StatusBadge status={room.status} variant="restroom" />
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
