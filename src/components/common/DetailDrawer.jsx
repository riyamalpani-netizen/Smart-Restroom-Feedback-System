import { useEffect } from 'react'

/**
 * A slide-in drawer from the right that shows item details.
 * Props:
 *   open       – boolean
 *   onClose    – function
 *   title      – string
 *   subtitle   – string (optional)
 *   children   – content
 */
export default function DetailDrawer({ open, onClose, title, subtitle, children }) {
  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="drawer-backdrop"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Drawer panel */}
      <aside className={`detail-drawer ${open ? 'detail-drawer--open' : ''}`} aria-label={title}>
        <div className="detail-drawer__header">
          <div>
            <h2 className="detail-drawer__title">{title}</h2>
            {subtitle && <p className="detail-drawer__subtitle">{subtitle}</p>}
          </div>
          <button
            type="button"
            className="detail-drawer__close"
            onClick={onClose}
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="detail-drawer__body">
          {children}
        </div>
      </aside>
    </>
  )
}
