import '@testing-library/jest-dom/vitest'

if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() { return false },
  })
}
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { resetOverlayStack } from '../utils/overlayStack.js'
import { resetPersistedDeals } from '../utils/pipelinePersist.js'

afterEach(() => {
  cleanup()
  resetOverlayStack()
  resetPersistedDeals()
  sessionStorage.clear()
  localStorage.clear()
})
