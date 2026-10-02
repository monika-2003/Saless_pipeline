import { describe, expect, it } from 'vitest'
import { ACTIVITY_TYPES } from '../utils/activity.js'
import { createRealtimeChannel, createRealtimeEvent, TAB_ID } from './realtimeChannel.js'

describe('createRealtimeEvent', () => {
  it('stamps the local tab id so the same tab can ignore its own broadcasts', () => {
    const event = createRealtimeEvent({
      type: ACTIVITY_TYPES.DEAL_MOVED,
      actorId: 'priya-sharma',
      actorName: 'Priya Sharma',
      dealId: 'deal-1',
      fromStage: 'proposal_sent',
      toStage: 'negotiation',
    })

    expect(event.sourceTabId).toBe(TAB_ID)
    expect(event.source).toBe('user')
    expect(event.dealId).toBe('deal-1')
    expect(event.id).toContain(TAB_ID)
  })
})

describe('createRealtimeChannel', () => {
  it('returns a no-op channel when BroadcastChannel is missing', () => {
    const original = globalThis.BroadcastChannel
    delete globalThis.BroadcastChannel

    const received = []
    const channel = createRealtimeChannel((event) => received.push(event))
    expect(() => channel.publish({ type: ACTIVITY_TYPES.DEAL_MOVED })).not.toThrow()
    expect(() => channel.close()).not.toThrow()
    expect(received).toEqual([])

    if (original) globalThis.BroadcastChannel = original
  })
})
