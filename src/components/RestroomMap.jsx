import StatusBadge from './common/StatusBadge'

export default function RestroomMap({ restrooms }) {
  const floors = [...new Set(restrooms.map((r) => r.floor?.floorNumber ?? r.floor?.floorName ?? 'Unknown'))].sort((a, b) => {
    if (typeof a === 'number' && typeof b === 'number') return a - b
    return String(a).localeCompare(String(b))
  })

  return (
    <div className="restroom-map card">
      <h3 className="card__title">Restroom Status Overview</h3>
      <div className="restroom-map__grid">
        {floors.map((floor) => (
          <div key={floor} className="restroom-map__floor">
            <h4>Floor {floor}</h4>
            <div className="restroom-map__rooms">
              {restrooms
                .filter((r) => (r.floor?.floorNumber ?? r.floor?.floorName ?? 'Unknown') === floor)
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
