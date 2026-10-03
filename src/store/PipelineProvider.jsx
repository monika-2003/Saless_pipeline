import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { pipelineApi } from '../api/pipelineApi.js'
import {
  ACTIVITY_LIMIT,
  BULK_CONCURRENCY,
  DEFAULT_SIMULATION,
  DEFAULT_USER,
  OPEN_STAGE_IDS,
  STAGE_BY_ID,
  STAGES,
  SWITCHABLE_USERS,
  USER_BY_ID,
  USER_BY_NAME,
  VIEWS,
} from '../data/constants.js'
import { cloneDealsById, generatePipeline } from '../data/mockData.js'
import { useToasts } from '../components/common/Toast.jsx'
import { useDebouncedValue } from '../hooks/useDebouncedValue.js'
import { createRealtimeChannel, createRealtimeEvent } from '../services/realtimeChannel.js'
import {
  ACTIVITY_TYPES,
  clearStoredActivity,
  createActivityEvent,
  loadStoredActivity,
  persistActivity,
} from '../utils/activity.js'
import {
  applyDealPatches,
  flushDealChanges,
  loadDealPatches,
  loadSeedNow,
  persistDealChange,
  persistSeedNow,
  resetPersistedDeals,
} from '../utils/pipelinePersist.js'
import { getAttentionReason } from '../utils/attention.js'
import { runPool } from '../utils/concurrency.js'
import {
  dealMatchesFilters,
  dealMatchesSearch,
  createEmptyFilters,
  matchesView,
} from '../utils/filters.js'
import { canMoveStage } from '../utils/stageOrder.js'
import { PipelineContext } from './pipelineContext.js'
import * as stageLists from './stageLists.js'

const USER_STORAGE_KEY = 'sales-pipeline-current-user'
const NO_OVERLAYS = stageLists.emptyOverlays()

function copyOverlays(overlays) {
  return {
    pending: { ...overlays.pending },
    failed: { ...overlays.failed },
    conflicts: { ...overlays.conflicts },
    saved: { ...overlays.saved },
  }
}

function readStoredUser() {
  try {
    const id = sessionStorage.getItem(USER_STORAGE_KEY)
    if (id && USER_BY_ID[id]) return USER_BY_ID[id]
  } catch {
    /* ignore */
  }
  return DEFAULT_USER
}

function actorFromName(name) {
  return USER_BY_NAME[name] || { id: name, name, role: 'Teammate' }
}

