import { cloneElement, isValidElement, useEffect, useRef, useState } from 'react'
import { cx } from '../../utils/cx.js'

function menuItems(root) {
  return [...(root?.querySelectorAll('[role="menuitem"]') || [])]
}

export function Dropdown({ trigger, children, align = 'left', onHighlight }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const triggerRef = useRef(null)
  const onHighlightRef = useRef(onHighlight)
  onHighlightRef.current = onHighlight

  function focusTrigger() {
    triggerRef.current?.querySelector('button, [href], [tabindex]:not([tabindex="-1"])')?.focus()
  }

  function focusItem(index) {
    const items = menuItems(ref.current)
    if (!items.length) return
    const item = items[(index + items.length) % items.length]
    item.focus()
    const value = item.dataset.value
    if (value != null) onHighlightRef.current?.(value)
  }

  function focusActiveOrFirst() {
    const items = menuItems(ref.current)
    if (!items.length) return
    const active = items.findIndex((item) => item.classList.contains('is-active'))
    items[active >= 0 ? active : 0].focus()
  }

  useEffect(() => {
    if (!open) return undefined
    const frame = requestAnimationFrame(focusActiveOrFirst)

    function onPointerDown(event) {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false)
    }

    function onKey(event) {
      if (!ref.current?.contains(event.target)) return

      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        setOpen(false)
        focusTrigger()
        return
      }

      const items = menuItems(ref.current)
      if (!items.length) return
      const current = items.indexOf(document.activeElement)

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        event.stopPropagation()
        focusItem(current < 0 ? 0 : current + 1)
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        event.stopPropagation()
        focusItem(current < 0 ? items.length - 1 : current - 1)
      }
      if (event.key === 'Home') {
        event.preventDefault()
        event.stopPropagation()
        focusItem(0)
      }
      if (event.key === 'End') {
        event.preventDefault()
        event.stopPropagation()
        focusItem(items.length - 1)
      }
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  const triggerNode = isValidElement(trigger)
    ? cloneElement(trigger, {
      'aria-haspopup': trigger.props['aria-haspopup'] || 'menu',
      'aria-expanded': open,
    })
    : trigger

  return (
    <div className="dropdown" ref={ref}>
      <span
        ref={triggerRef}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
          event.preventDefault()
          event.stopPropagation()
          if (!open) setOpen(true)
        }}
      >
        {triggerNode}
      </span>
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

export function DropdownItem({ children, onClick, className, value, ...props }) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cx('dropdown-item', className)}
      data-value={value}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  )
}
