export default function DashboardCards({ stats }) {
  const cards = [
    { label: 'Unhappy Reports Today', value: stats.unhappyFeedback, icon: '⚠️', color: 'var(--danger)' },
    { label: 'Active Alerts', value: stats.activeAlerts, icon: '🔔', color: 'var(--warning)' },
    { label: "Today's Feedback", value: stats.todayFeedback, icon: '💬', color: 'var(--primary)' },
    { label: 'Total Restrooms', value: stats.totalRestrooms, icon: '🚻', color: 'var(--accent)' },
    { label: 'Total Devices', value: stats.totalDevices, icon: '📱', color: '#6366f1' },
    { label: 'Online Devices', value: stats.onlineDevices, icon: '🟢', color: 'var(--success)' },
    { label: 'Offline Devices', value: stats.offlineDevices, icon: '🔴', color: 'var(--danger)' },
    { label: 'Happy', value: stats.happyFeedback, icon: '😊', color: 'var(--success)' },
    { label: 'Okay', value: stats.okayFeedback, icon: '😐', color: 'var(--warning)' },
  ]

  return (
    <div className="dashboard-cards">
      {cards.map((card) => (
        <article key={card.label} className="dashboard-card" style={{ '--card-accent': card.color }}>
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
