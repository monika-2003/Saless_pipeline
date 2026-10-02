import { describe, expect, it } from 'vitest'
import { emptyOverlays, makeDeal } from '../test/fixtures.js'
import {
  formatAttentionWhy,
  getAttentionReason,
  groupAttentionIds,
} from './attention.js'

const DAY = 24 * 60 * 60 * 1000
const now = Date.now()

describe('getAttentionReason', () => {
  it('ranks a live conflict above a failed save', () => {
    const deal = makeDeal()
    const overlays = emptyOverlays({
      conflicts: { [deal.id]: { localStage: 'negotiation' } },
      failed: { [deal.id]: { toStage: 'negotiation' } },
    })
    expect(getAttentionReason(deal, overlays, now)).toBe('conflict')
  })

  it('ranks a failed save above date-based reasons', () => {
    const deal = makeDeal({ expectedCloseDate: now - 5 * DAY })
    const overlays = emptyOverlays({
      failed: { [deal.id]: { toStage: 'negotiation' } },
    })
    expect(getAttentionReason(deal, overlays, now)).toBe('failed')
  })

  it('ignores closed deals unless they have an overlay', () => {
    const won = makeDeal({ stage: 'won', expectedCloseDate: now - DAY })
    expect(getAttentionReason(won, emptyOverlays(), now)).toBeNull()
    expect(
      getAttentionReason(
        won,
        emptyOverlays({ conflicts: { [won.id]: { localStage: 'won' } } }),
        now,
      ),
    ).toBe('conflict')
  })

  it('only flags overdue / closing soon / stale for high-priority or ₹10L+ deals', () => {
    const overdueLow = makeDeal({
      priority: 'low',
      value: 80_000,
      expectedCloseDate: now - DAY,
    })
    expect(getAttentionReason(overdueLow, emptyOverlays(), now)).toBeNull()

    const overdueHigh = makeDeal({
      priority: 'high',
      expectedCloseDate: now - DAY,
    })
    expect(getAttentionReason(overdueHigh, emptyOverlays(), now)).toBe('overdue')
  })

  it('classifies closing soon, stale, and leftover high-value deals', () => {
    expect(
      getAttentionReason(
        makeDeal({ expectedCloseDate: now + 3 * DAY, lastContactedAt: now }),
        emptyOverlays(),
        now,
      ),
    ).toBe('closingSoon')

    expect(
      getAttentionReason(
        makeDeal({
          expectedCloseDate: now + 40 * DAY,
          lastContactedAt: now - 20 * DAY,
        }),
        emptyOverlays(),
        now,
      ),
    ).toBe('stale')

    expect(
      getAttentionReason(
        makeDeal({
          expectedCloseDate: now + 40 * DAY,
          lastContactedAt: now,
          value: 1_200_000,
          priority: 'high',
        }),
        emptyOverlays(),
        now,
      ),
    ).toBe('highValue')
  })
})

describe('formatAttentionWhy and grouping', () => {
  it('explains conflict and failed overlays', () => {
    expect(formatAttentionWhy(makeDeal(), 'conflict')).toMatch(/teammate/i)
    expect(formatAttentionWhy(makeDeal(), 'failed')).toMatch(/did not reach the server/i)
  })

  it('buckets ids by exclusive attention category', () => {
    const conflict = makeDeal({ id: 'c1' })
    const failed = makeDeal({ id: 'f1' })
    const overdue = makeDeal({ id: 'o1', expectedCloseDate: now - DAY })
    const deals = { c1: conflict, f1: failed, o1: overdue }
    const overlays = emptyOverlays({
      conflicts: { c1: { localStage: 'negotiation' } },
      failed: { f1: { toStage: 'negotiation' } },
    })

    const grouped = groupAttentionIds(['c1', 'f1', 'o1'], (id) => deals[id], overlays)
    expect(grouped.conflict).toEqual(['c1'])
    expect(grouped.failed).toEqual(['f1'])
    expect(grouped.overdue).toEqual(['o1'])
  })
})
