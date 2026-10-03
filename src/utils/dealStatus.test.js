import { describe, expect, it } from 'vitest'
import { formatFailedSave, formatRetryLabel } from './dealStatus.js'

describe('dealStatus', () => {
  it('names the destination stage on failed saves', () => {
    const failed = { fromStage: 'contacted', toStage: 'lost' }
    expect(formatFailedSave(failed)).toBe('Save failed · Lost')
    expect(formatRetryLabel(failed)).toBe('Retry to Lost')
  })

  it('falls back when the destination is missing', () => {
    expect(formatFailedSave(null)).toBe('Save failed')
    expect(formatRetryLabel({})).toBe('Retry')
  })
})
