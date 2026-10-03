import { useCallback, useState } from 'react'
import { pipelineApi } from '../api/pipelineApi.js'
import { BULK_CONCURRENCY, STAGE_BY_ID } from '../data/constants.js'
import { useToasts } from '../components/common/Toast.jsx'
import { ACTIVITY_TYPES } from '../utils/activity.js'
import { runPool } from '../utils/concurrency.js'
import { canMoveStage } from '../utils/stageOrder.js'
import { collectFailedBulkJobs, groupRetryIdsByStage, planBulkJobs } from './bulkJobs.js'
import {
  applyBulkFinishOverlays,
  applyJobFailureOverlay,
  beginBulkPending,
  copyOverlays,
} from './pipelineOverlays.js'
import * as stageLists from './stageLists.js'

export function useBulkMoves({
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
}) {
  const { pushToast } = useToasts()
  const [bulkJob, setBulkJob] = useState(null)

  const bulkMove = useCallback(async (ids, toStage, options = {}) => {
    if (bulkRunningRef.current) return
    const jobs = planBulkJobs(ids, toStage, options, {
      getDeal: (id) => dealsRef.current[id],
      isPending: (id) => Boolean(pendingRef.current[id]),
      failedOverlays: overlays.failed,
    })
    if (jobs.length === 0) return

    clearSelection()

    const jobId = ++bulkJobIdRef.current
    bulkRunningRef.current = true
    const isCurrentBulk = () => bulkJobIdRef.current === jobId

    setOverlays((current) => beginBulkPending(current, jobs))
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
          applyJobFailureOverlay(next, job, result, toStage)
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

      const { failedSet, failedIds, rollbackByStage } = collectFailedBulkJobs(failed)
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
        if (fresh) persistDeal(fresh)
        succeededIds.push(job.id)
      }

      setOverlays((current) => applyBulkFinishOverlays(current, { jobs, failed, succeededIds, toStage }))
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
  }, [
    bulkJobIdRef,
    bulkRunningRef,
    clearSelection,
    currentUserRef,
    dealsRef,
    overlays.failed,
    pendingRef,
    persistDeal,
    pushActivity,
    pushToast,
    scheduleClearSaved,
    setOverlays,
    setStageIds,
  ])

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
    clearSelection()
    bulkMove(movable, toStage)
  }, [bulkMove, bulkRunningRef, clearSelection, dealsRef, overlays.failed, pendingRef, pushToast])

  const retryFailedDeals = useCallback(async (ids) => {
    const groups = groupRetryIdsByStage(ids, overlays.failed, (id) => Boolean(dealsRef.current[id]))
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
  }, [bulkMove, dealsRef, overlays.failed, pushToast])

  const retryBulkFailed = useCallback(() => {
    if (!bulkJob?.failedIds?.length) return
    return retryFailedDeals(bulkJob.failedIds)
  }, [bulkJob, retryFailedDeals])

  return {
    bulkJob,
    setBulkJob,
    bulkMove,
    requestBulkMove,
    retryFailedDeals,
    retryBulkFailed,
  }
}
