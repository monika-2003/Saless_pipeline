import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { pipelineApi } from '../api/pipelineApi.js'
import { ToastProvider } from '../components/common/Toast.jsx'
import { generatePipeline } from '../data/mockData.js'
import { fixturePipeline, makeDeal, QUIET_SIMULATION } from '../test/fixtures.js'
import { ACTIVITY_TYPES } from '../utils/activity.js'
import { flushDealChanges } from '../utils/pipelinePersist.js'
import { PipelineProvider } from './PipelineProvider.jsx'
import { usePipeline } from './pipelineContext.js'

vi.mock('../data/mockData.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    generatePipeline: vi.fn(),
  }
})

function wrapper({ children }) {
  return (
    <ToastProvider>
      <PipelineProvider>{children}</PipelineProvider>
    </ToastProvider>
  )
}

function seedPipeline(deals) {
  generatePipeline.mockReturnValue(fixturePipeline(deals))
}

async function renderPipeline() {
  const hook = renderHook(() => usePipeline(), { wrapper })
  await waitFor(() => expect(hook.result.current.ready).toBe(true))
  act(() => {
    hook.result.current.updateSimulation(QUIET_SIMULATION)
  })
  return hook
}

describe('PipelineProvider concurrent moves', () => {
  beforeEach(() => {
    seedPipeline([makeDeal()])
  })

  it('keeps the current stage and records a conflict when a teammate saves first', async () => {
    const { result } = await renderPipeline()

    act(() => {
      result.current.updateSimulation({
        ...QUIET_SIMULATION,
        latencyMin: 40,
        latencyMax: 40,
      })
    })

    let movePromise
    act(() => {
      movePromise = result.current.moveDeal('deal-1', 'negotiation', { undoable: true })
    })

    expect(result.current.getDeal('deal-1').stage).toBe('negotiation')
    expect(result.current.stageIds.negotiation).toContain('deal-1')
    expect(result.current.overlays.pending['deal-1']).toBeTruthy()

    pipelineApi.teammateMove('deal-1', 'lost', 'Rahul Mehta', { silent: true })

    let apiResult
    await act(async () => {
      apiResult = await movePromise
    })

    expect(apiResult).toMatchObject({ ok: false, error: 'CONFLICT' })
    await waitFor(() => {
      expect(result.current.overlays.conflicts['deal-1']).toBeTruthy()
    })

    const conflict = result.current.overlays.conflicts['deal-1']
    expect(result.current.getDeal('deal-1').stage).toBe('proposal_sent')
    expect(result.current.stageIds.proposal_sent).toContain('deal-1')
    expect(conflict.localStage).toBe('negotiation')
    expect(conflict.fromStage).toBe('proposal_sent')
    expect(conflict.serverDeal.stage).toBe('lost')
    expect(conflict.serverDeal.version).toBe(2)
    expect(conflict.actorName).toBe('Rahul Mehta')
    expect(result.current.overlays.pending['deal-1']).toBeUndefined()
    expect(result.current.activityEvents[0].type).toBe(ACTIVITY_TYPES.CONFLICT_DETECTED)
  })

  it('Keep mine force-writes the local stage and clears the conflict', async () => {
    const { result } = await renderPipeline()
    act(() => {
      result.current.updateSimulation({
        ...QUIET_SIMULATION,
        latencyMin: 40,
        latencyMax: 40,
      })
    })

    let movePromise
    act(() => {
      movePromise = result.current.moveDeal('deal-1', 'negotiation')
    })
    pipelineApi.teammateMove('deal-1', 'lost', 'Rahul Mehta', { silent: true })
    await act(async () => {
      await movePromise
    })
    await waitFor(() => {
      expect(result.current.overlays.conflicts['deal-1']).toBeTruthy()
    })

    await act(async () => {
      await result.current.resolveConflict('deal-1', 'mine')
    })

    await waitFor(() => {
      expect(result.current.overlays.conflicts['deal-1']).toBeUndefined()
    })
    expect(result.current.getDeal('deal-1').stage).toBe('negotiation')
    expect(result.current.getDeal('deal-1').version).toBeGreaterThan(2)
    expect(pipelineApi.getDeal('deal-1').stage).toBe('negotiation')
    expect(result.current.activityEvents[0].type).toBe(ACTIVITY_TYPES.CONFLICT_RESOLVED)
    expect(result.current.activityEvents[0].metadata.choice).toBe('mine')
  })

  it('Use latest restores the teammate snapshot and clears the conflict', async () => {
    const { result } = await renderPipeline()
    act(() => {
      result.current.updateSimulation({
        ...QUIET_SIMULATION,
        latencyMin: 40,
        latencyMax: 40,
      })
    })

    let movePromise
    act(() => {
      movePromise = result.current.moveDeal('deal-1', 'negotiation')
    })
    pipelineApi.teammateMove('deal-1', 'won', 'Ananya Iyer', { silent: true })
    await act(async () => {
      await movePromise
    })
    await waitFor(() => {
      expect(result.current.overlays.conflicts['deal-1']).toBeTruthy()
    })

    await act(async () => {
      await result.current.resolveConflict('deal-1', 'server')
    })

    expect(result.current.overlays.conflicts['deal-1']).toBeUndefined()
    expect(result.current.getDeal('deal-1').stage).toBe('won')
    expect(result.current.getDeal('deal-1').version).toBe(2)
    expect(pipelineApi.getDeal('deal-1').stage).toBe('won')
    expect(result.current.stageIds.won).toContain('deal-1')
    expect(result.current.stageIds.negotiation).not.toContain('deal-1')
    expect(result.current.activityEvents[0].metadata.choice).toBe('latest')
  })

  it('succeeds and bumps version when nobody else touches the deal', async () => {
    const { result } = await renderPipeline()

    act(() => {
      result.current.requestMove('deal-1', 'negotiation')
    })

    await waitFor(() => {
      expect(result.current.getDeal('deal-1').stage).toBe('negotiation')
      expect(result.current.getDeal('deal-1').version).toBe(2)
    })
    expect(result.current.stageIds.negotiation).toContain('deal-1')
    expect(result.current.stageIds.proposal_sent).not.toContain('deal-1')
    expect(result.current.overlays.conflicts['deal-1']).toBeUndefined()
    expect(result.current.overlays.failed['deal-1']).toBeUndefined()
    expect(result.current.activityEvents[0].type).toBe(ACTIVITY_TYPES.DEAL_MOVED)
  })

  it('blocks a backward stage move without calling the API', async () => {
    const { result } = await renderPipeline()
    const versionBefore = pipelineApi.getDeal('deal-1').version

    act(() => {
      result.current.requestMove('deal-1', 'contacted')
    })

    expect(result.current.getDeal('deal-1').stage).toBe('proposal_sent')
    expect(pipelineApi.getDeal('deal-1').version).toBe(versionBefore)
    expect(result.current.overlays.pending['deal-1']).toBeUndefined()
  })

  it('moves the card back to the previous stage and marks failed when the API returns NETWORK', async () => {
    const { result } = await renderPipeline()
    act(() => {
      result.current.updateSimulation({ ...QUIET_SIMULATION, failureRate: 1 })
    })

    await act(async () => {
      await result.current.moveDeal('deal-1', 'negotiation')
    })

    expect(result.current.getDeal('deal-1').stage).toBe('proposal_sent')
    expect(result.current.stageIds.proposal_sent).toContain('deal-1')
    expect(result.current.stageIds.negotiation).not.toContain('deal-1')
    expect(result.current.overlays.failed['deal-1']).toMatchObject({
      fromStage: 'proposal_sent',
      toStage: 'negotiation',
    })
    expect(pipelineApi.getDeal('deal-1').stage).toBe('proposal_sent')
  })

  it('retries a failed save after the network recovers', async () => {
    const { result } = await renderPipeline()
    act(() => {
      result.current.updateSimulation({ ...QUIET_SIMULATION, failureRate: 1 })
    })
    await act(async () => {
      await result.current.moveDeal('deal-1', 'negotiation')
    })
    expect(result.current.overlays.failed['deal-1']).toBeTruthy()

    act(() => {
      result.current.updateSimulation(QUIET_SIMULATION)
    })
    await act(async () => {
      await result.current.retryDeal('deal-1')
    })

    await waitFor(() => {
      expect(result.current.overlays.failed['deal-1']).toBeUndefined()
      expect(result.current.getDeal('deal-1').version).toBe(2)
    })
    expect(pipelineApi.getDeal('deal-1').stage).toBe('negotiation')
  })

  it('discardFailed rolls the card back to the previous stage', async () => {
    const { result } = await renderPipeline()
    act(() => {
      result.current.updateSimulation({ ...QUIET_SIMULATION, failureRate: 1 })
    })
    await act(async () => {
      await result.current.moveDeal('deal-1', 'negotiation')
    })

    act(() => {
      result.current.discardFailed('deal-1')
    })

    expect(result.current.getDeal('deal-1').stage).toBe('proposal_sent')
    expect(result.current.overlays.failed['deal-1']).toBeUndefined()
    expect(result.current.stageIds.proposal_sent).toContain('deal-1')
  })

  it('simulateConflict waits for the next move before showing a Keep mine / Use latest overlay', async () => {
    const { result } = await renderPipeline()

    act(() => {
      result.current.selectMany(['deal-1'])
      result.current.simulateConflict(['deal-1'])
    })

    expect(result.current.overlays.conflicts['deal-1']).toBeUndefined()
    expect(result.current.getDeal('deal-1').stage).toBe('proposal_sent')
    expect(result.current.selectedIds.has('deal-1')).toBe(true)

    await act(async () => {
      await result.current.moveDeal('deal-1', 'negotiation')
    })

    const conflict = result.current.overlays.conflicts['deal-1']
    expect(conflict).toBeTruthy()
    expect(conflict.localStage).toBe('negotiation')
    expect(conflict.fromStage).toBe('proposal_sent')
    expect(['won', 'lost']).toContain(conflict.serverDeal.stage)
    expect(conflict.actorName).toBeTruthy()
    expect(conflict.actorName).not.toBe('A teammate')
    expect(result.current.getDeal('deal-1').stage).toBe('proposal_sent')
    expect(result.current.stageIds.proposal_sent).toContain('deal-1')
    expect(result.current.stageIds.negotiation).not.toContain('deal-1')
  })

  it('does not simulate a conflict when no deals are selected', async () => {
    const { result } = await renderPipeline()

    act(() => {
      result.current.simulateConflict([])
    })

    expect(result.current.overlays.conflicts['deal-1']).toBeUndefined()
    expect(pipelineApi.getQueuedSimulation().conflicts).toEqual([])
  })

  it('arms a conflict on the opened deal when nothing is selected', async () => {
    const { result } = await renderPipeline()

    act(() => {
      result.current.openDeal('deal-1')
    })
    act(() => {
      result.current.simulateConflict()
    })

    expect(pipelineApi.getQueuedSimulation().conflicts).toEqual(['deal-1'])
    expect(result.current.overlays.conflicts['deal-1']).toBeUndefined()
    expect(result.current.getDeal('deal-1').stage).toBe('proposal_sent')

    await act(async () => {
      await result.current.moveDeal('deal-1', 'negotiation')
    })

    expect(result.current.overlays.conflicts['deal-1']).toBeTruthy()
    expect(result.current.getDeal('deal-1').stage).toBe('proposal_sent')
  })
})