export function PipelineProvider({ children }) {
  const dealsRef = useRef(Object.create(null))
  const pendingRef = useRef(Object.create(null))
  const lastUndoRef = useRef(null)
  const bulkRunningRef = useRef(false)
  const bulkJobIdRef = useRef(0)
  const savedTimersRef = useRef(Object.create(null))
  const currentUserRef = useRef(readStoredUser())
  const realtimeRef = useRef(null)
  const { pushToast } = useToasts()

  const [ready, setReady] = useState(false)
  const [stageIds, setStageIds] = useState(null)
  const [overlays, setOverlays] = useState({ ...stageLists.emptyOverlays(), saved: Object.create(null) })
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [pinSelected, setPinSelected] = useState(false)
  const [view, setView] = useState('all')
  const [layout, setLayout] = useState('board')

  useEffect(() => {
    if (!VIEWS.some((item) => item.id === view)) setView('all')
  }, [view])
  const [filterDraft, setFilterDraft] = useState(createEmptyFilters)
  const [openedDealId, setOpenedDealId] = useState(null)
  const [focusedDealId, setFocusedDealId] = useState(null)
  const [simulation, setSimulation] = useState(DEFAULT_SIMULATION)
  const [activityEvents, setActivityEvents] = useState(() => loadStoredActivity(ACTIVITY_LIMIT))
  const [bulkJob, setBulkJob] = useState(null)
  const [simulationOpen, setSimulationOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)
  const [currentUser, setCurrentUserState] = useState(readStoredUser)

  currentUserRef.current = currentUser

  const debouncedSearch = useDebouncedValue(filterDraft.search, 200)
  const filters = useMemo(
    () => ({ ...filterDraft, search: debouncedSearch.trim().toLowerCase() }),
    [filterDraft, debouncedSearch],
  )

  useEffect(() => {
    const seedNow = loadSeedNow() ?? Date.now()
    persistSeedNow(seedNow)
    const generated = generatePipeline(seedNow)
    const dealsById = cloneDealsById(generated.dealsById)
    const dealIdsByStage = applyDealPatches(dealsById, generated.dealIdsByStage, loadDealPatches())
    dealsRef.current = dealsById
    pipelineApi.init(dealsById)
    pipelineApi.setSettings(DEFAULT_SIMULATION)
    setStageIds(stageLists.cloneStageIds(dealIdsByStage))
    setReady(true)
    const persistOnHide = () => flushDealChanges()
    window.addEventListener('pagehide', persistOnHide)
    return () => {
      window.removeEventListener('pagehide', persistOnHide)
      flushDealChanges()
      pipelineApi.shutdown()
    }
  }, [])

  const getDeal = useCallback((id) => dealsRef.current[id], [])

  const pushActivity = useCallback((partial) => {
    const event = partial.id && partial.type ? partial : createActivityEvent(partial)
    setActivityEvents((current) => {
      const next = [event, ...current].slice(0, ACTIVITY_LIMIT)
      persistActivity(next, ACTIVITY_LIMIT)
      return next
    })
    return event
  }, [])

  const writeDealSnapshot = useCallback((deal) => {
    const previous = dealsRef.current[deal.id]
    dealsRef.current[deal.id] = { ...previous, ...deal }
    const next = dealsRef.current[deal.id]
    if (next) persistDealChange(next)
    return next
  }, [])

  const applyDealSnapshot = useCallback((deal) => {
    const next = writeDealSnapshot(deal)
    if (!next?.stage) return
    setStageIds((current) => stageLists.placeDealInStage(current, deal.id, next.stage))
  }, [writeDealSnapshot])

  const markSaved = useCallback((dealId) => {
    window.clearTimeout(savedTimersRef.current[dealId])
    setOverlays((current) => {
      const next = copyOverlays(current)
      next.saved[dealId] = true
      delete next.pending[dealId]
      delete next.failed[dealId]
      delete next.conflicts[dealId]
      return next
    })
    savedTimersRef.current[dealId] = window.setTimeout(() => {
      setOverlays((current) => {
        if (!current.saved[dealId]) return current
        const next = copyOverlays(current)
        delete next.saved[dealId]
        return next
      })
    }, 1800)
  }, [])

  const scheduleClearSaved = useCallback((dealIds) => {
    if (!dealIds.length) return
    const batchKey = `saved-batch-${dealIds[0]}`
    window.clearTimeout(savedTimersRef.current[batchKey])
    savedTimersRef.current[batchKey] = window.setTimeout(() => {
      const clear = new Set(dealIds)
      setOverlays((current) => {
        let changed = false
        const next = copyOverlays(current)
        for (const dealId of clear) {
          if (!next.saved[dealId]) continue
          delete next.saved[dealId]
          changed = true
        }
        return changed ? next : current
      })
    }, 1800)
  }, [])

  const moveLocal = useCallback((dealId, toStage) => {
    const deal = dealsRef.current[dealId]
    if (!deal || deal.stage === toStage) return deal?.stage
    const fromStage = deal.stage
    deal.stage = toStage
    setStageIds((current) => stageLists.applyMoveToStageIds(current, dealId, fromStage, toStage))
    return fromStage
  }, [])

  const publishRealtime = useCallback((event) => {
    realtimeRef.current?.publish(event)
  }, [])

  const applyIncomingMove = useCallback((payload) => {
    const dealId = payload.dealId || payload.deal?.id
    if (!dealId) return
    const incomingDeal = payload.deal || pipelineApi.getDeal(dealId)
    if (!incomingDeal) return

    const local = dealsRef.current[dealId]
    const fromStage = payload.fromStage || local?.stage
    const toStage = payload.toStage || incomingDeal.stage
    const actor = actorFromName(payload.actorName)

    if (!pendingRef.current[dealId] && local && incomingDeal.version < local.version) return

    pipelineApi.applyRemoteDeal(incomingDeal)

    if (pendingRef.current[dealId]) {
      setOverlays((current) => {
        const next = copyOverlays(current)
        delete next.pending[dealId]
        next.conflicts[dealId] = {
          localStage: pendingRef.current[dealId].toStage,
          fromStage: pendingRef.current[dealId].fromStage,
          serverDeal: incomingDeal,
          actorName: actor.name,
          actorId: actor.id,
        }
        return next
      })
      pushActivity({
        type: ACTIVITY_TYPES.CONFLICT_DETECTED,
        dealId,
        dealName: incomingDeal.company,
        actorId: actor.id,
        actorName: actor.name,
        metadata: {
          localStage: pendingRef.current[dealId].toStage,
          toStage,
        },
      })
      return
    }

    applyDealSnapshot(incomingDeal)
    if (local && local.stage !== incomingDeal.stage) {
      setStageIds((current) => stageLists.applyMoveToStageIds(current, dealId, local.stage, incomingDeal.stage))
    } else if (!local && fromStage && toStage && fromStage !== toStage) {
      setStageIds((current) => stageLists.applyMoveToStageIds(current, dealId, fromStage, toStage))
    }

    pushActivity({
      type: ACTIVITY_TYPES.DEAL_MOVED,
      dealId,
      dealName: incomingDeal.company,
      actorId: actor.id,
      actorName: actor.name,
      metadata: { fromStage, toStage, source: payload.source },
    })
  }, [applyDealSnapshot, pushActivity])

  const dispatchMove = useCallback((payload, { broadcast = true } = {}) => {
    applyIncomingMove(payload)
    if (broadcast) {
      publishRealtime(createRealtimeEvent({
        type: ACTIVITY_TYPES.DEAL_MOVED,
        source: payload.source || 'teammate',
        actorId: payload.actorId,
        actorName: payload.actorName,
        dealId: payload.dealId || payload.deal?.id,
        deal: payload.deal,
        fromStage: payload.fromStage,
        toStage: payload.toStage,
      }))
    }
  }, [applyIncomingMove, publishRealtime])

  useEffect(() => {
    const channel = createRealtimeChannel((event) => {
      if (event.type !== ACTIVITY_TYPES.DEAL_MOVED) return
      applyIncomingMove(event)
    })
    realtimeRef.current = channel
    return () => {
      channel.close()
      realtimeRef.current = null
    }
  }, [applyIncomingMove])

  const moveDeal = useCallback(async (dealId, toStage, options = {}) => {
    const deal = dealsRef.current[dealId]
    if (!deal) return
    if (pendingRef.current[dealId]) return
    const alreadyThere = deal.stage === toStage
    if (alreadyThere && !options.resubmit) return

    const fromStage = options.fromStage || (alreadyThere ? deal.stage : deal.stage)
    if (!alreadyThere) {
      if (!options.allowBackward && !canMoveStage(deal.stage, toStage)) {
        if (!options.quiet) {
          pushToast({
            tone: 'warning',
            title: 'Cannot move to a previous stage',
            message: `${deal.company} is already in ${STAGE_BY_ID[deal.stage].label}.`,
          })
        }
        return
      }
    }

    const clientVersion = options.clientVersion ?? deal.version
    const undoable = options.undoable === true
    const actor = currentUserRef.current
    const previousStage = alreadyThere ? fromStage : deal.stage

    pendingRef.current[dealId] = { fromStage: previousStage, toStage, clientVersion }
    setOverlays((current) => {
      const next = copyOverlays(current)
      next.pending[dealId] = pendingRef.current[dealId]
      delete next.failed[dealId]
      delete next.conflicts[dealId]
      delete next.saved[dealId]
      return next
    })
    if (!alreadyThere) moveLocal(dealId, toStage)
    if (undoable) lastUndoRef.current = { dealId, fromStage: previousStage, toStage }
    if (options.retried) {
      pushActivity({
        type: ACTIVITY_TYPES.SAVE_RETRIED,
        dealId,
        dealName: deal.company,
        actorId: actor.id,
        actorName: actor.name,
        metadata: { fromStage: previousStage, toStage },
      })
    }

    const result = await pipelineApi.moveDeal({
      id: dealId,
      toStage,
      clientVersion,
      force: options.force,
      excludeActor: currentUserRef.current.name,
    })

    delete pendingRef.current[dealId]
    if (result.ok) {
      applyDealSnapshot(result.deal)
      markSaved(dealId)
      pushActivity({
        type: ACTIVITY_TYPES.DEAL_MOVED,
        dealId,
        dealName: deal.company,
        actorId: actor.id,
        actorName: actor.name,
        metadata: { fromStage: previousStage, toStage, source: 'user' },
      })
      publishRealtime(createRealtimeEvent({
        type: ACTIVITY_TYPES.DEAL_MOVED,
        source: 'user',
        actorId: actor.id,
        actorName: actor.name,
        dealId,
        deal: result.deal,
        fromStage: previousStage,
        toStage,
      }))
      if (!options.quiet) {
        pushToast({
          tone: 'success',
          title: 'Deal moved successfully',
          message: `${deal.company} → ${STAGE_BY_ID[toStage].label}`,
          action: undoable
            ? {
                label: 'Undo',
                onClick: () => moveDeal(dealId, previousStage, { undoable: false, allowBackward: true }),
              }
            : undefined,
        })
      }
      return result
    }

    if (result.error === 'CONFLICT') {
      if (dealsRef.current[dealId]?.stage !== previousStage) moveLocal(dealId, previousStage)
      const serverDeal = result.serverDeal
      const other = actorFromName(payloadActorName(serverDeal, result.actorName || options.actorName))
      setOverlays((current) => {
        const next = copyOverlays(current)
        delete next.pending[dealId]
        next.conflicts[dealId] = {
          localStage: toStage,
          fromStage: previousStage,
          serverDeal,
          actorName: other.name,
          actorId: other.id,
        }
        return next
      })
      pushActivity({
        type: ACTIVITY_TYPES.CONFLICT_DETECTED,
        dealId,
        dealName: deal.company,
        actorId: other.id,
        actorName: other.name,
        metadata: { localStage: toStage, toStage: serverDeal.stage },
      })
      pushToast({
        tone: 'warning',
        title: 'Deal updated by a teammate',
        message: 'Choose which version to keep.',
      })
      return result
    }

    if (dealsRef.current[dealId]?.stage !== previousStage) moveLocal(dealId, previousStage)
    setOverlays((current) => {
      const next = copyOverlays(current)
      delete next.pending[dealId]
      next.failed[dealId] = { fromStage: previousStage, toStage, clientVersion }
      return next
    })
    pushActivity({
      type: ACTIVITY_TYPES.SAVE_FAILED,
      dealId,
      dealName: deal.company,
      actorId: actor.id,
      actorName: actor.name,
      metadata: { fromStage: previousStage, toStage },
    })
    if (!options.quiet) {
      pushToast({
        tone: 'danger',
        title: 'Failed to save deal',
        message: `${deal.company} could not be moved.`,
      })
    }
    return result
  }, [applyDealSnapshot, markSaved, moveLocal, publishRealtime, pushActivity, pushToast])

  const retryDeal = useCallback((dealId) => {
    const failed = overlays.failed[dealId]
    const deal = dealsRef.current[dealId]
    if (!failed || !deal) return
    return moveDeal(dealId, failed.toStage, {
      resubmit: true,
      fromStage: failed.fromStage,
      clientVersion: deal.version,
      undoable: false,
      retried: true,
    })
  }, [moveDeal, overlays.failed])

  const discardFailed = useCallback((dealId) => {
    const failed = overlays.failed[dealId]
    const deal = dealsRef.current[dealId]
    if (!failed || !deal) return
    if (deal.stage !== failed.fromStage) moveLocal(dealId, failed.fromStage)
    setOverlays((current) => {
      const next = copyOverlays(current)
      delete next.failed[dealId]
      delete next.pending[dealId]
      return next
    })
  }, [moveLocal, overlays.failed])

  const resolveConflict = useCallback(async (dealId, choice) => {
    const conflict = overlays.conflicts[dealId]
    if (!conflict) return
    const actor = currentUserRef.current
    const deal = dealsRef.current[dealId]

    if (choice === 'server') {
      const serverDeal = conflict.serverDeal
      const localStage = dealsRef.current[dealId].stage
      applyDealSnapshot(serverDeal)
      pipelineApi.applyRemoteDeal(serverDeal)
      if (localStage !== serverDeal.stage) {
        setStageIds((current) => stageLists.applyMoveToStageIds(current, dealId, localStage, serverDeal.stage))
      }
      setOverlays((current) => {
        const next = copyOverlays(current)
        delete next.conflicts[dealId]
        delete next.pending[dealId]
        delete next.failed[dealId]
        return next
      })
      pushActivity({
        type: ACTIVITY_TYPES.CONFLICT_RESOLVED,
        dealId,
        dealName: serverDeal.company,
        actorId: actor.id,
        actorName: actor.name,
        metadata: { choice: 'latest', toStage: serverDeal.stage },
      })
      pushToast({ tone: 'info', title: 'Using latest teammate change' })
      return
    }

    const result = await pipelineApi.moveDeal({
      id: dealId,
      toStage: conflict.localStage,
      clientVersion: conflict.serverDeal.version,
      force: true,
    })
    if (result.ok) {
      applyDealSnapshot(result.deal)
      markSaved(dealId)
      publishRealtime(createRealtimeEvent({
        type: ACTIVITY_TYPES.DEAL_MOVED,
        source: 'user',
        actorId: actor.id,
        actorName: actor.name,
        dealId,
        deal: result.deal,
        fromStage: conflict.fromStage,
        toStage: conflict.localStage,
      }))
      pushActivity({
        type: ACTIVITY_TYPES.CONFLICT_RESOLVED,
        dealId,
        dealName: deal?.company || result.deal.company,
        actorId: actor.id,
        actorName: actor.name,
        metadata: { choice: 'mine', toStage: conflict.localStage },
      })
      pushToast({ tone: 'success', title: 'Kept your change' })
    }
  }, [applyDealSnapshot, markSaved, overlays.conflicts, publishRealtime, pushActivity, pushToast])

  const undoLast = useCallback(() => {
    const last = lastUndoRef.current
    if (!last) return
    moveDeal(last.dealId, last.fromStage, { undoable: false, allowBackward: true })
    lastUndoRef.current = null
  }, [moveDeal])

  useEffect(() => {
    if (!ready || !simulation.teammateEnabled || bulkJob?.running) return undefined
    let timer
    const tick = () => {
      const delay = 5500 + Math.random() * 4000
      timer = window.setTimeout(() => {
        if (typeof document !== 'undefined' && !document.hasFocus()) {
          tick()
          return
        }
        if (bulkRunningRef.current) {
          tick()
          return
        }
        const id = pipelineApi.pickRandomOpenDealId()
        if (id && !pendingRef.current[id]) {
          const deal = pipelineApi.getDeal(id)
          const toStage = pipelineApi.pickRandomStage(deal.stage)
          if (!toStage) {
            tick()
            return
          }
          const actorName = pipelineApi.pickRandomActor(currentUserRef.current.name)
          const actor = actorFromName(actorName)
          const moved = pipelineApi.teammateMove(id, toStage, actorName, { silent: true })
          if (moved) {
            dispatchMove({
              type: ACTIVITY_TYPES.DEAL_MOVED,
              source: 'teammate',
              actorId: actor.id,
              actorName: actor.name,
              dealId: id,
              deal: moved.deal,
              fromStage: moved.fromStage,
              toStage: moved.toStage,
            })
          }
        }
        tick()
      }, delay)
    }
    tick()
    return () => window.clearTimeout(timer)
  }, [bulkJob?.running, dispatchMove, ready, simulation.teammateEnabled])

  const updateSimulation = useCallback((patch) => {
    setSimulation((current) => {
      const next = { ...current, ...patch }
      pipelineApi.setSettings(next)
      return next
    })
  }, [])

  const resetDemoData = useCallback(() => {
    resetPersistedDeals()
    clearStoredActivity()
    setActivityEvents([])
    Object.keys(savedTimersRef.current).forEach((id) => {
      window.clearTimeout(savedTimersRef.current[id])
      delete savedTimersRef.current[id]
    })
    pendingRef.current = Object.create(null)
    lastUndoRef.current = null
    bulkRunningRef.current = false
    bulkJobIdRef.current += 1

    const seedNow = loadSeedNow() ?? Date.now()
    persistSeedNow(seedNow)
    const generated = generatePipeline(seedNow)
    const dealsById = cloneDealsById(generated.dealsById)
    dealsRef.current = dealsById
    pipelineApi.init(dealsById)
    pipelineApi.setSettings(simulation)
    setStageIds(stageLists.cloneStageIds(generated.dealIdsByStage))
    setOverlays({ ...stageLists.emptyOverlays(), saved: Object.create(null) })
    setSelectedIds(new Set())
    setPinSelected(false)
    setBulkJob(null)
    setOpenedDealId(null)
    setFocusedDealId(null)
    setFilterDraft(createEmptyFilters())
    setView('all')
    pushToast({
      tone: 'info',
      title: 'Demo data reset',
      message: 'The original 50,000 deals were restored.',
    })
  }, [pushToast, simulation])

  const openDeal = useCallback((id) => {
    setSimulationOpen(false)
    setActivityOpen(false)
    setOpenedDealId(id)
  }, [])

  const closeDeal = useCallback(() => {
    setOpenedDealId(null)
  }, [])

  const setCurrentUser = useCallback((userOrId) => {
    const user = typeof userOrId === 'string'
      ? USER_BY_ID[userOrId] || SWITCHABLE_USERS.find((item) => item.name === userOrId)
      : userOrId
    if (!user) return
    setCurrentUserState(user)
    try {
      sessionStorage.setItem(USER_STORAGE_KEY, user.id)
    } catch {
      /* ignore */
    }
  }, [])

  const resolveSimulationIds = useCallback((ids) => {
    const source = Array.isArray(ids) && ids.length
      ? ids
      : selectedIds.size
        ? [...selectedIds]
        : openedDealId
          ? [openedDealId]
          : []
    return source.filter((id) => dealsRef.current[id])
  }, [openedDealId, selectedIds])

  const simulateConflict = useCallback((ids) => {
    const targets = resolveSimulationIds(ids)
    if (!targets.length) {
      pushToast({
        tone: 'warning',
        title: 'Select deals first',
        message: 'Select deals or open a deal, then simulate a conflict on the next move.',
      })
      return
    }

    pipelineApi.queueNextConflict(targets)
    setSimulationOpen(false)

    if (targets.length === 1) {
      const deal = dealsRef.current[targets[0]]
      pushToast({
        tone: 'warning',
        title: 'Conflict armed',
        message: `Move ${deal?.company || 'this deal'} to a stage or Mark lost. The next save will conflict.`,
      })
      return
    }

    pushToast({
      tone: 'warning',
      title: 'Conflict armed',
      message: `Move the ${targets.length} selected deals or Mark lost. Those saves will conflict.`,
    })
  }, [pushToast, resolveSimulationIds])

  const simulateFailure = useCallback((ids) => {
    const targets = resolveSimulationIds(ids)
    if (!targets.length) {
      pushToast({
        tone: 'warning',
        title: 'Select deals first',
        message: 'Select deals or open a deal, then simulate an API failure on the next move.',
      })
      return
    }

    pipelineApi.queueNextFailure(targets)
    setSimulationOpen(false)

    if (targets.length === 1) {
      const deal = dealsRef.current[targets[0]]
      pushToast({
        tone: 'danger',
        title: 'API failure armed',
        message: `Move ${deal?.company || 'this deal'} to a stage or Mark lost. The next save will fail.`,
      })
      return
    }

    pushToast({
      tone: 'danger',
      title: 'API failure armed',
      message: `Move the ${targets.length} selected deals or Mark lost. Those saves will fail.`,
    })
  }, [pushToast, resolveSimulationIds])

  const toggleSelect = useCallback((dealId, options = {}) => {
    if (pendingRef.current[dealId]) return
    setPinSelected(false)
    setSelectedIds((current) => {
      const next = options.replace ? new Set() : new Set(current)
      if (options.replace) {
        next.add(dealId)
        return next
      }
      if (next.has(dealId)) next.delete(dealId)
      else next.add(dealId)
      return next
    })
    setFocusedDealId(dealId)
  }, [])

  const selectRange = useCallback((ids, fromId, toId) => {
    const from = ids.indexOf(fromId)
    const to = ids.indexOf(toId)
    if (from < 0 || to < 0) return
    const [start, end] = from < to ? [from, to] : [to, from]
    setPinSelected(false)
    setSelectedIds((current) => {
      const next = new Set(current)
      for (let i = start; i <= end; i += 1) {
        if (!pendingRef.current[ids[i]]) next.add(ids[i])
      }
      return next
    })
  }, [])

  const selectMany = useCallback((ids) => {
    setPinSelected(false)
    setSelectedIds(new Set(ids))
  }, [])

  const clearSelection = useCallback(() => {
    setPinSelected(false)
    setSelectedIds(new Set())
  }, [])

  const pinSelectedToTop = useCallback(() => {
    setPinSelected((current) => !current)
  }, [])

  const bulkMove = useCallback(async (ids, toStage, options = {}) => {
    if (bulkRunningRef.current) return
    const jobs = []
    for (const id of ids) {
      const deal = dealsRef.current[id]
      if (!deal) continue
      if (pendingRef.current[id]) continue
      const sameStage = deal.stage === toStage
      if (sameStage && !options.resubmit) continue
      if (!sameStage && !canMoveStage(deal.stage, toStage) && !options.allowBackward) continue
      jobs.push({
        id,
        fromStage: sameStage ? (overlays.failed[id]?.fromStage || deal.stage) : deal.stage,
        toStage,
        clientVersion: deal.version,
        company: deal.company,
      })
    }
    if (jobs.length === 0) return

    const jobId = ++bulkJobIdRef.current
    bulkRunningRef.current = true
    const isCurrentBulk = () => bulkJobIdRef.current === jobId

    setOverlays((current) => {
      const next = copyOverlays(current)
      for (const job of jobs) {
        next.pending[job.id] = job
        delete next.failed[job.id]
        delete next.saved[job.id]
      }
      return next
    })
    jobs.forEach((job) => {
      pendingRef.current[job.id] = job
      const deal = dealsRef.current[job.id]
      if (deal && deal.stage !== toStage) deal.stage = toStage
    })
    setStageIds((current) => stageLists.applyBulkMoveToStageIds(current, jobs.map((job) => job.id), toStage))

    const actor = currentUserRef.current
    pushActivity({
      type: ACTIVITY_TYPES.BULK_OPERATION_STARTED,
      actorId: actor.id,
      actorName: actor.name,
      metadata: { total: jobs.length, toStage },
    })

    setBulkJob({
      id: jobId,
      toStage,
      total: jobs.length,
      completed: 0,
      failedCount: 0,
      running: true,
      failedIds: [],
    })
    let lastUi = 0
    let completed = 0
    const liveFailures = []
    const appliedFailedIds = []

    function flushLiveFailures() {
      if (!isCurrentBulk() || liveFailures.length === 0) return
      const batch = liveFailures.splice(0)
      const rollbackByStage = Object.create(null)
      for (const { job } of batch) {
        const deal = dealsRef.current[job.id]
        if (deal && deal.stage !== job.fromStage) deal.stage = job.fromStage
        delete pendingRef.current[job.id]
        appliedFailedIds.push(job.id)
        const group = rollbackByStage[job.fromStage] || (rollbackByStage[job.fromStage] = [])
        group.push(job.id)
      }
      setStageIds((current) => stageLists.applyGroupedStageMoves(current, rollbackByStage))
      setOverlays((current) => {
        const next = copyOverlays(current)
        for (const { job, result } of batch) {
          delete next.pending[job.id]
          delete next.saved[job.id]
          if (result?.error === 'CONFLICT') {
            const other = actorFromName(payloadActorName(
              result.serverDeal,
              result.actorName,
            ))
            next.conflicts[job.id] = {
              localStage: toStage,
              fromStage: job.fromStage,
              serverDeal: result.serverDeal,
              actorName: other.name,
              actorId: other.id,
            }
            delete next.failed[job.id]
          } else {
            next.failed[job.id] = { fromStage: job.fromStage, toStage, clientVersion: job.clientVersion }
            delete next.conflicts[job.id]
          }
        }
        return next
      })
    }

    try {
      const failed = await runPool(
        jobs,
        async (job) => {
          if (!isCurrentBulk()) return { ok: false, error: 'CANCELLED' }
          const result = await pipelineApi.moveDeal({
            id: job.id,
            toStage,
            clientVersion: job.clientVersion,
            excludeActor: currentUserRef.current.name,
          })
          if (!isCurrentBulk()) return result
          if (result && result.ok === false && result.error !== 'CANCELLED') {
            liveFailures.push({ job, result })
          }
          return result
        },
        BULK_CONCURRENCY,
        (done, failedCount) => {
          if (!isCurrentBulk()) return
          completed = done
          const now = Date.now()
          if (now - lastUi > 80 || done === jobs.length) {
            lastUi = now
            flushLiveFailures()
            setBulkJob((current) => (
              current?.id === jobId
                ? { ...current, completed: done, failedCount, failedIds: [...appliedFailedIds] }
                : current
            ))
          }
        },
      )

      if (!isCurrentBulk()) return
      flushLiveFailures()

      const failedSet = new Set()
      const failedIds = []
      const rollbackByStage = Object.create(null)
      for (const entry of failed) {
        if (entry.result?.error === 'CANCELLED') continue
        const job = entry.item
        failedSet.add(job.id)
        failedIds.push(job.id)
        const group = rollbackByStage[job.fromStage] || (rollbackByStage[job.fromStage] = [])
        group.push(job.id)
      }
      const actorNow = currentUserRef.current
      if (failedSet.size) {
        setStageIds((current) => {
          for (const job of jobs) {
            if (!failedSet.has(job.id)) continue
            const deal = dealsRef.current[job.id]
            if (deal && deal.stage !== job.fromStage) deal.stage = job.fromStage
          }
          return stageLists.applyGroupedStageMoves(current, rollbackByStage)
        })
      }

      const succeededIds = []
      for (const job of jobs) {
        delete pendingRef.current[job.id]
        if (failedSet.has(job.id)) continue
        const fresh = pipelineApi.getDeal(job.id)
        if (fresh) writeDealSnapshot(fresh)
        succeededIds.push(job.id)
      }

      setOverlays((current) => {
        const next = copyOverlays(current)
        for (const job of jobs) {
          delete next.pending[job.id]
        }
        for (const entry of failed) {
          const job = entry.item
          delete next.saved[job.id]
          if (entry.result?.error === 'CONFLICT') {
            const other = actorFromName(payloadActorName(
              entry.result.serverDeal,
              entry.result.actorName,
            ))
            next.conflicts[job.id] = {
              localStage: toStage,
              fromStage: job.fromStage,
              serverDeal: entry.result.serverDeal,
              actorName: other.name,
              actorId: other.id,
            }
            delete next.failed[job.id]
          } else {
            next.failed[job.id] = { fromStage: job.fromStage, toStage, clientVersion: job.clientVersion }
            delete next.conflicts[job.id]
          }
        }
        for (const id of succeededIds) {
          next.saved[id] = true
          delete next.failed[id]
          delete next.conflicts[id]
        }
        return next
      })
      scheduleClearSaved(succeededIds)

      setBulkJob((current) => (
        current?.id === jobId
          ? {
              id: jobId,
              toStage,
              total: jobs.length,
              completed,
              failedCount: failed.length,
              running: false,
              failedIds,
            }
          : current
      ))
      clearSelection()
      const ok = jobs.length - failed.length
      pushActivity({
        type: failed.length
          ? ACTIVITY_TYPES.BULK_OPERATION_PARTIAL_FAILURE
          : ACTIVITY_TYPES.BULK_OPERATION_COMPLETED,
        actorId: actorNow.id,
        actorName: actorNow.name,
        metadata: { total: jobs.length, succeeded: ok, failed: failed.length, toStage },
      })
      pushToast({
        tone: failed.length ? 'warning' : 'success',
        title: failed.length
          ? 'Bulk operation completed with some failures'
          : `${ok} deal${ok === 1 ? '' : 's'} moved successfully`,
        message: failed.length
          ? `${ok.toLocaleString('en-IN')} succeeded · ${failed.length} failed`
          : STAGE_BY_ID[toStage].label,
      })
    } finally {
      if (bulkJobIdRef.current === jobId) bulkRunningRef.current = false
    }
  }, [clearSelection, overlays.failed, pushActivity, pushToast, scheduleClearSaved, writeDealSnapshot])

  const requestMove = useCallback((dealId, toStage) => {
    const deal = dealsRef.current[dealId]
    if (!deal || deal.stage === toStage || pendingRef.current[dealId]) return
    if (!canMoveStage(deal.stage, toStage)) {
      pushToast({
        tone: 'warning',
        title: 'Cannot move to a previous stage',
        message: `${deal.company} is already in ${STAGE_BY_ID[deal.stage].label}.`,
      })
      return
    }
    moveDeal(dealId, toStage, { undoable: true })
  }, [moveDeal, pushToast])

  const requestBulkMove = useCallback((ids, toStage) => {
    if (bulkRunningRef.current) {
      pushToast({
        tone: 'warning',
        title: 'A bulk move is already in progress',
        message: 'Wait for the current batch to finish before starting another.',
      })
      return
    }
    const failedSelected = ids.filter((id) => overlays.failed[id])
    if (failedSelected.length) {
      const normalCount = ids.length - failedSelected.length
      pushToast({
        tone: 'warning',
        title: 'Resolve failed saves first',
        message: normalCount
          ? 'Retry or undo the failed deals before moving the rest of the selection.'
          : 'Retry or undo the failed deals before moving them to another stage.',
      })
      return
    }
    const movable = []
    for (const id of ids) {
      const deal = dealsRef.current[id]
      if (!deal || pendingRef.current[id] || deal.stage === toStage || !canMoveStage(deal.stage, toStage)) continue
      movable.push(id)
    }
    if (movable.length === 0) {
      pushToast({
        tone: 'warning',
        title: 'No deals to move',
        message: 'Selected deals are already at or past this stage.',
      })
      return
    }
    bulkMove(movable, toStage)
  }, [bulkMove, overlays.failed, pushToast])

  const retryFailedDeals = useCallback(async (ids) => {
    const groups = new Map()
    for (const id of ids) {
      const failed = overlays.failed[id]
      if (!failed || !dealsRef.current[id]) continue
      const group = groups.get(failed.toStage) || []
      group.push(id)
      groups.set(failed.toStage, group)
    }
    if (groups.size === 0) {
      pushToast({
        tone: 'warning',
        title: 'Nothing to retry',
        message: 'Select deals with a failed save.',
      })
      return
    }
    for (const [toStage, group] of groups) {
      await bulkMove(group, toStage, { resubmit: true, allowBackward: true })
    }
  }, [bulkMove, overlays.failed, pushToast])

  const retryBulkFailed = useCallback(() => {
    if (!bulkJob?.failedIds?.length) return
    return retryFailedDeals(bulkJob.failedIds)
  }, [bulkJob, retryFailedDeals])

  const visibleStageIds = useMemo(() => {
    if (!stageIds) return null
    const next = {}
    for (const stage of STAGES) {
      const ids = []
      for (const id of stageIds[stage.id]) {
        const deal = dealsRef.current[id]
        if (!deal || deal.stage !== stage.id) continue
        if (!dealMatchesSearch(deal, filters.search)) continue
        if (!dealMatchesFilters(deal, filters)) continue
        if (view === 'mine' && deal.owner !== currentUser.name) continue
        ids.push(id)
      }
      next[stage.id] = ids
    }
    return next
  }, [currentUser.name, filters, stageIds, view])

  const listIds = useMemo(() => {
    if (!stageIds || (view !== 'attention' && view !== 'failed')) return null
    const ids = []
    for (const stage of STAGES) {
      for (const id of stageIds[stage.id]) {
        const deal = dealsRef.current[id]
        if (!deal) continue
        if (!dealMatchesSearch(deal, filters.search)) continue
        if (!dealMatchesFilters(deal, filters)) continue
        if (!matchesView(deal, view, overlays, currentUser.name)) continue
        ids.push(id)
      }
    }
    return ids
  }, [currentUser.name, filters, overlays, stageIds, view])

  const matchingCount = useMemo(() => {
    if (listIds) return listIds.length
    if (!visibleStageIds) return 0
    return STAGES.reduce((sum, stage) => sum + visibleStageIds[stage.id].length, 0)
  }, [listIds, visibleStageIds])

  const visibleIdLookup = useMemo(
    () => stageLists.createVisibleIdSet(visibleStageIds, listIds),
    [listIds, visibleStageIds],
  )

  const visibleSelectedIds = useMemo(
    () => (visibleStageIds ? stageLists.intersectSelectedIds(selectedIds, visibleIdLookup) : selectedIds),
    [selectedIds, visibleIdLookup, visibleStageIds],
  )

  useEffect(() => {
    if (visibleSelectedIds === selectedIds) return
    setSelectedIds(visibleSelectedIds)
  }, [selectedIds, visibleSelectedIds])

  useEffect(() => {
    const savedIds = Object.keys(overlays.saved)
    if (!stageIds || savedIds.length === 0) return
    const grouped = stageLists.groupIdsByStage(savedIds, (id) => dealsRef.current[id]?.stage)
    setStageIds((current) => stageLists.applyGroupedStageMoves(current, grouped))
  }, [overlays.saved, stageIds])

  const unfilteredCounts = useMemo(() => {
    if (!stageIds) return {}
    return Object.fromEntries(STAGES.map((stage) => [stage.id, stageIds[stage.id].length]))
  }, [stageIds])

  const stageSummaries = useMemo(() => {
    if (!stageIds) {
      return { totalDeals: 0, pipelineValue: 0, wonThisMonth: 0, dateAttention: 0, myDeals: 0 }
    }
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)
    const monthStartMs = monthStart.getTime()

    let pipelineValue = 0
    let wonThisMonth = 0
    let dateAttention = 0
    let totalDeals = 0
    let myDeals = 0

    for (const stage of STAGES) {
      for (const id of stageIds[stage.id]) {
        const deal = dealsRef.current[id]
        totalDeals += 1
        if (deal.owner === currentUser.name) myDeals += 1
        if (OPEN_STAGE_IDS.includes(deal.stage)) pipelineValue += deal.value
        if (deal.stage === 'won' && deal.closedAt && deal.closedAt >= monthStartMs) {
          wonThisMonth += deal.value
        }
        if (getAttentionReason(deal, NO_OVERLAYS)) dateAttention += 1
      }
    }

    return { totalDeals, pipelineValue, wonThisMonth, dateAttention, myDeals }
  }, [currentUser.name, stageIds])

  const summaries = useMemo(() => {
    let extraAttention = 0
    for (const id of Object.keys(overlays.conflicts)) {
      const deal = dealsRef.current[id]
      if (deal && !getAttentionReason(deal, NO_OVERLAYS)) extraAttention += 1
    }
    for (const id of Object.keys(overlays.failed)) {
      if (overlays.conflicts[id]) continue
      const deal = dealsRef.current[id]
      if (deal && !getAttentionReason(deal, NO_OVERLAYS)) extraAttention += 1
    }
    return {
      totalDeals: stageSummaries.totalDeals,
      pipelineValue: stageSummaries.pipelineValue,
      wonThisMonth: stageSummaries.wonThisMonth,
      myDeals: stageSummaries.myDeals,
      needsAttention: stageSummaries.dateAttention + extraAttention,
    }
  }, [overlays.conflicts, overlays.failed, stageSummaries])

  const value = useMemo(
    () => ({
      ready,
      currentUser,
      setCurrentUser,
      users: SWITCHABLE_USERS,
      getDeal,
      stageIds,
      visibleStageIds,
      listIds,
      unfilteredCounts,
      matchingCount,
      overlays,
      selectedIds: visibleSelectedIds,
      pinSelected,
      pinSelectedToTop,
      view,
      setView,
      layout,
      setLayout,
      filterDraft,
      setFilterDraft,
      filters,
      openedDealId,
      openDeal,
      closeDeal,
      focusedDealId,
      setFocusedDealId,
      moveDeal,
      requestMove,
      requestBulkMove,
      retryDeal,
      retryFailedDeals,
      discardFailed,
      resolveConflict,
      undoLast,
      toggleSelect,
      selectRange,
      selectMany,
      clearSelection,
      bulkMove,
      bulkJob,
      retryBulkFailed,
      simulation,
      updateSimulation,
      resetDemoData,
      simulateConflict,
      simulateFailure,
      simulationOpen,
      setSimulationOpen,
      activityOpen,
      setActivityOpen,
      activityEvents,
      summaries,
    }),
    [
      activityEvents,
      activityOpen,
      bulkJob,
      bulkMove,
      clearSelection,
      closeDeal,
      currentUser,
      discardFailed,
      filterDraft,
      filters,
      focusedDealId,
      getDeal,
      layout,
      listIds,
      matchingCount,
      moveDeal,
      openDeal,
      openedDealId,
      overlays,
      pinSelected,
      pinSelectedToTop,
      ready,
      requestBulkMove,
      requestMove,
      resolveConflict,
      retryBulkFailed,
      retryDeal,
      retryFailedDeals,
      selectMany,
      selectRange,
      visibleSelectedIds,
      setCurrentUser,
      simulation,
      simulationOpen,
      stageIds,
      summaries,
      toggleSelect,
      undoLast,
      unfilteredCounts,
      updateSimulation,
      resetDemoData,
      simulateConflict,
      simulateFailure,
      view,
      visibleStageIds,
    ],
  )

  return <PipelineContext.Provider value={value}>{children}</PipelineContext.Provider>
}

function payloadActorName(serverDeal, fallback) {
  return fallback || serverDeal?.owner || 'A teammate'
}
