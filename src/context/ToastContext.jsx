import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

const ToastContext = createContext(null)

const ICONS = {
  success: '✓',
  error: '✗',
  info: 'ℹ',
  warning: '⚠',
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.map((t) => t.id === id ? { ...t, leaving: true } : t))
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 300)
  }, [])

  const toast = useCallback((message, type = 'success', duration = 3500) => {
    const id = ++idRef.current
    setToasts((prev) => [...prev, { id, message, type, leaving: false }])
    setTimeout(() => dismiss(id), duration)
    return id
  }, [dismiss])

  const toastApi = useMemo(() => Object.assign(
    (message, type = 'success', duration = 3500) => toast(message, type, duration),
    {
      success: (message, duration) => toast(message, 'success', duration),
      error: (message, duration) => toast(message, 'error', duration ?? 5000),
      info: (message, duration) => toast(message, 'info', duration),
      warning: (message, duration) => toast(message, 'warning', duration),
    },
  ), [toast])

  return (
    <ToastContext.Provider value={toastApi}>
      {children}
      <div className="toast-container" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast toast--${t.type} ${t.leaving ? 'toast--leaving' : ''}`}
            role="alert"
          >
            <span className="toast__icon">{ICONS[t.type]}</span>
            <span className="toast__message">{t.message}</span>
            <button
              type="button"
              className="toast__close"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
