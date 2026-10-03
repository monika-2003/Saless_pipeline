import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { pipelineApi } from '../api/pipelineApi.js'
import {
  ACTIVITY_LIMIT,
  DEFAULT_SIMULATION,
  OPEN_STAGE_IDS,
  STAGES,
  SWITCHABLE_USERS,
  USER_BY_ID,
  VIEWS,
} from '../data/constants.js'
import { cloneDealsById, generatePipeline } from '../data/mockData.js'
import { useToasts } from '../components/common/Toast.jsx'
import { useDebouncedValue } from '../hooks/useDebouncedValue.js'
import {
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
  persistSeedNow,
  resetPersistedDeals,
} from '../utils/pipelinePersist.js'
import { getAttentionReason } from '../utils/attention.js'
import { nextStageSort } from '../utils/dealSort.js'
import {
  dealMatchesFilters,
  dealMatchesSearch,
  createEmptyFilters,
  matchesView,
} from '../utils/filters.js'
import { PipelineContext } from './pipelineContext.js'
import { readStoredUser, USER_STORAGE_KEY } from './pipelineActors.js'
import { useBulkMoves } from './useBulkMoves.js'
import { useDealMoves } from './useDealMoves.js'
import { useRealtimeSync } from './useRealtimeSync.js'
import * as stageLists from './stageLists.js'

const NO_OVERLAYS = stageLists.emptyOverlays()

export function PipelineProvider({ children }) {
  const dealsRef = useRef(Object.create(null))
  const pendingRef = useRef(Object.create(null))
  const lastUndoRef = useRef(null)
  const bulkRunningRef = useRef(false)
  const bulkJobIdRef = useRef(0)
  const savedTimersRef = useRef(Object.create(null))
  const currentUserRef = useRef(readStoredUser())
  const { pushToast } = useToasts()

  const [ready, setReady] = useState(false)
  const [stageIds, setStageIds] = useState(null)
  const [overlays, setOverlays] = useState({ ...stageLists.emptyOverlays(), saved: Object.create(null) })
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [pinSelected, setPinSelected] = useState(false)
  const [stageSorts, setStageSorts] = useState(() => Object.create(null))
  const [view, setView] = useState('all')
  const [layout, setLayout] = useState('board')
  const [filterDraft, setFilterDraft] = useState(createEmptyFilters)
  const [openedDealId, setOpenedDealId] = useState(null)
  const [focusedDealId, setFocusedDealId] = useState(null)
  const [simulation, setSimulation] = useState(DEFAULT_SIMULATION)
  const [activityEvents, setActivityEvents] = useState(() => loadStoredActivity(ACTIVITY_LIMIT))
  const [simulationOpen, setSimulationOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)
  const [currentUser, setCurrentUserState] = useState(readStoredUser)

  currentUserRef.current = currentUser

  useEffect(() => {
    if (!VIEWS.some((item) => item.id === view)) setView('all')
  }, [view])

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

  const { publishRealtime } = useRealtimeSync({
    dealsRef,
    pendingRef,
    currentUserRef,
    bulkRunningRef,
    setOverlays,
    setStageIds,
    pushActivity,
    ready,
    teammateEnabled: simulation.teammateEnabled,
  })

  const {
    moveDeal,
    retryDeal,
    discardFailed,
    resolveConflict,
    undoLast,
    requestMove,
    scheduleClearSaved,
    persistDeal,
  } = useDealMoves({
    dealsRef,
    pendingRef,
    lastUndoRef,
    currentUserRef,
    savedTimersRef,
    setOverlays,
    setStageIds,
    overlays,
    publishRealtime,
    pushActivity,
  })

  const clearSelection = useCallback(() => {
    setPinSelected(false)
    setSelectedIds(new Set())
  }, [])

  const {
    bulkJob,
    setBulkJob,
    bulkMove,
    requestBulkMove,
    retryFailedDeals,
    retryBulkFailed,
  } = useBulkMoves({
    dealsRef,
    pendingRef,
    currentUserRef,
    bulkRunningRef,
    bulkJobIdRef,
    overlays,
    setOverlays,
    setStageIds,
    clearSelection,
    persistDeal,
    scheduleClearSaved,
    pushActivity,
  })

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
    setStageSorts(Object.create(null))
    pushToast({
      tone: 'info',
      title: 'Demo data reset',
      message: 'The original 50,000 deals were restored.',
    })
  }, [pushToast, setBulkJob, simulation])

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
    if (bulkRunningRef.current || pendingRef.current[dealId]) return
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
    if (bulkRunningRef.current) return
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
    if (bulkRunningRef.current) return
    setPinSelected(false)
    setSelectedIds(new Set(ids))
  }, [])

  const pinSelectedToTop = useCallback(() => {
    setPinSelected((current) => !current)
  }, [])

  const setStageSort = useCallback((stageId, key) => {
    setStageSorts((current) => ({
      ...current,
      [stageId]: nextStageSort(current[stageId], key),
    }))
  }, [])

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
      stageSorts,
      setStageSort,
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
      setStageSort,
      stageSorts,
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
