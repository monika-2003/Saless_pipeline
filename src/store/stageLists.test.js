import { describe, expect, it } from 'vitest'
import { EMPTY_STAGE_IDS } from '../test/fixtures.js'
import {
  applyBulkMoveToStageIds,
  applyMoveToStageIds,
  createVisibleIdSet,
  emptyOverlays,
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
