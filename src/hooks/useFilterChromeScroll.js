import { useEffect, useLayoutEffect, useRef } from 'react'

const INNER_SCROLL = '.stage-body, .deal-table-scroll, .deal-list-wrap'

function innerScroller(target) {
  return target?.closest?.(INNER_SCROLL)
}

export function useFilterChromeScroll(enabled = true) {
  const shellRef = useRef(null)
  const headerRef = useRef(null)
  const tabsRef = useRef(null)
  const actionsRef = useRef(null)

  useLayoutEffect(() => {
    const header = headerRef.current
    const tabs = tabsRef.current
    const actions = actionsRef.current
    if (!enabled || !header) return undefined

    function sync() {
      document.documentElement.style.setProperty('--sticky-header-height', `${header.offsetHeight}px`)
      document.documentElement.style.setProperty('--sticky-tabs-height', `${tabs?.offsetHeight || 0}px`)
      document.documentElement.style.setProperty('--sticky-actions-height', `${actions?.offsetHeight || 0}px`)
    }

    sync()
    const observer = new ResizeObserver(sync)
    observer.observe(header)
    if (tabs) observer.observe(tabs)
    if (actions) observer.observe(actions)
    window.addEventListener('resize', sync)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', sync)
      document.documentElement.style.removeProperty('--sticky-header-height')
      document.documentElement.style.removeProperty('--sticky-tabs-height')
      document.documentElement.style.removeProperty('--sticky-actions-height')
    }
  }, [enabled])

  useEffect(() => {
    const shell = shellRef.current
    if (!enabled || !shell) return undefined

    function chromeMax() {
      return Math.max(0, shell.scrollHeight - shell.clientHeight)
    }

    function onWheel(event) {
      const max = chromeMax()
      if (max <= 1 || event.deltaY === 0) return

      if (event.deltaY > 0 && shell.scrollTop < max - 1) {
        if (!innerScroller(event.target)) return
        event.preventDefault()
        shell.scrollTop = Math.min(max, shell.scrollTop + event.deltaY)
        return
      }

      if (event.deltaY < 0 && shell.scrollTop > 0) {
        const inner = innerScroller(event.target)
        if (inner && inner.scrollTop > 0) return
        event.preventDefault()
        shell.scrollTop = Math.max(0, shell.scrollTop + event.deltaY)
      }
    }

    let touchY = 0
    function onTouchStart(event) {
      touchY = event.touches[0]?.clientY ?? 0
    }

    function onTouchMove(event) {
      const max = chromeMax()
      const point = event.touches[0]
      if (max <= 1 || !point) return
      const delta = touchY - point.clientY
      touchY = point.clientY
      if (delta === 0) return

      if (delta > 0 && shell.scrollTop < max - 1) {
        if (!innerScroller(event.target)) return
        event.preventDefault()
        shell.scrollTop = Math.min(max, shell.scrollTop + delta)
        return
      }

      if (delta < 0 && shell.scrollTop > 0) {
        const inner = innerScroller(event.target)
        if (inner && inner.scrollTop > 0) return
        event.preventDefault()
        shell.scrollTop = Math.max(0, shell.scrollTop + delta)
      }
    }

    shell.addEventListener('wheel', onWheel, { passive: false })
    shell.addEventListener('touchstart', onTouchStart, { passive: true })
    shell.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => {
      shell.removeEventListener('wheel', onWheel)
      shell.removeEventListener('touchstart', onTouchStart)
      shell.removeEventListener('touchmove', onTouchMove)
    }
  }, [enabled])

  return { shellRef, headerRef, tabsRef, actionsRef }
}
