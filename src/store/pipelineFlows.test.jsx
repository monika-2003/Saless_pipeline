import { act, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { pipelineApi } from '../api/pipelineApi.js'
import { makeDeal, QUIET_SIMULATION } from '../test/fixtures.js'
import { renderPipeline, seedPipeline } from '../test/renderPipeline.jsx'
import { ACTIVITY_TYPES } from '../utils/activity.js'
import * as realtimeChannel from '../services/realtimeChannel.js'

vi.mock('../data/mockData.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    generatePipeline: vi.fn(),
  }
})

describe('pipeline move / conflict / retry / realtime flows', () => {
  beforeEach(() => {
    seedPipeline([
      makeDeal({ id: 'deal-1', stage: 'contacted', version: 1 }),
      makeDeal({ id: 'deal-2', company: 'Nimbus Systems', stage: 'contacted', version: 1 }),
      makeDeal({ id: 'deal-3', company: 'Harbor Digital', stage: 'contacted', version: 1 }),
    ])
  })

  it('moves a deal optimistically, marks it saved, and records activity', async () => {
    const { result } = await renderPipeline()

    await act(async () => {
      await result.current.moveDeal('deal-1', 'demo_done', { undoable: true })
    })

    expect(result.current.getDeal('deal-1').stage).toBe('demo_done')
    expect(result.current.stageIds.demo_done).toContain('deal-1')
    expect(result.current.overlays.pending['deal-1']).toBeUndefined()
    expect(result.current.overlays.saved['deal-1']).toBe(true)
    expect(result.current.activityEvents.some((event) => (
      event.type === ACTIVITY_TYPES.DEAL_MOVED && event.dealId === 'deal-1'
    ))).toBe(true)
  })

  it('fails a save, retries it, then lands on the destination stage', async () => {
    const { result } = await renderPipeline()
    const original = pipelineApi.moveDeal.bind(pipelineApi)
    vi.spyOn(pipelineApi, 'moveDeal').mockImplementationOnce(async () => (
      { ok: false, error: 'NETWORK' }
    )).mockImplementation(original)

    await act(async () => {
      await result.current.moveDeal('deal-1', 'demo_done')
    })
    expect(result.current.getDeal('deal-1').stage).toBe('contacted')
    expect(result.current.overlays.failed['deal-1']).toMatchObject({
      fromStage: 'contacted',
      toStage: 'demo_done',
    })

    await act(async () => {
      await result.current.retryDeal('deal-1')
    })
    await waitFor(() => {
      expect(result.current.overlays.failed['deal-1']).toBeUndefined()
    })
    expect(result.current.getDeal('deal-1').stage).toBe('demo_done')
    expect(result.current.overlays.saved['deal-1']).toBe(true)
    expect(result.current.activityEvents.some((event) => event.type === ACTIVITY_TYPES.SAVE_RETRIED)).toBe(true)
  })

  it('resolves a teammate conflict by keeping the local move', async () => {
    const { result } = await renderPipeline()
    act(() => {
      result.current.updateSimulation({
        ...QUIET_SIMULATION,
        latencyMin: 30,
        latencyMax: 30,
      })
    })

    let movePromise
    act(() => {
      movePromise = result.current.moveDeal('deal-1', 'demo_done')
    })
    pipelineApi.teammateMove('deal-1', 'lost', 'Rahul Mehta', { silent: true })
    await act(async () => {
      await movePromise
    })

    await waitFor(() => {
      expect(result.current.overlays.conflicts['deal-1']).toBeTruthy()
    })
    expect(result.current.getDeal('deal-1').stage).toBe('contacted')

    await act(async () => {
      await result.current.resolveConflict('deal-1', 'mine')
    })
    expect(result.current.getDeal('deal-1').stage).toBe('demo_done')
    expect(result.current.overlays.conflicts['deal-1']).toBeUndefined()
    expect(result.current.activityEvents.some((event) => (
      event.type === ACTIVITY_TYPES.CONFLICT_RESOLVED && event.metadata?.choice === 'mine'
    ))).toBe(true)
  })

  it('resolves a teammate conflict by using the latest remote snapshot', async () => {
    const { result } = await renderPipeline()
    act(() => {
      result.current.updateSimulation({
        ...QUIET_SIMULATION,
        latencyMin: 30,
        latencyMax: 30,
      })
    })

    let movePromise
    act(() => {
      movePromise = result.current.moveDeal('deal-1', 'demo_done')
    })
    pipelineApi.teammateMove('deal-1', 'lost', 'Rahul Mehta', { silent: true })
    await act(async () => {
      await movePromise
    })

    await act(async () => {
      await result.current.resolveConflict('deal-1', 'server')
    })
    expect(result.current.getDeal('deal-1').stage).toBe('lost')
    expect(result.current.overlays.conflicts['deal-1']).toBeUndefined()
    expect(result.current.activityEvents.some((event) => (
      event.type === ACTIVITY_TYPES.CONFLICT_RESOLVED && event.metadata?.choice === 'latest'
    ))).toBe(true)
  })

  it('applies an incoming realtime teammate move while the board is idle', async () => {
    const incoming = []
    vi.spyOn(realtimeChannel, 'createRealtimeChannel').mockImplementation((onEvent) => {
      incoming.push(onEvent)
      return { publish: vi.fn(), close: vi.fn(), tabId: 'test-tab' }
    })

    const { result } = await renderPipeline()
    expect(incoming.length).toBeGreaterThan(0)

    const remote = {
      ...result.current.getDeal('deal-2'),
      stage: 'proposal_sent',
      version: 4,
    }
    act(() => {
      incoming[0]({
        type: ACTIVITY_TYPES.DEAL_MOVED,
        source: 'teammate',
        actorName: 'Rahul Mehta',
        dealId: 'deal-2',
        deal: remote,
        fromStage: 'contacted',
        toStage: 'proposal_sent',
      })
    })

    expect(result.current.getDeal('deal-2').stage).toBe('proposal_sent')
    expect(result.current.stageIds.proposal_sent).toContain('deal-2')
    expect(result.current.stageIds.contacted).not.toContain('deal-2')
    expect(result.current.activityEvents[0].type).toBe(ACTIVITY_TYPES.DEAL_MOVED)
  })

  it('retries only the failed deals after a partial bulk move', async () => {
    const { result } = await renderPipeline()
    const original = pipelineApi.moveDeal.bind(pipelineApi)
    vi.spyOn(pipelineApi, 'moveDeal').mockImplementation(async (payload) => {
      if (payload.id === 'deal-2') return { ok: false, error: 'NETWORK' }
      return original(payload)
    })

    await act(async () => {
      await result.current.bulkMove(['deal-1', 'deal-2', 'deal-3'], 'demo_done')
    })
    await waitFor(() => {
      expect(result.current.bulkJob?.running).toBe(false)
    })

    expect(result.current.getDeal('deal-1').stage).toBe('demo_done')
    expect(result.current.getDeal('deal-3').stage).toBe('demo_done')
    expect(result.current.overlays.failed['deal-2']).toBeTruthy()
    expect(result.current.getDeal('deal-2').stage).toBe('contacted')

    pipelineApi.moveDeal.mockImplementation(original)
    await act(async () => {
      await result.current.retryFailedDeals(['deal-2'])
    })
    await waitFor(() => {
      expect(result.current.overlays.failed['deal-2']).toBeUndefined()
    })
    expect(result.current.getDeal('deal-2').stage).toBe('demo_done')
  })

  it('does not let a won or lost deal change stage', async () => {
    seedPipeline([
      makeDeal({ id: 'won-1', company: 'Closed Won', stage: 'won', version: 2 }),
      makeDeal({ id: 'lost-1', company: 'Closed Lost', stage: 'lost', version: 2 }),
    ])
    const { result } = await renderPipeline()
    const moveSpy = vi.spyOn(pipelineApi, 'moveDeal')

    act(() => {
      result.current.requestMove('won-1', 'lost')
      result.current.requestMove('lost-1', 'won')
    })
    expect(moveSpy).not.toHaveBeenCalled()
    expect(result.current.getDeal('won-1').stage).toBe('won')
    expect(result.current.getDeal('lost-1').stage).toBe('lost')

    await act(async () => {
      await result.current.moveDeal('won-1', 'lost', { allowBackward: true })
      await result.current.moveDeal('lost-1', 'negotiation', { allowBackward: true })
    })
    expect(result.current.getDeal('won-1').stage).toBe('won')
    expect(result.current.getDeal('lost-1').stage).toBe('lost')
  })
})
