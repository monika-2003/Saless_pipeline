import { describe, expect, it } from 'vitest'
import { DEFAULT_USER } from '../data/constants.js'
import { actorFromName, payloadActorName, readStoredUser, USER_STORAGE_KEY } from './pipelineActors.js'

describe('pipelineActors', () => {
  it('reads the stored user and falls back to the default', () => {
    sessionStorage.removeItem(USER_STORAGE_KEY)
    expect(readStoredUser()).toEqual(DEFAULT_USER)
    sessionStorage.setItem(USER_STORAGE_KEY, 'unknown-user')
    expect(readStoredUser()).toEqual(DEFAULT_USER)
  })

  it('resolves known teammates and payload actor names', () => {
    expect(actorFromName('Rahul Mehta').name).toBe('Rahul Mehta')
    expect(actorFromName('Visitor').role).toBe('Teammate')
    expect(payloadActorName({ owner: 'Neha Patel' })).toBe('Neha Patel')
    expect(payloadActorName(null, 'Rahul Mehta')).toBe('Rahul Mehta')
    expect(payloadActorName(null)).toBe('A teammate')
  })
})