describe('PipelineProvider selected simulation', () => {
  beforeEach(() => {
    seedPipeline([
      makeDeal({ id: 'deal-1', stage: 'proposal_sent' }),
      makeDeal({ id: 'deal-2', company: 'Nimbus Systems', stage: 'contacted' }),
      makeDeal({ id: 'deal-3', company: 'Harbor Digital', stage: 'demo_done' }),
    ])
  })

  it('simulates API failure only on the selected deals during the next move', async () => {
    const { result } = await renderPipeline()

    act(() => {
      result.current.selectMany(['deal-1', 'deal-3'])
      result.current.simulateFailure(['deal-1', 'deal-3'])
    })

    expect(result.current.overlays.failed['deal-1']).toBeUndefined()
    expect(result.current.overlays.failed['deal-3']).toBeUndefined()
    expect(result.current.selectedIds.has('deal-1')).toBe(true)
    expect(result.current.selectedIds.has('deal-3')).toBe(true)

    await act(async () => {
      await result.current.bulkMove(['deal-1', 'deal-2', 'deal-3'], 'negotiation')
    })

    expect(result.current.getDeal('deal-1').stage).toBe('proposal_sent')
    expect(result.current.getDeal('deal-3').stage).toBe('demo_done')
    expect(result.current.getDeal('deal-2').stage).toBe('negotiation')
    expect(result.current.overlays.failed['deal-1']).toBeTruthy()
    expect(result.current.overlays.failed['deal-3']).toBeTruthy()
    expect(result.current.overlays.failed['deal-2']).toBeUndefined()
  })
})

