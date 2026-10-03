import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { pipelineApi } from '../api/pipelineApi.js'
import { ToastProvider } from '../components/common/Toast.jsx'
import { generatePipeline } from '../data/mockData.js'
import { fixturePipeline, makeDeal, QUIET_SIMULATION } from '../test/fixtures.js'
import { PipelineProvider } from './PipelineProvider.jsx'
import { usePipeline } from './pipelineContext.js'
import * as stageLists from './stageLists.js'

vi.mock('../data/mockData.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    generatePipeline: vi.fn(),
  }
})

const BULK_SIZE = 10_000
const FILLER = 40_000

function wrapper({ children }) {
  return (
    <ToastProvider>
      <PipelineProvider>{children}</PipelineProvider>
    </ToastProvider>
  )
}

function makeBulkDeals() {
  const deals = []
  for (let index = 0; index < BULK_SIZE; index += 1) {
    deals.push(makeDeal({
      id: `bulk-${index}`,
      company: `Bulk ${index}`,
      stage: 'new_lead',
    }))
  }
  for (let index = 0; index < FILLER; index += 1) {
    deals.push(makeDeal({
      id: `fill-${index}`,
      company: `Fill ${index}`,
      stage: 'contacted',
    }))
  }
  return deals
}

function seedBulkPipeline() {
  generatePipeline.mockReturnValue(fixturePipeline(makeBulkDeals()))
}

async function renderPipeline() {
  const hook = renderHook(() => usePipeline(), { wrapper })
  await waitFor(() => expect(hook.result.current.ready).toBe(true))
  act(() => {
    hook.result.current.updateSimulation(QUIET_SIMULATION)
  })
  return hook
}

function bulkIds() {
  return Array.from({ length: BULK_SIZE }, (_, index) => `bulk-${index}`)
}

function installFastMove(failIds = new Set()) {
  vi.spyOn(pipelineApi, 'moveDeal').mockImplementation(async ({ id, toStage }) => {
    if (failIds.has(id)) return { ok: false, error: 'NETWORK' }
    const current = pipelineApi.getDeal(id)
    const deal = { ...current, stage: toStage, version: (current?.version || 1) + 1 }
    pipelineApi.applyRemoteDeal(deal)
    return { ok: true, deal, fromStage: current.stage }
  })
}

describe('PipelineProvider 10,000-deal bulk reconciliation', () => {
  beforeEach(() => {
    seedBulkPipeline()
  })

  it('reconciles a large successful batch without per-deal stage scans', async () => {
    const { result } = await renderPipeline()
    const ids = bulkIds()
    installFastMove()
    const placeSpy = vi.spyOn(stageLists, 'placeDealInStage')

    await act(async () => {
      await result.current.bulkMove(ids, 'contacted')
    })

    expect(result.current.bulkJob?.running).toBe(false)
    expect(result.current.bulkJob.failedIds).toEqual([])
    expect(result.current.stageIds.new_lead).toHaveLength(0)
    expect(result.current.stageIds.contacted.length).toBe(BULK_SIZE + FILLER)
    expect(result.current.getDeal('bulk-0').stage).toBe('contacted')
    expect(result.current.getDeal('bulk-9999').stage).toBe('contacted')
    expect(result.current.overlays.failed['bulk-0']).toBeUndefined()
    expect(placeSpy).not.toHaveBeenCalled()
  }, 20_000)

  it('keeps successes and grouped-rollbacks failures on a large partial batch', async () => {
    const { result } = await renderPipeline()
    const ids = bulkIds()
    const failIds = new Set(ids.filter((_, index) => index % 10 === 0))
    installFastMove(failIds)
    const placeSpy = vi.spyOn(stageLists, 'placeDealInStage')

    await act(async () => {
      await result.current.bulkMove(ids, 'demo_done')
    })

    expect(result.current.bulkJob.failedIds).toHaveLength(failIds.size)
    expect(result.current.stageIds.new_lead).toHaveLength(failIds.size)
    expect(result.current.stageIds.demo_done).toHaveLength(BULK_SIZE - failIds.size)
    expect(result.current.getDeal('bulk-0').stage).toBe('new_lead')
    expect(result.current.overlays.failed['bulk-0']).toMatchObject({
      fromStage: 'new_lead',
      toStage: 'demo_done',
    })
    expect(result.current.getDeal('bulk-1').stage).toBe('demo_done')
    expect(result.current.overlays.failed['bulk-1']).toBeUndefined()
    expect(pipelineApi.getDeal('bulk-0').stage).toBe('new_lead')
    expect(pipelineApi.getDeal('bulk-1').stage).toBe('demo_done')
    expect(placeSpy).not.toHaveBeenCalled()
  }, 20_000)

  it('retries only the failed subset of a 10,000-deal batch', async () => {
    const { result } = await renderPipeline()
    const ids = bulkIds()
    const failIds = new Set(['bulk-0', 'bulk-1', 'bulk-2'])
    installFastMove(failIds)

    await act(async () => {
      await result.current.bulkMove(ids, 'proposal_sent')
    })
    expect(Object.keys(result.current.overlays.failed)).toHaveLength(3)

    pipelineApi.moveDeal.mockRestore()
    installFastMove()
    const moveSpy = pipelineApi.moveDeal

    await act(async () => {
      await result.current.retryFailedDeals([...failIds, 'bulk-9'])
    })

    await waitFor(() => {
      expect(result.current.overlays.failed['bulk-0']).toBeUndefined()
      expect(result.current.bulkJob?.running).toBe(false)
    })
    expect(result.current.getDeal('bulk-0').stage).toBe('proposal_sent')
    expect(moveSpy.mock.calls.map((call) => call[0].id).sort()).toEqual(['bulk-0', 'bulk-1', 'bulk-2'])
  }, 20_000)
})
