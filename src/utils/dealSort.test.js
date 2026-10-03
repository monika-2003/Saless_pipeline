import { describe, expect, it } from 'vitest'
import { makeDeal } from '../test/fixtures.js'
import { nextStageSort, sortDealIds } from './dealSort.js'

const deals = {
  'deal-a': makeDeal({ id: 'deal-a', company: 'Zenith Co', value: 100_000, priority: 'low', expectedCloseDate: 30 }),
  'deal-b': makeDeal({ id: 'deal-b', company: 'Apex Co', value: 900_000, priority: 'high', expectedCloseDate: 10 }),
  'deal-c': makeDeal({ id: 'deal-c', company: 'Mid Co', value: 400_000, priority: 'medium', expectedCloseDate: 20 }),
}

function getDeal(id) {
  return deals[id]
}

describe('dealSort', () => {
  it('sorts by name, price, date, and priority', () => {
    const ids = ['deal-a', 'deal-b', 'deal-c']
    expect(sortDealIds(ids, getDeal, { key: 'name', dir: 'asc' })).toEqual(['deal-b', 'deal-c', 'deal-a'])
    expect(sortDealIds(ids, getDeal, { key: 'price', dir: 'desc' })).toEqual(['deal-b', 'deal-c', 'deal-a'])
    expect(sortDealIds(ids, getDeal, { key: 'date', dir: 'asc' })).toEqual(['deal-b', 'deal-c', 'deal-a'])
    expect(sortDealIds(ids, getDeal, { key: 'priority', dir: 'desc' })).toEqual(['deal-b', 'deal-c', 'deal-a'])
  })

  it('keeps the original order when no sort is set', () => {
    const ids = ['deal-a', 'deal-c', 'deal-b']
    expect(sortDealIds(ids, getDeal, null)).toBe(ids)
  })

  it('toggles direction on the same key', () => {
    expect(nextStageSort(null, 'price')).toEqual({ key: 'price', dir: 'desc' })
    expect(nextStageSort({ key: 'price', dir: 'desc' }, 'price')).toEqual({ key: 'price', dir: 'asc' })
    expect(nextStageSort({ key: 'price', dir: 'asc' }, 'name')).toEqual({ key: 'name', dir: 'asc' })
  })
})
