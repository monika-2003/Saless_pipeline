import { useRef } from 'react'
import { X } from 'lucide-react'
import { useFocusTrap } from '../../hooks/useFocusTrap.js'
import { IconButton } from './IconButton.jsx'

export function Modal({ title, children, onClose, labelledBy }) {
  const panelRef = useRef(null)
  useFocusTrap(panelRef, { onClose })

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div ref={panelRef} className="modal" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
        <div className="modal-header">
          <h2 id={labelledBy}>{title}</h2>
          <IconButton label="Close" data-autofocus onClick={onClose}>
            <X size={16} />
          </IconButton>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </>
  )
}
