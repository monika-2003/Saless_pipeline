import { describe, expect, it } from 'vitest'
import { EMPTY_STAGE_IDS } from '../test/fixtures.js'
import { STAGES } from '../data/constants.js'
import {
  applyBulkMoveToStageIds,
  applyGroupedStageMoves,
  applyMoveToStageIds,
  createVisibleIdSet,
  emptyOverlays,
  groupIdsByStage,
  intersectSelectedIds,
  placeDealInStage,
} from './stageLists.js'

describe('applyMoveToStageIds', () => {
  it('removes the deal from the source column and pins it to the top of the target', () => {
    const stageIds = {
      ...EMPTY_STAGE_IDS,
      proposal_sent: ['deal-a', 'deal-1', 'deal-b'],
      negotiation: ['deal-c'],
    }

    const next = applyMoveToStageIds(stageIds, 'deal-1', 'proposal_sent', 'negotiation')

    expect(next.proposal_sent).toEqual(['deal-a', 'deal-b'])
    expect(next.negotiation).toEqual(['deal-1', 'deal-c'])
    expect(stageIds.proposal_sent).toEqual(['deal-a', 'deal-1', 'deal-b'])
  })

  it('returns the same object when the stage does not change', () => {
    const stageIds = { ...EMPTY_STAGE_IDS, proposal_sent: ['deal-1'] }
    expect(applyMoveToStageIds(stageIds, 'deal-1', 'proposal_sent', 'proposal_sent')).toBe(stageIds)
  })
})

describe('applyBulkMoveToStageIds', () => {
  it('moves every selected id onto the target stage in the given order', () => {
    const stageIds = {
      ...EMPTY_STAGE_IDS,
      proposal_sent: ['deal-1', 'deal-2'],
      negotiation: ['deal-3'],
      contacted: ['deal-4'],
    }

    const next = applyBulkMoveToStageIds(stageIds, ['deal-1', 'deal-4'], 'lost')

    expect(next.lost).toEqual(['deal-1', 'deal-4'])
    expect(next.proposal_sent).toEqual(['deal-2'])
    expect(next.contacted).toEqual([])
    expect(next.negotiation).toEqual(['deal-3'])
  })
})

describe('applyGroupedStageMoves', () => {
  it('moves many ids in one pass per stage array', () => {
    const ids = Array.from({ length: 10_000 }, (_, index) => `deal-${index}`)
    const rest = Array.from({ length: 40_000 }, (_, index) => `fill-${index}`)
    let filterCalls = 0
    const source = new Proxy([...ids, ...rest], {
      get(target, prop, receiver) {
        if (prop === 'filter') {
          return (...args) => {
            filterCalls += 1
            return Array.prototype.filter.apply(target, args)
          }
        }
        return Reflect.get(target, prop, receiver)
      },
    })
    const stageIds = {
      ...EMPTY_STAGE_IDS,
      new_lead: source,
    }

    const next = applyGroupedStageMoves(stageIds, { negotiation: ids })

    expect(filterCalls).toBeLessThanOrEqual(STAGES.length)
    expect(next.negotiation).toHaveLength(10_000)
    expect(next.new_lead).toHaveLength(40_000)
    expect(next.negotiation[0]).toBe('deal-0')
    expect(next.new_lead).not.toContain('deal-0')
  })

  it('returns the same object when every id is already on its destination', () => {
    const stageIds = {
      ...EMPTY_STAGE_IDS,
      negotiation: ['deal-1', 'deal-2'],
    }
    expect(applyGroupedStageMoves(stageIds, { negotiation: ['deal-1', 'deal-2'] })).toBe(stageIds)
  })

  it('groups ids by stage without nested scans', () => {
    const grouped = groupIdsByStage(['a', 'b', 'c'], (id) => (id === 'b' ? 'lost' : 'won'))
    expect(grouped.won).toEqual(['a', 'c'])
    expect(grouped.lost).toEqual(['b'])
  })
})

describe('placeDealInStage', () => {
  it('moves a deal that is still listed in another column', () => {
    const stageIds = {
      ...EMPTY_STAGE_IDS,
      contacted: ['deal-1', 'deal-2'],
      lost: ['deal-3'],
    }

    const next = placeDealInStage(stageIds, 'deal-1', 'lost')

    expect(next.contacted).toEqual(['deal-2'])
    expect(next.lost).toEqual(['deal-1', 'deal-3'])
    expect(placeDealInStage(next, 'deal-1', 'lost')).toBe(next)
  })
})

describe('emptyOverlays', () => {
  it('starts with empty lookup objects', () => {
    const overlays = emptyOverlays()
    expect(overlays.pending).toEqual({})
    expect(overlays.failed).toEqual({})
    expect(overlays.conflicts).toEqual({})
    expect(overlays.saved).toEqual({})
  })
})

describe('visible selection', () => {
  it('builds a set from flattened stage columns or a list view', () => {
    const fromColumns = createVisibleIdSet({
      ...EMPTY_STAGE_IDS,
      demo_done: ['deal-1', 'deal-2'],
      negotiation: ['deal-3'],
    }, null)
    expect([...fromColumns]).toEqual(['deal-1', 'deal-2', 'deal-3'])

    const fromList = createVisibleIdSet(null, ['deal-9'])
    expect([...fromList]).toEqual(['deal-9'])
  })

  it('drops selected ids that are no longer visible', () => {
    const selected = new Set(['deal-1', 'deal-2', 'deal-3'])
    const visible = new Set(['deal-2'])
    expect([...intersectSelectedIds(selected, visible)]).toEqual(['deal-2'])
    expect(intersectSelectedIds(selected, selected)).toBe(selected)
  })
})
