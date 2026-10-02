import { describe, expect, it } from 'vitest'
import { canMoveStage, movableStages, stageIndex } from './stageOrder.js'

describe('canMoveStage', () => {
  it('allows only later stages', () => {
    expect(canMoveStage('new_lead', 'contacted')).toBe(true)
    expect(canMoveStage('proposal_sent', 'negotiation')).toBe(true)
    expect(canMoveStage('negotiation', 'won')).toBe(true)
    expect(canMoveStage('negotiation', 'lost')).toBe(true)
  })

  it('rejects backward, same-stage, and empty values', () => {
    expect(canMoveStage('negotiation', 'proposal_sent')).toBe(false)
    expect(canMoveStage('lost', 'won')).toBe(false)
    expect(canMoveStage('proposal_sent', 'proposal_sent')).toBe(false)
    expect(canMoveStage('', 'contacted')).toBe(false)
    expect(canMoveStage('contacted', null)).toBe(false)
  })

  it('lists every later stage as movable', () => {
    expect(movableStages('proposal_sent').map((stage) => stage.id)).toEqual([
      'negotiation',
      'won',
      'lost',
    ])
    expect(movableStages('lost')).toEqual([])
  })

  it('orders stages from New Lead through Lost', () => {
    expect(stageIndex('new_lead')).toBe(0)
    expect(stageIndex('lost')).toBe(6)
    expect(stageIndex('unknown')).toBe(-1)
  })
})
