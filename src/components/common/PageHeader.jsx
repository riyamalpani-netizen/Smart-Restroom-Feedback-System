export default function PageHeader({ action }) {
  if (!action) return null

  return (
    <header className="page-header">
      <div className="page-header__action">{action}</div>
    </header>
  )
}
