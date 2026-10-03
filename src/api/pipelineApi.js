import { DEFAULT_SIMULATION, OWNERS } from '../data/constants.js'
import { cloneDealsById } from '../data/mockData.js'
import { pickForwardStage } from '../utils/stageOrder.js'

let serverDeals = Object.create(null)
let settings = { ...DEFAULT_SIMULATION }
const listeners = new Set()
let queuedFailures = new Set()
let queuedConflicts = new Set()
let lastActors = Object.create(null)

function clearSimulationQueues() {
  queuedFailures = new Set()
  queuedConflicts = new Set()
  lastActors = Object.create(null)
}

function addQueuedIds(target, ids, other) {
  for (const id of ids) {
    if (!id) continue
    target.add(id)
    other.delete(id)
  }
}

function emit(event) {
  listeners.forEach((listener) => listener(event))
}

function delay() {
  const span = Math.max(0, settings.latencyMax - settings.latencyMin)
  const ms = settings.latencyMin + Math.random() * span
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function snapshot(deal) {
  return { ...deal }
}

export const pipelineApi = {
  init(dealsById) {
    serverDeals = cloneDealsById(dealsById)
    clearSimulationQueues()
  },

  shutdown() {
    listeners.clear()
    clearSimulationQueues()
  },

  queueNextFailure(ids) {
    addQueuedIds(queuedFailures, Array.isArray(ids) ? ids : [ids], queuedConflicts)
  },

  queueNextConflict(ids) {
    addQueuedIds(queuedConflicts, Array.isArray(ids) ? ids : [ids], queuedFailures)
  },

  getQueuedSimulation() {
    return {
      failures: [...queuedFailures],
      conflicts: [...queuedConflicts],
    }
  },

  getSettings() {
    return { ...settings }
  },

  setSettings(next) {
    settings = { ...settings, ...next }
    emit({ type: 'settings', settings: { ...settings } })
  },

  subscribe(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },

  getDeal(id) {
    return serverDeals[id] ? snapshot(serverDeals[id]) : null
  },

  applyRemoteDeal(deal) {
    if (!deal?.id) return
    serverDeals[deal.id] = snapshot(deal)
  },

  async moveDeal({ id, toStage, clientVersion, force = false, excludeActor } = {}) {
    await delay()

    const server = serverDeals[id]
    if (!server) return { ok: false, error: 'NOT_FOUND' }

    if (queuedFailures.has(id)) {
      queuedFailures.delete(id)
      if (!force) return { ok: false, error: 'NETWORK' }
    } else if (!force && Math.random() < settings.failureRate) {
      return { ok: false, error: 'NETWORK' }
    }

    if (queuedConflicts.has(id)) {
      queuedConflicts.delete(id)
      if (!force) {
        const actorName = this.pickRandomActor(excludeActor)
        const otherStage = pickForwardStage(server.stage, toStage)
        if (otherStage) {
          this.teammateMove(id, otherStage, actorName, { silent: true })
        } else {
          server.version += 1
          lastActors[id] = actorName
        }
      }
    }

    const latest = serverDeals[id]
    if (!latest) return { ok: false, error: 'NOT_FOUND' }

    if (!force && latest.version !== clientVersion) {
      return {
        ok: false,
        error: 'CONFLICT',
        serverDeal: snapshot(latest),
        actorName: lastActors[id] || null,
      }
    }

    const fromStage = server.stage
    server.stage = toStage
    server.version += 1
    if (toStage === 'won') {
      server.probability = 100
      server.closedAt = Date.now()
    } else if (toStage === 'lost') {
      server.probability = 0
      server.closedAt = Date.now()
    } else {
      server.closedAt = null
    }

    return { ok: true, deal: snapshot(server), fromStage }
  },

  teammateMove(id, toStage, actor, options = {}) {
    const server = serverDeals[id]
    if (!server || server.stage === toStage) return null

    const fromStage = server.stage
    server.stage = toStage
    server.version += 1
    if (actor) lastActors[id] = actor
    if (toStage === 'won') {
      server.probability = 100
      server.closedAt = Date.now()
    } else if (toStage === 'lost') {
      server.probability = 0
      server.closedAt = Date.now()
    }

    const event = {
      type: 'teammate-move',
      deal: snapshot(server),
      fromStage,
      toStage,
      actor,
    }
    if (!options.silent) emit(event)
    return event
  },

  pickRandomOpenDealId() {
    const ids = Object.keys(serverDeals)
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const id = ids[Math.floor(Math.random() * ids.length)]
      const deal = serverDeals[id]
      if (deal && deal.stage !== 'won' && deal.stage !== 'lost') return id
    }
    return null
  },

  pickRandomStage(except) {
    return pickForwardStage(except)
  },

  pickRandomActor(excludeName) {
    const pool = excludeName ? OWNERS.filter((name) => name !== excludeName) : OWNERS
    return pool[Math.floor(Math.random() * pool.length)]
  },
}
