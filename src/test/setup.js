import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { resetPersistedDeals } from '../utils/pipelinePersist.js'

afterEach(() => {
  cleanup()
  resetPersistedDeals()
  sessionStorage.clear()
  localStorage.clear()
})
