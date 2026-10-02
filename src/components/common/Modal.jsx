import { useEffect } from 'react'
import { X } from 'lucide-react'
import { IconButton } from './IconButton.jsx'

export function Modal({ title, children, onClose, labelledBy }) {
  useEffect(() => {
    function onKey(event) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
        <div className="modal-header">
          <h2 id={labelledBy}>{title}</h2>
          <IconButton label="Close" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </>
  )
}
