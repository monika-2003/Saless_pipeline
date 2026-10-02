import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { pipelineApi } from '../api/pipelineApi.js'
import { ToastProvider } from '../components/common/Toast.jsx'
import { generatePipeline } from '../data/mockData.js'
import { fixturePipeline, makeDeal, QUIET_SIMULATION } from '../test/fixtures.js'
import { ACTIVITY_TYPES } from '../utils/activity.js'
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

  it('keeps the optimistic stage and records a conflict when a teammate saves first', async () => {
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
    expect(result.current.getDeal('deal-1').stage).toBe('negotiation')
    expect(conflict.localStage).toBe('negotiation')
    expect(conflict.fromStage).toBe('proposal_sent')
    expect(conflict.serverDeal.stage).toBe('lost')
    expect(conflict.serverDeal.version).toBe(2)
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

  it('keeps the optimistic card and marks failed when the API returns NETWORK', async () => {
    const { result } = await renderPipeline()
    act(() => {
      result.current.updateSimulation({ ...QUIET_SIMULATION, failureRate: 1 })
    })

    await act(async () => {
      await result.current.moveDeal('deal-1', 'negotiation')
    })

    expect(result.current.getDeal('deal-1').stage).toBe('negotiation')
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

  it('simulateConflict leaves a Keep mine / Use latest overlay', async () => {
    const { result } = await renderPipeline()

    await act(async () => {
      await result.current.simulateConflict()
    })

    const conflict = result.current.overlays.conflicts['deal-1']
    expect(conflict).toBeTruthy()
    expect(conflict.localStage).not.toBe(conflict.serverDeal.stage)
    expect(result.current.getDeal('deal-1').stage).toBe(conflict.localStage)
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
    expect(result.current.bulkJob.failedIds).toEqual([])
  })

  it('keeps optimistic positions and records only the deals that failed', async () => {
    const { result } = await renderPipeline()
    const original = pipelineApi.moveDeal.bind(pipelineApi)
    vi.spyOn(pipelineApi, 'moveDeal').mockImplementation(async (payload) => {
      if (payload.id === 'deal-2') return { ok: false, error: 'NETWORK' }
      return original(payload)
    })

    await act(async () => {
      await result.current.bulkMove(['deal-1', 'deal-2', 'deal-3'], 'negotiation')
    })

    expect(result.current.getDeal('deal-2').stage).toBe('negotiation')
    expect(result.current.overlays.failed['deal-2']).toBeTruthy()
    expect(result.current.overlays.failed['deal-1']).toBeUndefined()
    expect(pipelineApi.getDeal('deal-1').stage).toBe('negotiation')
    expect(pipelineApi.getDeal('deal-2').stage).toBe('proposal_sent')
    expect(result.current.bulkJob.failedIds).toEqual(['deal-2'])
  })
})
