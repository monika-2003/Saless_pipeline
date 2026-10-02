import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { IconButton } from './IconButton.jsx'

const ToastContext = createContext(null)

const ICONS = {
  success: CheckCircle2,
  danger: AlertTriangle,
  warning: AlertTriangle,
  info: Info,
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const pushToast = useCallback((toast) => {
    const id = `${Date.now()}-${Math.random()}`
    setToasts((current) => [...current.slice(-3), { id, tone: 'info', ...toast }])
    if (toast.sticky) return id
    window.setTimeout(() => dismiss(id), toast.duration ?? 3200)
    return id
  }, [dismiss])

  const value = useMemo(() => ({ pushToast, dismiss }), [pushToast, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((toast) => {
          const Icon = ICONS[toast.tone] || Info
          return (
            <div key={toast.id} className={`toast toast-${toast.tone}`} role="status">
              <Icon size={16} />
              <div style={{ flex: 1 }}>
                <div className="toast-title">{toast.title}</div>
                {toast.message ? <div className="toast-message">{toast.message}</div> : null}
                {toast.action ? (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={toast.action.onClick}>
                    {toast.action.label}
                  </button>
                ) : null}
              </div>
              <IconButton label="Dismiss notification" onClick={() => dismiss(toast.id)}>
                <X size={14} />
              </IconButton>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToasts() {
  const value = useContext(ToastContext)
  if (!value) throw new Error('useToasts must be used inside ToastProvider')
  return value
}
