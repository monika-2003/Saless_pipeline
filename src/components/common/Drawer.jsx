import { useEffect } from 'react'
import { X } from 'lucide-react'
import { IconButton } from './IconButton.jsx'

export function Drawer({ title, children, onClose, labelledBy, footer }) {
  useEffect(() => {
    function onKey(event) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
        <div className="drawer-header">
          <h2 id={labelledBy || undefined}>{title}</h2>
          <IconButton label="Close" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </div>
        <div className="drawer-body">{children}</div>
        {footer ? <div className="drawer-header">{footer}</div> : null}
      </aside>
    </>
  )
}