describe('PipelineProvider bulk partial failure', () => {
  beforeEach(() => {
    seedPipeline([
      makeDeal({ id: 'deal-1', stage: 'proposal_sent' }),
      makeDeal({ id: 'deal-2', company: 'Nimbus Systems', stage: 'proposal_sent' }),
      makeDeal({ id: 'deal-3', company: 'Harbor Digital', stage: 'proposal_sent' }),
    ])
  })

  it('moves every selected deal when the API succeeds', async () => {
    const { result } = await renderPipeline()

    await act(async () => {
      await result.current.bulkMove(['deal-1', 'deal-2', 'deal-3'], 'negotiation')
    })

    await waitFor(() => {
      expect(result.current.bulkJob?.running).toBe(false)
    })
    expect(result.current.getDeal('deal-1').stage).toBe('negotiation')
    expect(result.current.getDeal('deal-2').stage).toBe('negotiation')
    expect(result.current.getDeal('deal-3').stage).toBe('negotiation')
    expect(result.current.stageIds.negotiation).toEqual(expect.arrayContaining(['deal-1', 'deal-2', 'deal-3']))
    expect(result.current.stageIds.negotiation).toHaveLength(3)
    expect(result.current.stageIds.proposal_sent).toEqual([])
    expect(result.current.bulkJob.failedIds).toEqual([])
  })

  it('moves bulk lost deals into the Lost column so the count increases', async () => {
    const { result } = await renderPipeline()

    await act(async () => {
      await result.current.bulkMove(['deal-1', 'deal-2', 'deal-3'], 'lost')
    })

    await waitFor(() => {
      expect(result.current.bulkJob?.running).toBe(false)
    })
    expect(result.current.stageIds.lost).toEqual(expect.arrayContaining(['deal-1', 'deal-2', 'deal-3']))
    expect(result.current.stageIds.lost).toHaveLength(3)
    expect(result.current.stageIds.proposal_sent).toEqual([])
    expect(result.current.getDeal('deal-1').stage).toBe('lost')
    expect(result.current.visibleStageIds.lost).toEqual(expect.arrayContaining(['deal-1', 'deal-2', 'deal-3']))
    expect(result.current.visibleStageIds.lost).toHaveLength(3)
    expect(result.current.visibleStageIds.proposal_sent).toEqual([])
  })

  it('returns failed deals to the previous stage and keeps saved deals on the next stage', async () => {
    const { result } = await renderPipeline()
    const original = pipelineApi.moveDeal.bind(pipelineApi)
    vi.spyOn(pipelineApi, 'moveDeal').mockImplementation(async (payload) => {
      if (payload.id === 'deal-2') return { ok: false, error: 'NETWORK' }
      return original(payload)
    })

    await act(async () => {
      await result.current.bulkMove(['deal-1', 'deal-2', 'deal-3'], 'negotiation')
    })

    expect(result.current.getDeal('deal-2').stage).toBe('proposal_sent')
    expect(result.current.stageIds.proposal_sent).toEqual(['deal-2'])
    expect(result.current.stageIds.negotiation).toEqual(expect.arrayContaining(['deal-1', 'deal-3']))
    expect(result.current.stageIds.negotiation).toHaveLength(2)
    expect(result.current.overlays.failed['deal-2']).toBeTruthy()
    expect(result.current.overlays.failed['deal-1']).toBeUndefined()
    expect(pipelineApi.getDeal('deal-1').stage).toBe('negotiation')
    expect(pipelineApi.getDeal('deal-2').stage).toBe('proposal_sent')
    expect(result.current.bulkJob.failedIds).toEqual(['deal-2'])
  })

  it('retries only the selected deals that have a failed save', async () => {
    const { result } = await renderPipeline()
    const original = pipelineApi.moveDeal.bind(pipelineApi)
    vi.spyOn(pipelineApi, 'moveDeal').mockImplementation(async (payload) => {
      if (payload.id === 'deal-2') return { ok: false, error: 'NETWORK' }
      return original(payload)
    })

    await act(async () => {
      await result.current.bulkMove(['deal-1', 'deal-2', 'deal-3'], 'negotiation')
    })
    expect(result.current.overlays.failed['deal-2']).toBeTruthy()

    pipelineApi.moveDeal.mockRestore()

    await act(async () => {
      await result.current.retryFailedDeals(['deal-1', 'deal-2', 'deal-3'])
    })

    await waitFor(() => {
      expect(result.current.overlays.failed['deal-2']).toBeUndefined()
      expect(result.current.bulkJob?.running).toBe(false)
    })
    expect(pipelineApi.getDeal('deal-2').stage).toBe('negotiation')
  })
})

