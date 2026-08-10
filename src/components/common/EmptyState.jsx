export default function EmptyState({ icon = '📭', title, message }) {
  return (
    <div className="empty-state">
      <span className="empty-state__icon" aria-hidden="true">{icon}</span>
      <h3>{title}</h3>
      {message && <p>{message}</p>}
    </div>
  )
}
