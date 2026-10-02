import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { pipelineApi } from './pipelineApi.js'
import { makeDeal, QUIET_SIMULATION } from '../test/fixtures.js'

function seed(deals = [makeDeal()]) {
  const dealsById = Object.create(null)
  for (const deal of deals) dealsById[deal.id] = { ...deal }
  pipelineApi.init(dealsById)
  pipelineApi.setSettings(QUIET_SIMULATION)
}

describe('pipelineApi optimistic locking', () => {
  beforeEach(() => {
    seed()
  })

  afterEach(() => {
    pipelineApi.shutdown()
  })

  it('moves a deal and increments its version', async () => {
    const result = await pipelineApi.moveDeal({
      id: 'deal-1',
      toStage: 'negotiation',
      clientVersion: 1,
    })

    expect(result.ok).toBe(true)
    expect(result.fromStage).toBe('proposal_sent')
    expect(result.deal.stage).toBe('negotiation')
    expect(result.deal.version).toBe(2)
    expect(pipelineApi.getDeal('deal-1').version).toBe(2)
  })

  it('returns CONFLICT with a server snapshot when the client version is stale', async () => {
    pipelineApi.teammateMove('deal-1', 'lost', 'Rahul Mehta', { silent: true })

    const result = await pipelineApi.moveDeal({
      id: 'deal-1',
      toStage: 'negotiation',
      clientVersion: 1,
    })

    expect(result.ok).toBe(false)
    expect(result.error).toBe('CONFLICT')
    expect(result.serverDeal.stage).toBe('lost')
    expect(result.serverDeal.version).toBe(2)
    expect(pipelineApi.getDeal('deal-1').stage).toBe('lost')
  })

  it('does not apply the client move when versions disagree', async () => {
    pipelineApi.teammateMove('deal-1', 'won', 'Ananya Iyer', { silent: true })

    await pipelineApi.moveDeal({
      id: 'deal-1',
      toStage: 'negotiation',
      clientVersion: 1,
    })

    const server = pipelineApi.getDeal('deal-1')
    expect(server.stage).toBe('won')
    expect(server.version).toBe(2)
    expect(server.probability).toBe(100)
    expect(server.closedAt).toEqual(expect.any(Number))
  })

  it('overwrites the server copy when force is true even if the version is stale', async () => {
    pipelineApi.teammateMove('deal-1', 'lost', 'Rahul Mehta', { silent: true })

    const result = await pipelineApi.moveDeal({
      id: 'deal-1',
      toStage: 'negotiation',
      clientVersion: 1,
      force: true,
    })

    expect(result.ok).toBe(true)
    expect(result.deal.stage).toBe('negotiation')
    expect(result.deal.version).toBe(3)
    expect(pipelineApi.getDeal('deal-1').stage).toBe('negotiation')
  })

  it('returns NETWORK when the failure rate is 100%', async () => {
    pipelineApi.setSettings({ failureRate: 1 })

    const result = await pipelineApi.moveDeal({
      id: 'deal-1',
      toStage: 'negotiation',
      clientVersion: 1,
    })

    expect(result.ok).toBe(false)
    expect(result.error).toBe('NETWORK')
    expect(pipelineApi.getDeal('deal-1').stage).toBe('proposal_sent')
    expect(pipelineApi.getDeal('deal-1').version).toBe(1)
  })

  it('skips random network failure when force is true', async () => {
    pipelineApi.setSettings({ failureRate: 1 })

    const result = await pipelineApi.moveDeal({
      id: 'deal-1',
      toStage: 'negotiation',
      clientVersion: 1,
      force: true,
    })

    expect(result.ok).toBe(true)
    expect(result.deal.stage).toBe('negotiation')
  })

  it('returns NOT_FOUND for an unknown deal', async () => {
    const result = await pipelineApi.moveDeal({
      id: 'missing',
      toStage: 'negotiation',
      clientVersion: 1,
    })

    expect(result).toEqual({ ok: false, error: 'NOT_FOUND' })
  })

  it('bumps version immediately on teammateMove without waiting on latency', () => {
    const event = pipelineApi.teammateMove('deal-1', 'contacted', 'Vikram Singh')

    expect(event.fromStage).toBe('proposal_sent')
    expect(event.toStage).toBe('contacted')
    expect(event.deal.version).toBe(2)
    expect(event.actor).toBe('Vikram Singh')
  })

  it('does not emit when teammateMove is silent', () => {
    const events = []
    const unsubscribe = pipelineApi.subscribe((event) => events.push(event))

    pipelineApi.teammateMove('deal-1', 'lost', 'Rahul Mehta', { silent: true })
    unsubscribe()

    expect(events).toEqual([])
    expect(pipelineApi.getDeal('deal-1').stage).toBe('lost')
  })

  it('returns a cloned snapshot so callers cannot mutate server memory', () => {
    const snapshot = pipelineApi.getDeal('deal-1')
    snapshot.stage = 'won'
    snapshot.version = 99

    expect(pipelineApi.getDeal('deal-1').stage).toBe('proposal_sent')
    expect(pipelineApi.getDeal('deal-1').version).toBe(1)
  })

  it('sets lost probability and closedAt when a teammate closes the deal', () => {
    pipelineApi.teammateMove('deal-1', 'lost', 'Neha Patel', { silent: true })
    const deal = pipelineApi.getDeal('deal-1')
    expect(deal.probability).toBe(0)
    expect(deal.closedAt).toEqual(expect.any(Number))
  })
})
