import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import { cx } from '../../utils/cx.js'

export function Select({
  label,
  value,
  onChange,
  options = [],
  placeholder = 'Select',
}) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const [coords, setCoords] = useState(null)
  const buttonRef = useRef(null)
  const menuRef = useRef(null)
  const listId = useId()
  const selected = options.find((option) => option.value === value)

  useEffect(() => {
    if (!open || !buttonRef.current) return undefined

    const rect = buttonRef.current.getBoundingClientRect()
    const menuHeight = Math.min(options.length * 36 + 10, 260)
    const spaceBelow = window.innerHeight - rect.bottom
    const openUp = spaceBelow < menuHeight && rect.top > spaceBelow
    const width = Math.min(Math.max(rect.width, 180), window.innerWidth - 16)
    const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - width - 8))

    setCoords({
      top: openUp ? undefined : rect.bottom + 4,
      bottom: openUp ? window.innerHeight - rect.top + 4 : undefined,
      left,
      width,
    })
    setHighlight(Math.max(0, options.findIndex((option) => option.value === value)))

    function onPointerDown(event) {
      if (buttonRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) return
      setOpen(false)
    }

    function onKey(event) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
      buttonRef.current?.focus()
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open, options, value])

  function choose(option) {
    onChange(option.value)
    setOpen(false)
    buttonRef.current?.focus()
  }

  return (
    <div className="field">
      {label ? (
        <span className="field-label" id={`${listId}-label`}>
          {label}
        </span>
      ) : null}
      <button
        type="button"
        ref={buttonRef}
        className="select-input"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={label ? `${listId}-label` : undefined}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setOpen(true)
            setHighlight((index) => Math.min(options.length - 1, index < 0 ? 0 : index + 1))
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault()
            setOpen(true)
            setHighlight((index) => Math.max(0, index < 0 ? options.length - 1 : index - 1))
          }
          if (event.key === 'Enter' && open && highlight >= 0) {
            event.preventDefault()
            choose(options[highlight])
          }
        }}
      >
        <span className={cx(!selected && 'select-placeholder')} style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {selected?.color ? (
            <span className="color-dot" style={{ background: selected.color, color: selected.color }} />
          ) : null}
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {open && coords
        ? createPortal(
            <ul
              ref={menuRef}
              id={listId}
              role="listbox"
              className="select-menu"
              style={{
                top: coords.top,
                bottom: coords.bottom,
                left: coords.left,
                width: coords.width,
              }}
            >
              {options.map((option, index) => {
                const isSelected = option.value === value
                return (
                  <li key={`${option.value}-${index}`}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={cx(
                        'select-option',
                        isSelected && 'is-selected',
                        index === highlight && 'is-active',
                      )}
                      onMouseEnter={() => setHighlight(index)}
                      onClick={() => choose(option)}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        {option.color ? (
                          <span className="color-dot" style={{ background: option.color, color: option.color }} />
                        ) : null}
                        {option.label}
                      </span>
                      {isSelected ? <Check size={14} aria-hidden="true" /> : null}
                    </button>
                  </li>
                )
              })}
            </ul>,
            document.body,
          )
        : null}
    </div>
  )
}
