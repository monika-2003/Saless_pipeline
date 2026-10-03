export const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function getFocusable(container) {
  if (!container) return []
  return [...container.querySelectorAll(FOCUSABLE_SELECTOR)].filter((node) => {
    if (node.closest('[inert]')) return false
    const style = window.getComputedStyle(node)
    return style.display !== 'none' && style.visibility !== 'hidden'
  })
}

export function getInitialFocus(container) {
  if (!container) return null
  return container.querySelector('[data-autofocus]') || getFocusable(container)[0] || container
}

export function setSiblingsInert(node) {
  const changed = []
  let current = node
  while (current?.parentElement) {
    for (const sibling of current.parentElement.children) {
      if (sibling === current) continue
      if (sibling.hasAttribute('inert')) continue
      if (sibling.classList?.contains('drawer-backdrop')) continue
      if (sibling.classList?.contains('modal-backdrop')) continue
      sibling.setAttribute('inert', '')
      changed.push(sibling)
    }
    if (current.parentElement === document.body) break
    current = current.parentElement
  }
  return () => {
    for (const element of changed) element.removeAttribute('inert')
  }
}

export function trapTab(event, container) {
  if (event.key !== 'Tab' || !container) return
  const items = getFocusable(container)
  if (!items.length) {
    event.preventDefault()
    return
  }
  const first = items[0]
  const last = items[items.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}
