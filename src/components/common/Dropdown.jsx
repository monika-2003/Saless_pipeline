import { useEffect, useRef, useState } from 'react'
import { cx } from '../../utils/cx.js'

export function Dropdown({ trigger, children, align = 'left' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    function onPointerDown(event) {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false)
    }
    function onKey(event) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="dropdown" ref={ref}>
      <span onClick={() => setOpen((value) => !value)}>{trigger}</span>
      {open ? (
        <div
          className="dropdown-menu"
          role="menu"
          style={align === 'right' ? { left: 'auto', right: 0 } : undefined}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      ) : null}
    </div>
  )
}

export function DropdownItem({ children, onClick, className }) {
  return (
    <button type="button" role="menuitem" className={cx('dropdown-item', className)} onClick={onClick}>
      {children}
    </button>
  )
}
