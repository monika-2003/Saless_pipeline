import { describe, expect, it } from 'vitest'
import { emptyOverlays, makeDeal } from '../test/fixtures.js'
import {
  createEmptyFilters,
  dealMatchesFilters,
  dealMatchesSearch,
  matchesView,
} from './filters.js'

describe('dealMatchesSearch', () => {
  const deal = makeDeal({
    company: 'Apex Labs',
    contactName: 'Nisha Chopra',
    owner: 'Priya Sharma',
  })

  it('matches company, contact, or owner without requiring every field', () => {
    expect(dealMatchesSearch(deal, '')).toBe(true)
    expect(dealMatchesSearch(deal, 'apex')).toBe(true)
    expect(dealMatchesSearch(deal, 'nisha')).toBe(true)
    expect(dealMatchesSearch(deal, 'priya')).toBe(true)
    expect(dealMatchesSearch(deal, 'rahul')).toBe(false)
  })
})

describe('dealMatchesFilters', () => {
  const deal = makeDeal({
    owner: 'Priya Sharma',
    priority: 'high',
    stage: 'proposal_sent',
    value: 500_000,
  })

  it('applies owner, priority, stage, and min value together', () => {
    expect(dealMatchesFilters(deal, createEmptyFilters())).toBe(true)
    expect(dealMatchesFilters(deal, { ...createEmptyFilters(), owner: ['Rahul Mehta'] })).toBe(false)
    expect(dealMatchesFilters(deal, { ...createEmptyFilters(), owner: ['Priya Sharma'] })).toBe(true)
    expect(dealMatchesFilters(deal, { ...createEmptyFilters(), priority: ['low'] })).toBe(false)
    expect(dealMatchesFilters(deal, { ...createEmptyFilters(), stage: ['negotiation'] })).toBe(false)
    expect(dealMatchesFilters(deal, { ...createEmptyFilters(), minValue: 600_000 })).toBe(false)
    expect(dealMatchesFilters(deal, { ...createEmptyFilters(), minValue: 400_000 })).toBe(true)
  })
})

describe('matchesView', () => {
  it('scopes My Deals to the current owner', () => {
    const mine = makeDeal({ owner: 'Priya Sharma' })
    const other = makeDeal({ id: 'deal-2', owner: 'Rahul Mehta' })
    expect(matchesView(mine, 'mine', emptyOverlays(), 'Priya Sharma')).toBe(true)
    expect(matchesView(other, 'mine', emptyOverlays(), 'Priya Sharma')).toBe(false)
  })

  it('includes failed and attention views from overlays', () => {
    const deal = makeDeal()
    expect(matchesView(deal, 'failed', emptyOverlays(), 'Priya Sharma')).toBe(false)
    expect(
      matchesView(deal, 'failed', emptyOverlays({ failed: { [deal.id]: {} } }), 'Priya Sharma'),
    ).toBe(true)
    expect(
      matchesView(
        deal,
        'attention',
        emptyOverlays({ conflicts: { [deal.id]: { localStage: 'negotiation' } } }),
        'Priya Sharma',
      ),
    ).toBe(true)
  })
})
