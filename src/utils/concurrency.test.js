import { describe, expect, it } from 'vitest'
import { runPool } from './concurrency.js'

describe('runPool', () => {
  it('does not run more workers than the concurrency cap', async () => {
    let inflight = 0
    let peak = 0
    const items = Array.from({ length: 20 }, (_, index) => index)

    await runPool(
      items,
      async () => {
        inflight += 1
        peak = Math.max(peak, inflight)
        await new Promise((resolve) => setTimeout(resolve, 15))
        inflight -= 1
        return { ok: true }
      },
      10,
    )

    expect(peak).toBeLessThanOrEqual(10)
    expect(peak).toBe(10)
  })

  it('collects falsey worker results and thrown errors', async () => {
    const failed = await runPool(
      ['ok', 'fail', 'throw'],
      async (item) => {
        if (item === 'fail') return { ok: false, error: 'NETWORK' }
        if (item === 'throw') throw new Error('boom')
        return { ok: true }
      },
      2,
    )

    expect(failed).toHaveLength(2)
    expect(failed.map((entry) => entry.item)).toEqual(['fail', 'throw'])
    expect(failed[1].result.error).toBe('boom')
  })

  it('reports progress after each item finishes', async () => {
    const ticks = []
    await runPool(
      [1, 2, 3],
      async (item) => (item === 2 ? { ok: false } : { ok: true }),
      1,
      (completed, failedCount) => ticks.push({ completed, failedCount }),
    )

    expect(ticks).toEqual([
      { completed: 1, failedCount: 0 },
      { completed: 2, failedCount: 1 },
      { completed: 3, failedCount: 1 },
    ])
  })
})
