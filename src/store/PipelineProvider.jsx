import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fakeApi } from '../api/fakeApi.js'
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
  createActivityEvent,
  loadStoredActivity,
  persistActivity,
} from '../utils/activity.js'
import { runPool } from '../utils/concurrency.js'
import {
  dealMatchesFilters,
  dealMatchesSearch,
  createEmptyFilters,
  isNeedsAttention,
  matchesView,
} from '../utils/filters.js'
import { canMoveStage } from '../utils/stageOrder.js'
import { PipelineContext } from './pipelineContext.js'
import { applyBulkMoveToStageIds, applyMoveToStageIds, emptyOverlays } from './stageLists.js'

const USER_STORAGE_KEY = 'sales-pipeline-current-user'

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
  const savedTimersRef = useRef(Object.create(null))
  const currentUserRef = useRef(readStoredUser())
  const realtimeRef = useRef(null)
  const { pushToast } = useToasts()

  const [ready, setReady] = useState(false)
  const [stageIds, setStageIds] = useState(null)
  const [overlays, setOverlays] = useState({ ...emptyOverlays(), saved: Object.create(null) })
  const [selectedIds, setSelectedIds] = useState(() => new Set())
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
    const { dealsById, dealIdsByStage } = generatePipeline()
    dealsRef.current = cloneDealsById(dealsById)
    fakeApi.init(dealsById)
    fakeApi.setSettings(DEFAULT_SIMULATION)
    setStageIds(dealIdsByStage)
    setReady(true)
    return () => fakeApi.shutdown()
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

  const applyDealSnapshot = useCallback((deal) => {
    dealsRef.current[deal.id] = { ...dealsRef.current[deal.id], ...deal }
  }, [])

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

  const moveLocal = useCallback((dealId, toStage) => {
    const deal = dealsRef.current[dealId]
    if (!deal || deal.stage === toStage) return deal?.stage
    const fromStage = deal.stage
    deal.stage = toStage
    setStageIds((current) => applyMoveToStageIds(current, dealId, fromStage, toStage))
    return fromStage
  }, [])

  const publishRealtime = useCallback((event) => {
    realtimeRef.current?.publish(event)
  }, [])

  const applyIncomingMove = useCallback((payload) => {
    const dealId = payload.dealId || payload.deal?.id
    if (!dealId) return
    const incomingDeal = payload.deal || fakeApi.getDeal(dealId)
    if (!incomingDeal) return

    const local = dealsRef.current[dealId]
    const fromStage = payload.fromStage || local?.stage
    const toStage = payload.toStage || incomingDeal.stage
    const actor = actorFromName(payload.actorName)

    if (!pendingRef.current[dealId] && local && incomingDeal.version < local.version) return

    fakeApi.applyRemoteDeal(incomingDeal)

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
      setStageIds((current) => applyMoveToStageIds(current, dealId, local.stage, incomingDeal.stage))
    } else if (!local && fromStage && toStage && fromStage !== toStage) {
      setStageIds((current) => applyMoveToStageIds(current, dealId, fromStage, toStage))
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

    if (!alreadyThere) moveLocal(dealId, toStage)

    pendingRef.current[dealId] = { fromStage: previousStage, toStage, clientVersion }
    setOverlays((current) => {
      const next = copyOverlays(current)
      next.pending[dealId] = pendingRef.current[dealId]
      delete next.failed[dealId]
      delete next.conflicts[dealId]
      delete next.saved[dealId]
      return next
    })
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

    const result = await fakeApi.moveDeal({
      id: dealId,
      toStage,
      clientVersion,
      force: options.force,
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
      const serverDeal = result.serverDeal
      const other = actorFromName(payloadActorName(serverDeal, options.actorName))
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
      fakeApi.applyRemoteDeal(serverDeal)
      if (localStage !== serverDeal.stage) {
        setStageIds((current) => applyMoveToStageIds(current, dealId, localStage, serverDeal.stage))
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

    const result = await fakeApi.moveDeal({
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
    if (!ready || !simulation.teammateEnabled) return undefined
    let timer
    const tick = () => {
      const delay = 5500 + Math.random() * 4000
      timer = window.setTimeout(() => {
        if (typeof document !== 'undefined' && !document.hasFocus()) {
          tick()
          return
        }
        const id = fakeApi.pickRandomOpenDealId()
        if (id) {
          const deal = fakeApi.getDeal(id)
          const toStage = fakeApi.pickRandomStage(deal.stage)
          const actorName = fakeApi.pickRandomActor(currentUserRef.current.name)
          const actor = actorFromName(actorName)
          const moved = fakeApi.teammateMove(id, toStage, actorName, { silent: true })
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
  }, [dispatchMove, ready, simulation.teammateEnabled])

  const updateSimulation = useCallback((patch) => {
    setSimulation((current) => {
      const next = { ...current, ...patch }
      fakeApi.setSettings(next)
      return next
    })
  }, [])

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

  const simulateConflict = useCallback(async () => {
    const preferred = openedDealId || [...selectedIds][0] || fakeApi.pickRandomOpenDealId()
    const deal = dealsRef.current[preferred]
    if (!deal) return

    const fromStage = deal.stage
    let localTarget = fakeApi.pickRandomStage(fromStage)
    let serverTarget = fakeApi.pickRandomStage(fromStage)
    while (serverTarget === localTarget) serverTarget = fakeApi.pickRandomStage(fromStage)

    const actorName = fakeApi.pickRandomActor(currentUserRef.current.name)
    const actor = actorFromName(actorName)
    const clientVersion = deal.version
    moveLocal(preferred, localTarget)
    pendingRef.current[preferred] = { fromStage, toStage: localTarget, clientVersion }
    setOverlays((current) => {
      const next = copyOverlays(current)
      next.pending[preferred] = pendingRef.current[preferred]
      return next
    })
    openDeal(preferred)

    const moved = fakeApi.teammateMove(preferred, serverTarget, actorName, { silent: true })
    const result = await fakeApi.moveDeal({ id: preferred, toStage: localTarget, clientVersion })
    delete pendingRef.current[preferred]

    const serverDeal = result.serverDeal || moved?.deal || fakeApi.getDeal(preferred)
    setOverlays((current) => {
      const next = copyOverlays(current)
      delete next.pending[preferred]
      next.conflicts[preferred] = {
        localStage: localTarget,
        fromStage,
        serverDeal,
        actorName: actor.name,
        actorId: actor.id,
      }
      return next
    })
    pushActivity({
      type: ACTIVITY_TYPES.CONFLICT_DETECTED,
      dealId: preferred,
      dealName: deal.company,
      actorId: actor.id,
      actorName: actor.name,
      metadata: { localStage: localTarget, toStage: serverTarget },
    })
    pushToast({
      tone: 'warning',
      title: 'Conflict simulated',
      message: `${actor.name} moved ${deal.company} at the same time.`,
    })
  }, [moveLocal, openDeal, openedDealId, pushActivity, pushToast, selectedIds])

  const simulateFailure = useCallback(() => {
    const preferred = openedDealId || [...selectedIds][0] || fakeApi.pickRandomOpenDealId()
    const deal = dealsRef.current[preferred]
    if (!deal) return

    const fromStage = deal.stage
    const toStage = fakeApi.pickRandomStage(fromStage)
    const clientVersion = deal.version
    const actor = currentUserRef.current
    moveLocal(preferred, toStage)
    setOverlays((current) => {
      const next = copyOverlays(current)
      delete next.pending[preferred]
      next.failed[preferred] = { fromStage, toStage, clientVersion }
      return next
    })
    openDeal(preferred)
    pushActivity({
      type: ACTIVITY_TYPES.SAVE_FAILED,
      dealId: preferred,
      dealName: deal.company,
      actorId: actor.id,
      actorName: actor.name,
      metadata: { fromStage, toStage, source: 'simulation' },
    })
    pushToast({
      tone: 'danger',
      title: 'Failure simulated',
      message: `${deal.company} could not be saved.`,
    })
  }, [moveLocal, openDeal, openedDealId, pushActivity, pushToast, selectedIds])

  const toggleSelect = useCallback((dealId, options = {}) => {
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
    setSelectedIds((current) => {
      const next = new Set(current)
      for (let i = start; i <= end; i += 1) next.add(ids[i])
      return next
    })
  }, [])

  const selectMany = useCallback((ids) => {
    setSelectedIds(new Set(ids))
  }, [])

  const clearSelection = useCallback(() => setSelectedIds(new Set()), [])

  const bulkMove = useCallback(async (ids, toStage, options = {}) => {
    const jobs = []
    for (const id of ids) {
      const deal = dealsRef.current[id]
      if (!deal) continue
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
      if (!sameStage) deal.stage = toStage
    }
    if (jobs.length === 0) return

    if (!options.resubmit) {
      setStageIds((current) => applyBulkMoveToStageIds(current, jobs.map((job) => job.id), toStage))
    }
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
    })

    const actor = currentUserRef.current
    pushActivity({
      type: ACTIVITY_TYPES.BULK_OPERATION_STARTED,
      actorId: actor.id,
      actorName: actor.name,
      metadata: { total: jobs.length, toStage },
    })

    setBulkJob({ toStage, total: jobs.length, completed: 0, failedCount: 0, running: true, failedIds: [] })
    let lastUi = 0
    let completed = 0

    const failed = await runPool(
      jobs,
      async (job) => fakeApi.moveDeal({ id: job.id, toStage, clientVersion: job.clientVersion }),
      BULK_CONCURRENCY,
      (done, failedCount) => {
        completed = done
        const now = Date.now()
        if (now - lastUi > 80 || done === jobs.length) {
          lastUi = now
          setBulkJob((current) => current && { ...current, completed: done, failedCount })
        }
      },
    )

    const failedIds = []
    const actorNow = currentUserRef.current
    setOverlays((current) => {
      const next = copyOverlays(current)
      for (const job of jobs) {
        delete next.pending[job.id]
        delete pendingRef.current[job.id]
      }
      for (const entry of failed) {
        const job = entry.item
        failedIds.push(job.id)
        if (entry.result?.error === 'CONFLICT') {
          next.conflicts[job.id] = {
            localStage: toStage,
            fromStage: job.fromStage,
            serverDeal: entry.result.serverDeal,
            actorName: 'A teammate',
            actorId: '',
          }
        } else {
          next.failed[job.id] = { fromStage: job.fromStage, toStage, clientVersion: job.clientVersion }
        }
      }
      for (const job of jobs) {
        if (!failedIds.includes(job.id)) {
          const fresh = fakeApi.getDeal(job.id)
          if (fresh) {
            applyDealSnapshot(fresh)
            next.saved[job.id] = true
          }
        }
      }
      return next
    })

    setBulkJob({
      toStage,
      total: jobs.length,
      completed,
      failedCount: failed.length,
      running: false,
      failedIds,
    })
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
  }, [applyDealSnapshot, clearSelection, overlays.failed, pushActivity, pushToast])

  const requestMove = useCallback((dealId, toStage) => {
    const deal = dealsRef.current[dealId]
    if (!deal || deal.stage === toStage) return
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
    const movable = []
    for (const id of ids) {
      const deal = dealsRef.current[id]
      if (!deal || deal.stage === toStage || !canMoveStage(deal.stage, toStage)) continue
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
  }, [bulkMove, pushToast])

  const retryBulkFailed = useCallback(() => {
    if (!bulkJob?.failedIds?.length) return
    return bulkMove(bulkJob.failedIds, bulkJob.toStage, { resubmit: true, allowBackward: true })
  }, [bulkJob, bulkMove])

  const visibleStageIds = useMemo(() => {
    if (!stageIds) return null
    const next = {}
    for (const stage of STAGES) {
      const ids = []
      for (const id of stageIds[stage.id]) {
        const deal = dealsRef.current[id]
        if (!deal) continue
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

  const unfilteredCounts = useMemo(() => {
    if (!stageIds) return {}
    return Object.fromEntries(STAGES.map((stage) => [stage.id, stageIds[stage.id].length]))
  }, [stageIds])

  const summaries = useMemo(() => {
    if (!stageIds) {
      return { totalDeals: 0, pipelineValue: 0, wonThisMonth: 0, needsAttention: 0, myDeals: 0 }
    }
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)
    const monthStartMs = monthStart.getTime()

    let pipelineValue = 0
    let wonThisMonth = 0
    let needsAttention = 0
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
        if (isNeedsAttention(deal, overlays)) needsAttention += 1
      }
    }

    return { totalDeals, pipelineValue, wonThisMonth, needsAttention, myDeals }
  }, [currentUser.name, overlays, stageIds])

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
      selectedIds,
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
      ready,
      requestBulkMove,
      requestMove,
      resolveConflict,
      retryBulkFailed,
      retryDeal,
      selectMany,
      selectRange,
      selectedIds,
      setCurrentUser,
      simulation,
      simulationOpen,
      stageIds,
      summaries,
      toggleSelect,
      undoLast,
      unfilteredCounts,
      updateSimulation,
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
