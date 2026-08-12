export default function DashboardCards({ stats }) {
  const cards = [
    { label: 'Total Restrooms', value: stats.totalRestrooms, icon: '🚻', color: '#3b82f6' },
    { label: 'Total Devices', value: stats.totalDevices, icon: '📱', color: '#8b5cf6' },
    { label: "Today's Feedback", value: stats.todayFeedback, icon: '💬', color: '#22c55e' },
    { label: 'Active Alerts', value: stats.activeAlerts, icon: '🔔', color: '#ef4444' },
    { label: 'Online Devices', value: stats.onlineDevices, icon: '🟢', color: '#22c55e' },
    { label: 'Offline Devices', value: stats.offlineDevices, icon: '🔴', color: '#ef4444' },
  ]

  return (
    <div className="dashboard-cards">
      {cards.map((card) => (
        <article
          key={card.label}
          className="dashboard-card"
          style={{ '--card-accent': card.color }}
        >
          <span className="dashboard-card__icon" aria-hidden="true">{card.icon}</span>
          <div>
            <p className="dashboard-card__label">{card.label}</p>
            <p className="dashboard-card__value">{card.value}</p>
          </div>
        </article>
      ))}
    </div>
  )
}
