import { describe, expect, it } from 'vitest'
import {
  applyBulkFinishOverlays,
  applyJobFailureOverlay,
  beginBulkPending,
  beginDealPending,
  clearDealPending,
  clearSavedFlags,
  copyOverlays,
  discardFailedOverlay,
  markDealConflict,
  markDealFailed,
  markDealSaved,
} from './pipelineOverlays.js'
import { emptyOverlays } from './stageLists.js'

function overlays(patch = {}) {
  return { ...emptyOverlays(), ...patch }
}

describe('pipelineOverlays', () => {
  it('copies each overlay map', () => {
    const current = overlays({ pending: { a: true } })
    const next = copyOverlays(current)
    next.pending.b = true
    expect(current.pending.b).toBeUndefined()
  })

  it('starts a pending move and clears prior save state', () => {
    const current = overlays({
      failed: { 'deal-1': { toStage: 'lost' } },
      saved: { 'deal-1': true },
    })
    const next = beginDealPending(current, 'deal-1', { toStage: 'negotiation' })
    expect(next.pending['deal-1']).toEqual({ toStage: 'negotiation' })
    expect(next.failed['deal-1']).toBeUndefined()
    expect(next.saved['deal-1']).toBeUndefined()
  })

  it('marks failed, conflict, saved, and discard without mutating the source', () => {
    const current = beginDealPending(overlays(), 'deal-1', { toStage: 'lost' })
    const failed = markDealFailed(current, 'deal-1', { toStage: 'lost' })
    expect(failed.failed['deal-1']).toEqual({ toStage: 'lost' })
    expect(current.failed['deal-1']).toBeUndefined()

    const conflict = markDealConflict(current, 'deal-1', { localStage: 'lost' })
    expect(conflict.conflicts['deal-1'].localStage).toBe('lost')

    const saved = markDealSaved(current, 'deal-1')
    expect(saved.saved['deal-1']).toBe(true)
    expect(clearSavedFlags(saved, ['deal-1']).saved['deal-1']).toBeUndefined()

    expect(discardFailedOverlay(failed, 'deal-1').failed['deal-1']).toBeUndefined()
    expect(clearDealPending(current, 'deal-1').pending['deal-1']).toBeUndefined()
  })

  it('applies bulk pending and finish overlays', () => {
    const jobs = [{ id: 'deal-1', fromStage: 'contacted', toStage: 'demo_done', clientVersion: 1 }]
    const pending = beginBulkPending(overlays({ failed: { 'deal-1': { toStage: 'lost' } } }), jobs)
    expect(pending.pending['deal-1']).toEqual(jobs[0])
    expect(pending.failed['deal-1']).toBeUndefined()

    const next = copyOverlays(pending)
    applyJobFailureOverlay(next, jobs[0], { ok: false, error: 'NETWORK' }, 'demo_done')
    expect(next.failed['deal-1'].toStage).toBe('demo_done')

    const finished = applyBulkFinishOverlays(pending, {
      jobs,
      failed: [],
      succeededIds: ['deal-1'],
      toStage: 'demo_done',
    })
    expect(finished.saved['deal-1']).toBe(true)
    expect(finished.pending['deal-1']).toBeUndefined()
  })
})
