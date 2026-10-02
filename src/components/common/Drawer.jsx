import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { cx } from '../../utils/cx.js'
import { IconButton } from './IconButton.jsx'

const DRAWER_MIN = 360
const DRAWER_MAX = 800
const DRAWER_DEFAULT = 420
const STORAGE_KEY = 'pipeline-drawer-width'

function readStoredWidth() {
  try {
    const value = Number(localStorage.getItem(STORAGE_KEY))
    if (Number.isFinite(value) && value >= DRAWER_MIN && value <= DRAWER_MAX) return value
  } catch {
    /* private mode */
  }
  return DRAWER_DEFAULT
}

function persistWidth(value) {
  try {
    localStorage.setItem(STORAGE_KEY, String(value))
  } catch {
    /* private mode */
  }
}

function clampWidth(value) {
  const max = Math.min(DRAWER_MAX, Math.max(DRAWER_MIN, window.innerWidth - 32))
  return Math.round(Math.min(max, Math.max(DRAWER_MIN, value)))
}

export function Drawer({ title, children, onClose, labelledBy, footer }) {
  const [width, setWidth] = useState(readStoredWidth)
  const [resizing, setResizing] = useState(false)
  const dragRef = useRef(null)

  useEffect(() => {
    function onKey(event) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    document.documentElement.style.setProperty('--drawer-width', `${width}px`)
    return () => document.documentElement.style.removeProperty('--drawer-width')
  }, [width])

  useEffect(() => {
    function onWinResize() {
      setWidth((current) => clampWidth(current))
    }
    window.addEventListener('resize', onWinResize)
    return () => {
      window.removeEventListener('resize', onWinResize)
      document.body.classList.remove('is-drawer-resizing')
    }
  }, [])

  useEffect(() => {
    if (!resizing) return undefined

    function onMove(event) {
      if (!dragRef.current) return
      setWidth(clampWidth(dragRef.current.startWidth + (dragRef.current.startX - event.clientX)))
    }

    function onUp() {
      if (!dragRef.current) return
      dragRef.current = null
      setResizing(false)
      document.body.classList.remove('is-drawer-resizing')
      setWidth((current) => {
        persistWidth(current)
        return current
      })
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [resizing])

  function onResizePointerDown(event) {
    if (event.button !== 0) return
    event.preventDefault()
    dragRef.current = { startX: event.clientX, startWidth: width }
    setResizing(true)
    document.body.classList.add('is-drawer-resizing')
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      /* synthetic events and some browsers cannot capture */
    }
  }

  function onResizeKeyDown(event) {
    const step = event.shiftKey ? 40 : 16
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      setWidth((current) => {
        const next = clampWidth(current + step)
        persistWidth(next)
        return next
      })
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      setWidth((current) => {
        const next = clampWidth(current - step)
        persistWidth(next)
        return next
      })
    }
  }

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside
        className={cx('drawer', resizing && 'is-resizing')}
        style={{ width }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
      >
        <div
          className="drawer-resize"
          role="slider"
          aria-orientation="horizontal"
          aria-label="Deal details width"
          aria-valuemin={DRAWER_MIN}
          aria-valuemax={DRAWER_MAX}
          aria-valuenow={width}
          tabIndex={0}
          onPointerDown={onResizePointerDown}
          onKeyDown={onResizeKeyDown}
        />
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
