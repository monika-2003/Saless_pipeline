import { afterEach, describe, expect, it } from 'vitest'
import {
  applyDealPatches,
  flushDealChanges,
  loadDealPatches,
  loadSeedNow,
  persistDealChange,
  persistSeedNow,
  PIPELINE_PATCH_KEY,
  resetPersistedDeals,
  unloadDealPatches,
} from './pipelinePersist.js'

afterEach(() => {
  resetPersistedDeals()
  localStorage.clear()
})

describe('pipeline persistence', () => {
  it('round-trips the seed timestamp', () => {
    expect(loadSeedNow()).toBeNull()
    persistSeedNow(1_700_000_000_000)
    expect(loadSeedNow()).toBe(1_700_000_000_000)
  })

  it('stores deal mutations and reapplies them to a fresh seed', () => {
    persistDealChange({
      id: 'deal-1',
      stage: 'lost',
      version: 3,
      probability: 0,
      closedAt: 123,
    })
    flushDealChanges()

    const stored = JSON.parse(localStorage.getItem(PIPELINE_PATCH_KEY))
    expect(stored.d['deal-1']).toEqual(['lost', 3, 0, 123])

    unloadDealPatches()
    const patches = loadDealPatches()
    const dealsById = {
      'deal-1': { id: 'deal-1', stage: 'new_lead', version: 1, probability: 10, closedAt: null },
      'deal-2': { id: 'deal-2', stage: 'contacted', version: 1, probability: 22, closedAt: null },
    }
    const stageIds = applyDealPatches(dealsById, { new_lead: ['deal-1'], contacted: ['deal-2'] }, patches)

    expect(dealsById['deal-1'].stage).toBe('lost')
    expect(dealsById['deal-1'].version).toBe(3)
    expect(stageIds.lost).toEqual(['deal-1'])
    expect(stageIds.new_lead).toEqual([])
    expect(stageIds.contacted).toEqual(['deal-2'])
  })

  it('leaves stage lists alone when nothing was patched', () => {
    const original = { new_lead: ['deal-1'] }
    expect(applyDealPatches({ 'deal-1': { id: 'deal-1', stage: 'new_lead' } }, original, {})).toBe(original)
  })

  it('clears stored mutations on reset', () => {
    persistDealChange({ id: 'deal-1', stage: 'won', version: 2, probability: 100, closedAt: 1 })
    flushDealChanges()
    resetPersistedDeals()
    expect(localStorage.getItem(PIPELINE_PATCH_KEY)).toBeNull()
    expect(loadDealPatches()).toEqual({})
  })
})
