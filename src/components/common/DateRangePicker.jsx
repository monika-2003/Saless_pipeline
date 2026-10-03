import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatDateChip, parseDateInput, toDateInput } from '../../utils/format.js'
import { cx } from '../../utils/cx.js'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
const PICKER_WIDTH = 340

function parseKey(value) {
  const time = parseDateInput(value)
  return time == null ? null : new Date(time)
}

function shiftMonth(year, month, delta) {
  const next = new Date(year, month + delta, 1)
  return { year: next.getFullYear(), month: next.getMonth() }
}

function buildCells(year, month) {
  const first = new Date(year, month, 1)
  const mondayOffset = (first.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cellCount = Math.ceil((mondayOffset + daysInMonth) / 7) * 7
  const start = new Date(year, month, 1 - mondayOffset)
  const cells = []

  for (let index = 0; index < cellCount; index += 1) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index)
    cells.push({
      key: toDateInput(date.getTime()),
      date,
      outside: date.getMonth() !== month,
      weekday: index % 7,
    })
  }

  return cells
}

function chipLabel(value, placeholder) {
  const date = parseKey(value)
  return date ? formatDateChip(date.getTime()) : placeholder
}

function triggerLabel(from, to) {
  if (!from && !to) return 'Select dates'
  if (from && to) {
    const start = parseKey(from)
    const end = parseKey(to)
    const startLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const endLabel = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return `${startLabel} – ${endLabel}`
  }
  if (from) return `From ${chipLabel(from)}`
  return `Until ${chipLabel(to)}`
}

