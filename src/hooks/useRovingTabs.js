import { useEffect } from 'react'

export function useRovingTabs(tablistRef, ids, selectedId, onSelect) {
  useEffect(() => {
    if (!tablistRef.current || !selectedId) return
    const active = tablistRef.current.querySelector(`[role="tab"][data-tab-id="${selectedId}"]`)
    if (active && tablistRef.current.contains(document.activeElement)) {
      active.focus()
    }
  }, [selectedId, tablistRef])

  function onKeyDown(event) {
    if (!ids.length) return
    const current = ids.indexOf(selectedId)
    if (current < 0) return
    let nextIndex = current
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (current + 1) % ids.length
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (current - 1 + ids.length) % ids.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = ids.length - 1
    else return
    event.preventDefault()
    onSelect(ids[nextIndex])
  }

  return { onKeyDown, tabIndexFor: (id) => (id === selectedId ? 0 : -1) }
}
