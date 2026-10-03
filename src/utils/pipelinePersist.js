import { STAGES } from '../data/constants.js'

export const PIPELINE_SEED_KEY = 'sales-pipeline-seed'
export const PIPELINE_PATCH_KEY = 'sales-pipeline-deal-patches'

let memoryPatches = null
let flushTimer = null

function emptyPatches() {
  return Object.create(null)
}

function hydratePatches(parsed) {
  const out = emptyPatches()
  if (!parsed || typeof parsed !== 'object') return out
  const source = parsed.d && typeof parsed.d === 'object' ? parsed.d : parsed
  for (const id in source) {
    const value = source[id]
    if (Array.isArray(value) && value[0]) {
      out[id] = {
        stage: value[0],
        version: value[1],
        probability: value[2],
        closedAt: value[3] ?? null,
      }
    } else if (value && typeof value === 'object' && value.stage) {
      out[id] = {
        stage: value.stage,
        version: value.version,
        probability: value.probability,
        closedAt: value.closedAt ?? null,
      }
    }
  }
  return out
}

function serializePatches(patches) {
  const d = {}
  for (const id in patches) {
    const patch = patches[id]
    d[id] = [patch.stage, patch.version, patch.probability, patch.closedAt ?? null]
  }
  return JSON.stringify({ v: 1, d })
}

export function loadSeedNow() {
  try {
    const raw = localStorage.getItem(PIPELINE_SEED_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return typeof parsed?.seedNow === 'number' ? parsed.seedNow : null
  } catch {
    return null
  }
}

export function persistSeedNow(seedNow) {
  try {
    localStorage.setItem(PIPELINE_SEED_KEY, JSON.stringify({ v: 1, seedNow }))
  } catch {
    /* quota or private mode */
  }
}

export function loadDealPatches() {
  if (memoryPatches) return memoryPatches
  try {
    const raw = localStorage.getItem(PIPELINE_PATCH_KEY)
    memoryPatches = raw ? hydratePatches(JSON.parse(raw)) : emptyPatches()
  } catch {
    memoryPatches = emptyPatches()
  }
  return memoryPatches
}

export function persistDealChange(deal) {
  if (!deal?.id || !deal.stage) return
  const patches = loadDealPatches()
  patches[deal.id] = {
    stage: deal.stage,
    version: deal.version,
    probability: deal.probability,
    closedAt: deal.closedAt ?? null,
  }
  scheduleFlush()
}

export function flushDealChanges() {
  if (flushTimer != null) {
    window.clearTimeout(flushTimer)
    flushTimer = null
  }
  if (!memoryPatches) return
  try {
    localStorage.setItem(PIPELINE_PATCH_KEY, serializePatches(memoryPatches))
  } catch {
    /* quota or private mode */
  }
}

function scheduleFlush() {
  if (flushTimer != null) return
  flushTimer = window.setTimeout(() => {
    flushTimer = null
    flushDealChanges()
  }, 50)
}

export function applyDealPatches(dealsById, stageIds, patches) {
  if (!dealsById || !patches) return stageIds
  let changed = false
  for (const id in patches) {
    const deal = dealsById[id]
    const patch = patches[id]
    if (!deal || !patch?.stage) continue
    deal.stage = patch.stage
    if (patch.version != null) deal.version = patch.version
    if (patch.probability != null) deal.probability = patch.probability
    deal.closedAt = patch.closedAt ?? null
    changed = true
  }
  if (!changed) return stageIds

  const next = {}
  for (const stage of STAGES) next[stage.id] = []
  for (const id in dealsById) {
    const stage = dealsById[id]?.stage
    if (next[stage]) next[stage].push(id)
  }
  return next
}

export function unloadDealPatches() {
  memoryPatches = null
  if (flushTimer != null) {
    window.clearTimeout(flushTimer)
    flushTimer = null
  }
}

export function resetPersistedDeals() {
  unloadDealPatches()
  memoryPatches = emptyPatches()
  try {
    localStorage.removeItem(PIPELINE_PATCH_KEY)
  } catch {
    /* ignore */
  }
}