export function DateRangePicker({
  label,
  from = '',
  to = '',
  onApply,
  defaultOpen = false,
}) {
  const [open, setOpen] = useState(defaultOpen)
  const [coords, setCoords] = useState(null)
  const [draftFrom, setDraftFrom] = useState(from)
  const [draftTo, setDraftTo] = useState(to)
  const [activeChip, setActiveChip] = useState('from')
  const [hoverKey, setHoverKey] = useState(null)
  const [openMenu, setOpenMenu] = useState(null)
  const [focusKey, setFocusKey] = useState(() => toDateInput((parseKey(from) || new Date()).getTime()))
  const buttonRef = useRef(null)
  const panelRef = useRef(null)
  const pickerId = useId()

  const initial = parseKey(from) || parseKey(to) || new Date()
  const [view, setView] = useState({
    year: initial.getFullYear(),
    month: initial.getMonth(),
  })

  const cells = useMemo(() => buildCells(view.year, view.month), [view.year, view.month])
  const years = useMemo(() => {
    const current = new Date().getFullYear()
    const fromYear = parseKey(draftFrom)?.getFullYear()
    const toYear = parseKey(draftTo)?.getFullYear()
    const min = Math.min(current - 2, fromYear ?? current, toYear ?? current)
    const max = Math.max(current + 3, fromYear ?? current, toYear ?? current)
    const list = []
    for (let year = min; year <= max; year += 1) list.push(year)
    return list
  }, [draftFrom, draftTo])

  useEffect(() => {
    if (!open) return undefined

    setDraftFrom(from)
    setDraftTo(to)
    setActiveChip(from && !to ? 'to' : 'from')
    setHoverKey(null)
    setOpenMenu(null)
    const focus = parseKey(from) || parseKey(to) || new Date()
    setView({ year: focus.getFullYear(), month: focus.getMonth() })
    setFocusKey(toDateInput(focus.getTime()))

    function place() {
      if (!buttonRef.current) return
      const rect = buttonRef.current.getBoundingClientRect()
      const estimatedHeight = 420
      const spaceBelow = window.innerHeight - rect.bottom
      const openUp = spaceBelow < estimatedHeight && rect.top > spaceBelow
      const width = Math.min(PICKER_WIDTH, window.innerWidth - 16)
      const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - width - 8))
      setCoords({
        top: openUp ? undefined : rect.bottom + 6,
        bottom: openUp ? window.innerHeight - rect.top + 6 : undefined,
        left,
        width,
      })
    }

    place()

    function onPointerDown(event) {
      if (buttonRef.current?.contains(event.target) || panelRef.current?.contains(event.target)) return
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
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    const frame = requestAnimationFrame(() => {
      panelRef.current?.querySelector(`[data-cal-day="${toDateInput(focus.getTime())}"]`)?.focus()
    })
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey, true)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, from, to])

  useEffect(() => {
    if (!open) return
    panelRef.current?.querySelector(`[data-cal-day="${focusKey}"]`)?.focus()
  }, [focusKey, open])

  const preview = useMemo(() => {
    let start = parseKey(draftFrom)
    let end = parseKey(draftTo)
    if (start && !end && hoverKey && activeChip === 'to') {
      const hovered = parseKey(hoverKey)
      if (hovered) {
        if (hovered < start) {
          end = start
          start = hovered
        } else {
          end = hovered
        }
      }
    }
    return {
      start: start ? start.getTime() : null,
      end: end ? end.getTime() : null,
    }
  }, [draftFrom, draftTo, hoverKey, activeChip])

  function selectDay(key) {
    const clicked = parseKey(key)
    if (!clicked) return
    const clickedTime = clicked.getTime()
    const fromDate = parseKey(draftFrom)
    const toDate = parseKey(draftTo)

    if (activeChip === 'from') {
      setDraftFrom(key)
      if (toDate && clickedTime > toDate.getTime()) setDraftTo('')
      setActiveChip('to')
      if (clicked.getMonth() !== view.month || clicked.getFullYear() !== view.year) {
        setView({ year: clicked.getFullYear(), month: clicked.getMonth() })
      }
      return
    }

    if (!fromDate) {
      setDraftFrom(key)
      setActiveChip('to')
      return
    }

    if (clickedTime < fromDate.getTime()) {
      setDraftFrom(key)
      setDraftTo(toDateInput(fromDate.getTime()))
    } else {
      setDraftTo(key)
    }

    if (clicked.getMonth() !== view.month || clicked.getFullYear() !== view.year) {
      setView({ year: clicked.getFullYear(), month: clicked.getMonth() })
    }
  }

  function moveCalendarFocus(delta) {
    const index = cells.findIndex((cell) => cell.key === focusKey)
    const start = index < 0 ? 0 : index
    const nextIndex = start + delta
    if (nextIndex < 0) {
      const previous = shiftMonth(view.year, view.month, -1)
      const previousCells = buildCells(previous.year, previous.month)
      const target = previousCells[Math.max(0, previousCells.length + nextIndex)]
      setView(previous)
      setFocusKey(target.key)
      return
    }
    if (nextIndex >= cells.length) {
      const following = shiftMonth(view.year, view.month, 1)
      const nextCells = buildCells(following.year, following.month)
      const target = nextCells[Math.min(nextCells.length - 1, nextIndex - cells.length)]
      setView(following)
      setFocusKey(target.key)
      return
    }
    setFocusKey(cells[nextIndex].key)
  }

  function onGridKeyDown(event) {
    if (event.target.closest('.cal-caption-menu')) return
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      moveCalendarFocus(-1)
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      moveCalendarFocus(1)
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      moveCalendarFocus(-7)
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      moveCalendarFocus(7)
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      selectDay(focusKey)
    }
  }

  function apply() {
    onApply({ from: draftFrom, to: draftTo })
    setOpen(false)
    buttonRef.current?.focus()
  }

  const summary = triggerLabel(from, to)
  const hasValue = Boolean(from || to)

  return (
    <div className="field date-picker-field">
      {label ? (
        <span className="field-label" id={`${pickerId}-label`}>
          {label}
        </span>
      ) : null}
      <button
        type="button"
        ref={buttonRef}
        className="select-input"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-labelledby={label ? `${pickerId}-label` : undefined}
        aria-controls={pickerId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={cx(!hasValue && 'select-placeholder')}>{summary}</span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {open && coords
        ? createPortal(
            <div
              ref={panelRef}
              id={pickerId}
              className="date-picker"
              role="dialog"
              aria-label="Close date range"
              style={{ top: coords.top, bottom: coords.bottom, left: coords.left, width: coords.width }}
            >
              <div className="cal-chips">
                <button
                  type="button"
                  className={cx('cal-chip', activeChip === 'from' && 'is-active')}
                  onClick={() => setActiveChip('from')}
                >
                  {chipLabel(draftFrom, 'Start date')}
                </button>
                <button
                  type="button"
                  className={cx('cal-chip', activeChip === 'to' && 'is-active')}
                  onClick={() => setActiveChip('to')}
                >
                  {chipLabel(draftTo, 'End date')}
                </button>
              </div>

              <div className="cal-header">
                <button
                  type="button"
                  className="cal-nav"
                  aria-label="Previous month"
                  onClick={() => setView((current) => shiftMonth(current.year, current.month, -1))}
                >
                  <ChevronLeft size={16} />
                </button>
                <div className="cal-caption">
                  <div className="cal-caption-item">
                    <button
                      type="button"
                      className="cal-caption-btn"
                      aria-haspopup="listbox"
                      aria-expanded={openMenu === 'month'}
                      onClick={() => setOpenMenu((current) => (current === 'month' ? null : 'month'))}
                    >
                      {MONTHS[view.month]}
                      <ChevronDown size={14} aria-hidden="true" />
                    </button>
                    {openMenu === 'month' ? (
                      <ul className="cal-caption-menu" role="listbox" aria-label="Month">
                        {MONTHS.map((name, month) => (
                          <li key={name}>
                            <button
                              type="button"
                              role="option"
                              aria-selected={month === view.month}
                              className={cx('cal-caption-option', month === view.month && 'is-selected')}
                              onClick={() => {
                                setView((current) => ({ ...current, month }))
                                setOpenMenu(null)
                              }}
                            >
                              {name}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  <div className="cal-caption-item">
                    <button
                      type="button"
                      className="cal-caption-btn"
                      aria-haspopup="listbox"
                      aria-expanded={openMenu === 'year'}
                      onClick={() => setOpenMenu((current) => (current === 'year' ? null : 'year'))}
                    >
                      {view.year}
                      <ChevronDown size={14} aria-hidden="true" />
                    </button>
                    {openMenu === 'year' ? (
                      <ul className="cal-caption-menu" role="listbox" aria-label="Year">
                        {years.map((year) => (
                          <li key={year}>
                            <button
                              type="button"
                              role="option"
                              aria-selected={year === view.year}
                              className={cx('cal-caption-option', year === view.year && 'is-selected')}
                              onClick={() => {
                                setView((current) => ({ ...current, year }))
                                setOpenMenu(null)
                              }}
                            >
                              {year}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  className="cal-nav"
                  aria-label="Next month"
                  onClick={() => setView((current) => shiftMonth(current.year, current.month, 1))}
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              <div className="cal-weekdays">
                {WEEKDAYS.map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>

              <div className="cal-grid" onMouseLeave={() => setHoverKey(null)} onKeyDown={onGridKeyDown}>
                {cells.map((cell, index) => {
                  const time = cell.date.getTime()
                  const inRange =
                    preview.start != null &&
                    preview.end != null &&
                    time >= preview.start &&
                    time <= preview.end
                  const isStart = preview.start != null && time === preview.start
                  const isEnd = preview.end != null && time === preview.end
                  const isSingle = isStart && isEnd
                  const weekStart = cell.weekday === 0
                  const weekEnd = cell.weekday === 6
                  const isActive =
                    (activeChip === 'from' && draftFrom === cell.key) ||
                    (activeChip === 'to' && draftTo === cell.key)

                  return (
                    <button
                      key={`${cell.key}-${index}`}
                      type="button"
                      className={cx(
                        'cal-day',
                        cell.outside && 'is-outside',
                        inRange && 'is-in-range',
                        isStart && 'is-range-start',
                        isEnd && 'is-range-end',
                        isSingle && 'is-range-single',
                        (weekStart || isStart) && inRange && 'is-pill-start',
                        (weekEnd || isEnd) && inRange && 'is-pill-end',
                        isActive && 'is-active-day',
                      )}
                      data-cal-day={cell.key}
                      tabIndex={cell.key === focusKey ? 0 : -1}
                      aria-label={formatDateChip(time)}
                      aria-pressed={isStart || isEnd}
                      onMouseEnter={() => setHoverKey(cell.key)}
                      onFocus={() => setFocusKey(cell.key)}
                      onClick={() => selectDay(cell.key)}
                    >
                      <span className="cal-day-bg" />
                      <span className="cal-day-num">{cell.date.getDate()}</span>
                    </button>
                  )
                })}
              </div>

              <div className="cal-footer">
                <button type="button" className="cal-apply" onClick={apply}>
                  Apply
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
