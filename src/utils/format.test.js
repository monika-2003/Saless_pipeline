import { describe, expect, it } from 'vitest'
import { formatSelectedOfTotal } from './format.js'

describe('formatSelectedOfTotal', () => {
  it('shows only the total when nothing is selected', () => {
    expect(formatSelectedOfTotal(0, 200)).toBe('200')
  })

  it('shows selected of total when deals are selected', () => {
    expect(formatSelectedOfTotal(20, 200)).toBe('20 of 200')
  })
})
