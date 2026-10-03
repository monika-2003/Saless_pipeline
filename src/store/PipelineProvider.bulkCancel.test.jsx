import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { pipelineApi } from '../api/pipelineApi.js'
import { ToastProvider } from '../components/common/Toast.jsx'
import { generatePipeline } from '../data/mockData.js'
import { fixturePipeline, makeDeal, QUIET_SIMULATION } from '../test/fixtures.js'
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

function seedPipeline(deals = [
  makeDeal({ id: 'deal-1', stage: 'proposal_sent' }),
  makeDeal({ id: 'deal-2', company: 'Nimbus Systems', stage: 'proposal_sent' }),
]) {
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

function deferMoves() {
  const pending = []
  vi.spyOn(pipelineApi, 'moveDeal').mockImplementation((payload) => {
    const startedGeneration = pipelineApi.getGeneration()
    return new Promise((resolve) => {
      pending.push({
        payload,
        resolve: (result) => {
          if (pipelineApi.getGeneration() !== startedGeneration) {
            resolve({ ok: false, error: 'CANCELLED' })
            return
          }
          if (result?.ok && result.deal) pipelineApi.applyRemoteDeal(result.deal)
          resolve(result)
        },
      })
    })
  })
  return {
    pending,
    resolveAll(resultFor) {
      for (const entry of pending) {
        entry.resolve(resultFor(entry.payload))
      }
    },
  }
}

function successResult(payload, fromStage = 'proposal_sent') {
  return {
    ok: true,
    fromStage,
    deal: {
      ...makeDeal({
        id: payload.id,
        stage: payload.toStage,
        version: 2,
        company: payload.id === 'deal-2' ? 'Nimbus Systems' : 'Apex Labs',
      }),
    },
  }
}

describe('PipelineProvider bulk generation cancel', () => {
  beforeEach(() => {
    seedPipeline()
  })

  it('ignores a stale bulk result after reset', async () => {
    const { result } = await renderPipeline()
    const deferred = deferMoves()

    let first
    act(() => {
      first = result.current.bulkMove(['deal-1', 'deal-2'], 'negotiation')
    })
    expect(result.current.bulkJob.running).toBe(true)
    expect(result.current.getDeal('deal-1').stage).toBe('negotiation')

    act(() => {
      result.current.resetDemoData()
    })
    expect(result.current.getDeal('deal-1').stage).toBe('proposal_sent')
    expect(result.current.bulkJob).toBeNull()
    expect(result.current.overlays.pending['deal-1']).toBeUndefined()
    expect(result.current.selectedIds.size).toBe(0)

    deferred.resolveAll((payload) => successResult(payload, 'proposal_sent'))
    await act(async () => {
      await first
    })

    expect(result.current.getDeal('deal-1').stage).toBe('proposal_sent')
    expect(result.current.getDeal('deal-2').stage).toBe('proposal_sent')
    expect(result.current.stageIds.proposal_sent).toEqual(expect.arrayContaining(['deal-1', 'deal-2']))
    expect(result.current.stageIds.negotiation || []).not.toContain('deal-1')
    expect(result.current.overlays.saved['deal-1']).toBeUndefined()
    expect(result.current.overlays.failed['deal-1']).toBeUndefined()
    expect(result.current.bulkJob).toBeNull()
    expect(pipelineApi.getDeal('deal-1').stage).toBe('proposal_sent')
  })

  it('does not let a stale bulk A mutate a later bulk B', async () => {
    const { result } = await renderPipeline()
    const deferred = deferMoves()

    let first
    act(() => {
      first = result.current.bulkMove(['deal-1', 'deal-2'], 'negotiation')
    })
    const firstWave = deferred.pending.splice(0, deferred.pending.length)

    act(() => {
      result.current.resetDemoData()
    })

    let second
    act(() => {
      second = result.current.bulkMove(['deal-1'], 'lost')
    })
    expect(result.current.bulkJob.running).toBe(true)
    expect(result.current.bulkJob.toStage).toBe('lost')
    expect(result.current.getDeal('deal-1').stage).toBe('lost')

    for (const entry of firstWave) {
      entry.resolve(successResult(entry.payload, 'proposal_sent'))
    }
    await act(async () => {
      await first
    })

    expect(result.current.getDeal('deal-1').stage).toBe('lost')
    expect(result.current.stageIds.lost).toContain('deal-1')
    expect(result.current.stageIds.negotiation || []).not.toContain('deal-1')
    expect(result.current.bulkJob.toStage).toBe('lost')

    deferred.resolveAll((payload) => successResult(payload, 'proposal_sent'))
    await act(async () => {
      await second
    })
    expect(result.current.getDeal('deal-1').stage).toBe('lost')
    expect(result.current.bulkJob.running).toBe(false)
    expect(result.current.bulkJob.toStage).toBe('lost')
  })

  it('allows a new bulk or retry after reset', async () => {
    const { result } = await renderPipeline()
    const deferred = deferMoves()

    let first
    act(() => {
      first = result.current.bulkMove(['deal-1'], 'negotiation')
    })
    act(() => {
      result.current.resetDemoData()
    })
    deferred.resolveAll((payload) => successResult(payload))
    await act(async () => {
      await first
    })

    pipelineApi.moveDeal.mockRestore()
    await act(async () => {
      await result.current.bulkMove(['deal-1', 'deal-2'], 'lost')
    })

    await waitFor(() => {
      expect(result.current.bulkJob?.running).toBe(false)
    })
    expect(result.current.getDeal('deal-1').stage).toBe('lost')
    expect(result.current.getDeal('deal-2').stage).toBe('lost')
    expect(result.current.stageIds.lost).toEqual(expect.arrayContaining(['deal-1', 'deal-2']))
    expect(result.current.overlays.failed['deal-1']).toBeUndefined()
  })
})