describe('PipelineProvider selection vs filters', () => {
  beforeEach(() => {
    seedPipeline([
      makeDeal({ id: 'deal-1', owner: 'Priya Sharma', stage: 'demo_done' }),
      makeDeal({ id: 'deal-2', owner: 'Neha Patel', company: 'Nimbus Systems', stage: 'demo_done' }),
      makeDeal({ id: 'deal-3', owner: 'Rahul Mehta', company: 'Harbor Digital', stage: 'demo_done' }),
    ])
  })

  it('drops selected deals that no longer match the owner filter', async () => {
    const { result } = await renderPipeline()

    act(() => {
      result.current.selectMany(['deal-1', 'deal-2', 'deal-3'])
    })
    expect(result.current.selectedIds.size).toBe(3)

    act(() => {
      result.current.setFilterDraft((current) => ({ ...current, owner: ['Neha Patel'] }))
    })

    await waitFor(() => {
      expect([...result.current.selectedIds]).toEqual(['deal-2'])
    })
    expect(result.current.visibleStageIds.demo_done).toEqual(['deal-2'])
  })
})

describe('PipelineProvider persistence', () => {
  beforeEach(() => {
    seedPipeline([makeDeal({ id: 'deal-1', stage: 'proposal_sent', version: 1 })])
  })

  it('reapplies saved moves when the provider remounts', async () => {
    const first = await renderPipeline()

    await act(async () => {
      await first.result.current.moveDeal('deal-1', 'negotiation')
    })
    expect(first.result.current.getDeal('deal-1').stage).toBe('negotiation')
    act(() => {
      flushDealChanges()
    })
    first.unmount()

    const second = await renderPipeline()
    expect(second.result.current.getDeal('deal-1').stage).toBe('negotiation')
    expect(second.result.current.stageIds.negotiation).toContain('deal-1')
    expect(second.result.current.stageIds.proposal_sent).not.toContain('deal-1')
  })

  it('restores the seeded pipeline when demo data is reset', async () => {
    const { result } = await renderPipeline()

    await act(async () => {
      await result.current.moveDeal('deal-1', 'lost')
    })
    expect(result.current.getDeal('deal-1').stage).toBe('lost')

    act(() => {
      result.current.resetDemoData()
    })

    expect(result.current.getDeal('deal-1').stage).toBe('proposal_sent')
    expect(result.current.stageIds.proposal_sent).toContain('deal-1')
    expect(result.current.stageIds.lost || []).not.toContain('deal-1')
  })
})
