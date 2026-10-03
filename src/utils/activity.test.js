import { describe, expect, it } from 'vitest'
import {
  ACTIVITY_TYPES,
  createActivityEvent,
  filterActivityEvents,
  formatActivityHeadline,
  formatRelativeActivity,
  groupActivityEvents,
  loadStoredActivity,
  persistActivity,
} from './activity.js'

describe('createActivityEvent', () => {
  it('fills id, timestamp, and defaults', () => {
    const event = createActivityEvent({
      type: ACTIVITY_TYPES.CONFLICT_DETECTED,
      dealId: 'deal-1',
      dealName: 'Apex Labs',
      actorName: 'Rahul Mehta',
    })
    expect(event.id).toEqual(expect.any(String))
    expect(event.timestamp).toEqual(expect.any(Number))
    expect(event.type).toBe(ACTIVITY_TYPES.CONFLICT_DETECTED)
    expect(event.metadata).toEqual({})
  })
})

describe('formatActivityHeadline', () => {
  it('describes moves, conflicts, and resolutions', () => {
    expect(
      formatActivityHeadline({
        type: ACTIVITY_TYPES.DEAL_MOVED,
        dealName: 'Apex Labs',
        metadata: { toStage: 'negotiation' },
      }),
    ).toBe('moved Apex Labs to Negotiation')

    expect(
      formatActivityHeadline({
        type: ACTIVITY_TYPES.CONFLICT_DETECTED,
        dealName: 'Apex Labs',
        metadata: { toStage: 'lost' },
      }),
    ).toBe('Conflict detected for Apex Labs')

    expect(
      formatActivityHeadline({
        type: ACTIVITY_TYPES.CONFLICT_RESOLVED,
        dealName: 'Apex Labs',
        metadata: { choice: 'mine', toStage: 'negotiation' },
      }),
    ).toBe('kept their change to Negotiation')

    expect(
      formatActivityHeadline({
        type: ACTIVITY_TYPES.CONFLICT_RESOLVED,
        dealName: 'Apex Labs',
        metadata: { choice: 'latest', toStage: 'lost' },
      }),
    ).toBe('used the latest change for Apex Labs')
  })
})

describe('formatRelativeActivity and grouping', () => {
  const now = 1_700_000_000_000

  it('uses just-now through day-scale labels', () => {
    expect(formatRelativeActivity(now - 10_000, now)).toBe('Just now')
    expect(formatRelativeActivity(now - 60_000, now)).toBe('1 minute ago')
    expect(formatRelativeActivity(now - 10 * 60_000, now)).toBe('10 minutes ago')
    expect(formatRelativeActivity(now - 2 * 3_600_000, now)).toBe('2 hours ago')
  })

  it('groups consecutive events that share a relative label', () => {
    const events = [
      { id: 'a', timestamp: now - 5_000 },
      { id: 'b', timestamp: now - 8_000 },
      { id: 'c', timestamp: now - 2 * 3_600_000 },
    ]
    const groups = groupActivityEvents(events, now)
    expect(groups).toHaveLength(2)
    expect(groups[0].label).toBe('Just now')
    expect(groups[0].events).toHaveLength(2)
    expect(groups[1].label).toBe('2 hours ago')
  })
})

describe('filterActivityEvents', () => {
  it('matches actor, company, headline, and stage', () => {
    const events = [
      createActivityEvent({
        type: ACTIVITY_TYPES.DEAL_MOVED,
        dealName: 'Indigo Infotech',
        actorName: 'Rohan Mehta',
        metadata: { toStage: 'proposal_sent' },
      }),
      createActivityEvent({
        type: ACTIVITY_TYPES.SAVE_FAILED,
        dealName: 'Apex Labs',
        actorName: 'Priya Sharma',
        metadata: { toStage: 'lost' },
      }),
    ]
    expect(filterActivityEvents(events, 'indigo')).toEqual([events[0]])
    expect(filterActivityEvents(events, 'priya')).toEqual([events[1]])
    expect(filterActivityEvents(events, 'proposal')).toEqual([events[0]])
    expect(filterActivityEvents(events, 'could not save')).toEqual([events[1]])
    expect(filterActivityEvents(events, '  ')).toEqual(events)
  })
})

describe('activity persistence', () => {
  it('round-trips events through localStorage and ignores bad JSON', () => {
    const events = [{ id: '1', type: ACTIVITY_TYPES.DEAL_MOVED }]
    persistActivity(events, 150)
    expect(loadStoredActivity(150)).toEqual(events)

    localStorage.setItem('sales-pipeline-activity', '{not json')
    expect(loadStoredActivity(150)).toEqual([])
  })
})
