import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Minus } from 'lucide-react'
import { cx } from '../../utils/cx.js'

export function MultiSelect({
  label,
  values = [],
  onChange,
  options = [],
  placeholder = 'All',
}) {
  const selectedValues = Array.isArray(values) ? values : values ? [values] : []
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const [coords, setCoords] = useState(null)
  const buttonRef = useRef(null)
  const menuRef = useRef(null)
  const listId = useId()
  const selectedSet = useMemo(() => new Set(selectedValues), [selectedValues])
  const selectedOptions = useMemo(
    () => options.filter((option) => selectedSet.has(option.value)),
    [options, selectedSet],
  )
  const allSelected = options.length > 0 && selectedOptions.length === options.length
  const someSelected = selectedOptions.length > 0 && !allSelected
  const itemCount = options.length + 1

  useEffect(() => {
    if (!open) {
      setHighlight(-1)
      return undefined
    }
    if (!buttonRef.current) return undefined

    const rect = buttonRef.current.getBoundingClientRect()
    const menuHeight = Math.min(itemCount * 36 + 48, 280)
    const spaceBelow = window.innerHeight - rect.bottom
    const openUp = spaceBelow < menuHeight && rect.top > spaceBelow
    const width = Math.min(Math.max(rect.width, 220), window.innerWidth - 16)
    const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - width - 8))

    setCoords({
      top: openUp ? undefined : rect.bottom + 4,
      bottom: openUp ? window.innerHeight - rect.top + 4 : undefined,
      left,
      width,
    })
    setHighlight((current) => (current >= 0 ? current : 0))

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
  }, [open, itemCount])

  function toggle(option) {
    if (selectedSet.has(option.value)) {
      onChange(selectedValues.filter((value) => value !== option.value))
      return
    }
    onChange([...selectedValues, option.value])
  }

  function toggleAll() {
    onChange(allSelected ? [] : options.map((option) => option.value))
  }

  function activate(index) {
    if (index === 0) toggleAll()
    else toggle(options[index - 1])
  }

  const summary = !selectedOptions.length
    ? placeholder
    : selectedOptions.length === 1
      ? selectedOptions[0].label
      : `${selectedOptions[0].label}`

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
        className={cx('select-input', selectedOptions.length > 0 && 'has-value')}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-multiselectable="true"
        aria-labelledby={label ? `${listId}-label` : undefined}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setOpen(true)
            setHighlight((index) => Math.min(itemCount - 1, index < 0 ? 0 : index + 1))
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault()
            setOpen(true)
            setHighlight((index) => Math.max(0, index < 0 ? itemCount - 1 : index - 1))
          }
          if ((event.key === 'Enter' || event.key === ' ') && open && highlight >= 0) {
            event.preventDefault()
            activate(highlight)
          }
        }}
      >
        <span className={cx('select-value', !selectedOptions.length && 'select-placeholder')}>
          {selectedOptions.length === 1 && selectedOptions[0].color ? (
            <span className="color-dot" style={{ background: selectedOptions[0].color }} />
          ) : null}
          <span className="select-value-text">{summary}</span>
          {selectedOptions.length > 1 ? (
            <span className="select-count">+{selectedOptions.length - 1}</span>
          ) : null}
        </span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {open && coords
        ? createPortal(
            <div
              ref={menuRef}
              className="select-menu multi-select-menu"
              style={{
                top: coords.top,
                bottom: coords.bottom,
                left: coords.left,
                width: coords.width,
              }}
            >
              <ul id={listId} role="listbox" aria-multiselectable="true" className="multi-select-list">
                <li className="multi-select-all">
                  <button
                    type="button"
                    role="option"
                    aria-selected={allSelected}
                    className={cx(
                      'select-option',
                      allSelected && 'is-selected',
                      highlight === 0 && 'is-active',
                    )}
                    onMouseEnter={() => setHighlight(0)}
                    onClick={toggleAll}
                  >
                    <span
                      className={cx(
                        'check-wrap',
                        allSelected && 'is-checked',
                        someSelected && 'is-partial',
                      )}
                      aria-hidden="true"
                    >
                      <span className="check-box">
                        {someSelected ? <Minus size={11} strokeWidth={3} /> : null}
                        {allSelected ? <Check size={11} strokeWidth={3} /> : null}
                      </span>
                    </span>
                    <span>Select all</span>
                  </button>
                </li>
                {options.map((option, index) => {
                  const isSelected = selectedSet.has(option.value)
                  const itemIndex = index + 1
                  return (
                    <li key={`${option.value}-${index}`}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        className={cx(
                          'select-option',
                          isSelected && 'is-selected',
                          itemIndex === highlight && 'is-active',
                        )}
                        onMouseEnter={() => setHighlight(itemIndex)}
                        onClick={() => toggle(option)}
                      >
                        <span className={cx('check-wrap', isSelected && 'is-checked')} aria-hidden="true">
                          <span className="check-box">
                            {isSelected ? <Check size={11} strokeWidth={3} /> : null}
                          </span>
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                          {option.color ? (
                            <span className="color-dot" style={{ background: option.color }} />
                          ) : null}
                          {option.label}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
