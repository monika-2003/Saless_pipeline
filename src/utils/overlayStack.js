const layers = []
let attached = false

function onDocumentKey(event) {
  if (event.key !== 'Escape') return
  if (event.defaultPrevented) return
  if (event.target?.closest?.('[role="menu"], [role="listbox"], .date-picker, .dropdown-menu')) return
  const close = layers[layers.length - 1]
  if (!close) return
  event.preventDefault()
  event.stopPropagation()
  close()
}

export function registerOverlay(close) {
  layers.push(close)
  if (!attached) {
    document.addEventListener('keydown', onDocumentKey)
    attached = true
  }
  return () => {
    const index = layers.lastIndexOf(close)
    if (index >= 0) layers.splice(index, 1)
    if (!layers.length && attached) {
      document.removeEventListener('keydown', onDocumentKey)
      attached = false
    }
  }
}

export function overlayDepth() {
  return layers.length
}

export function resetOverlayStack() {
  layers.length = 0
  if (attached) {
    document.removeEventListener('keydown', onDocumentKey)
    attached = false
  }
}
