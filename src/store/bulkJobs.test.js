import { describe, expect, it } from 'vitest'
import { makeDeal } from '../test/fixtures.js'
import { collectFailedBulkJobs, groupRetryIdsByStage, planBulkJobs } from './bulkJobs.js'

describe('bulkJobs', () => {
  it('plans only forward, non-pending jobs', () => {
    const deals = {
      a: makeDeal({ id: 'a', stage: 'contacted' }),
      b: makeDeal({ id: 'b', stage: 'negotiation' }),
      c: makeDeal({ id: 'c', stage: 'contacted' }),
    }
    const jobs = planBulkJobs(['a', 'b', 'c', 'missing'], 'demo_done', {}, {
      getDeal: (id) => deals[id],
      isPending: (id) => id === 'c',
      failedOverlays: {},
    })
    expect(jobs.map((job) => job.id)).toEqual(['a'])
    expect(jobs[0]).toMatchObject({ fromStage: 'contacted', toStage: 'demo_done' })
  })

  it('resubmits a failed deal that is already on the source stage', () => {
    const jobs = planBulkJobs(['a'], 'demo_done', { resubmit: true }, {
      getDeal: () => makeDeal({ id: 'a', stage: 'contacted' }),
      isPending: () => false,
      failedOverlays: { a: { fromStage: 'contacted', toStage: 'demo_done' } },
    })
    expect(jobs).toHaveLength(1)
    expect(jobs[0].fromStage).toBe('contacted')
  })

  it('groups retry ids by destination and collects non-cancelled failures', () => {
    const groups = groupRetryIdsByStage(
      ['a', 'b', 'c'],
      {
        a: { toStage: 'lost' },
        b: { toStage: 'lost' },
        c: { toStage: 'won' },
      },
      (id) => id !== 'c',
    )
    expect([...groups.keys()]).toEqual(['lost'])
    expect(groups.get('lost')).toEqual(['a', 'b'])

    const collected = collectFailedBulkJobs([
      { item: { id: 'a', fromStage: 'contacted' }, result: { error: 'CANCELLED' } },
      { item: { id: 'b', fromStage: 'contacted' }, result: { error: 'NETWORK' } },
    ])
    expect(collected.failedIds).toEqual(['b'])
    expect(collected.rollbackByStage.contacted).toEqual(['b'])
  })
})
