import { useEffect, useRef } from 'react'
import { getInitialFocus, setSiblingsInert, trapTab } from '../utils/focus.js'
import { registerOverlay } from '../utils/overlayStack.js'

export function useFocusTrap(containerRef, { enabled = true, onClose, restore = true } = {}) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!enabled) return undefined
    const node = containerRef.current
    if (!node) return undefined

    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (!node.hasAttribute('tabindex')) node.tabIndex = -1
    const releaseInert = setSiblingsInert(node)
    const unregister = registerOverlay(() => onCloseRef.current?.())

    const frame = requestAnimationFrame(() => {
      getInitialFocus(node)?.focus({ preventScroll: true })
    })

    function onKey(event) {
      trapTab(event, containerRef.current)
    }

    node.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(frame)
      node.removeEventListener('keydown', onKey)
      unregister()
      releaseInert()
      if (restore && previous?.isConnected) previous.focus({ preventScroll: true })
    }
  }, [containerRef, enabled, restore])
}
