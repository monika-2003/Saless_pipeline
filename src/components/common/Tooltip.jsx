import { useId, useState } from 'react'

export function Tooltip({ label, children }) {
  const [open, setOpen] = useState(false)
  const id = useId()

  return (
    <span
      className="tooltip"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open ? (
        <span className="tooltip-bubble" role="tooltip" id={id}>
          {label}
        </span>
      ) : null}
    </span>
  )
}
