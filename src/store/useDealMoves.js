import { useCallback } from 'react'
import { pipelineApi } from '../api/pipelineApi.js'
import { STAGE_BY_ID } from '../data/constants.js'
import { useToasts } from '../components/common/Toast.jsx'
import { createRealtimeEvent } from '../services/realtimeChannel.js'
import { ACTIVITY_TYPES } from '../utils/activity.js'
import { canMoveStage } from '../utils/stageOrder.js'
import { actorFromName, payloadActorName } from './pipelineActors.js'
import {
  beginDealPending,
  clearDealPending,
  clearDealResolution,
  markDealConflict,
  markDealFailed,
  markDealSaved,
  clearSavedFlags,
  discardFailedOverlay,
} from './pipelineOverlays.js'
import { applyDealSnapshot, moveDealLocal, writeDealSnapshot } from './pipelineSnapshots.js'
import * as stageLists from './stageLists.js'

export function useDealMoves({
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
}) {
  const { pushToast } = useToasts()

  const markSaved = useCallback((dealId) => {
    window.clearTimeout(savedTimersRef.current[dealId])
    setOverlays((current) => markDealSaved(current, dealId))
    savedTimersRef.current[dealId] = window.setTimeout(() => {
      setOverlays((current) => {
        if (!current.saved[dealId]) return current
        return clearSavedFlags(current, [dealId])
      })
    }, 1800)
  }, [savedTimersRef, setOverlays])

  const scheduleClearSaved = useCallback((dealIds) => {
    if (!dealIds.length) return
    const batchKey = `saved-batch-${dealIds[0]}`
    window.clearTimeout(savedTimersRef.current[batchKey])
    savedTimersRef.current[batchKey] = window.setTimeout(() => {
      setOverlays((current) => clearSavedFlags(current, dealIds))
    }, 1800)
  }, [savedTimersRef, setOverlays])

  const snapshotDeal = useCallback((deal) => (
    applyDealSnapshot(dealsRef, setStageIds, deal)
  ), [dealsRef, setStageIds])

  const persistDeal = useCallback((deal) => writeDealSnapshot(dealsRef, deal), [dealsRef])

  const moveLocal = useCallback((dealId, toStage) => (
    moveDealLocal(dealsRef, setStageIds, dealId, toStage)
  ), [dealsRef, setStageIds])

  const moveDeal = useCallback(async (dealId, toStage, options = {}) => {
    const deal = dealsRef.current[dealId]
    if (!deal) return
    if (pendingRef.current[dealId]) return
    const alreadyThere = deal.stage === toStage
    if (alreadyThere && !options.resubmit) return

    const fromStage = options.fromStage || deal.stage
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
    setOverlays((current) => beginDealPending(current, dealId, pendingRef.current[dealId]))
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
      snapshotDeal(result.deal)
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

    if (result.error === 'CANCELLED') {
      setOverlays((current) => clearDealPending(current, dealId))
      return result
    }

    if (result.error === 'CONFLICT') {
      if (dealsRef.current[dealId]?.stage !== previousStage) moveLocal(dealId, previousStage)
      const serverDeal = result.serverDeal
      const other = actorFromName(payloadActorName(serverDeal, result.actorName || options.actorName))
      setOverlays((current) => markDealConflict(current, dealId, {
        localStage: toStage,
        fromStage: previousStage,
        serverDeal,
        actorName: other.name,
        actorId: other.id,
      }))
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
    setOverlays((current) => markDealFailed(current, dealId, { fromStage: previousStage, toStage, clientVersion }))
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
  }, [
    currentUserRef,
    dealsRef,
    lastUndoRef,
    markSaved,
    moveLocal,
    pendingRef,
    publishRealtime,
    pushActivity,
    pushToast,
    setOverlays,
    snapshotDeal,
  ])

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
  }, [dealsRef, moveDeal, overlays.failed])

  const discardFailed = useCallback((dealId) => {
    const failed = overlays.failed[dealId]
    const deal = dealsRef.current[dealId]
    if (!failed || !deal) return
    if (deal.stage !== failed.fromStage) moveLocal(dealId, failed.fromStage)
    setOverlays((current) => discardFailedOverlay(current, dealId))
  }, [dealsRef, moveLocal, overlays.failed, setOverlays])

  const resolveConflict = useCallback(async (dealId, choice) => {
    const conflict = overlays.conflicts[dealId]
    if (!conflict) return
    const actor = currentUserRef.current
    const deal = dealsRef.current[dealId]

    if (choice === 'server') {
      const serverDeal = conflict.serverDeal
      const localStage = dealsRef.current[dealId].stage
      snapshotDeal(serverDeal)
      pipelineApi.applyRemoteDeal(serverDeal)
      if (localStage !== serverDeal.stage) {
        setStageIds((current) => stageLists.applyMoveToStageIds(current, dealId, localStage, serverDeal.stage))
      }
      setOverlays((current) => clearDealResolution(current, dealId))
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
      snapshotDeal(result.deal)
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
    if (result.error === 'CANCELLED') return
  }, [
    currentUserRef,
    dealsRef,
    markSaved,
    overlays.conflicts,
    publishRealtime,
    pushActivity,
    pushToast,
    setOverlays,
    setStageIds,
    snapshotDeal,
  ])

  const undoLast = useCallback(() => {
    const last = lastUndoRef.current
    if (!last) return
    moveDeal(last.dealId, last.fromStage, { undoable: false, allowBackward: true })
    lastUndoRef.current = null
  }, [lastUndoRef, moveDeal])

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
  }, [dealsRef, moveDeal, pendingRef, pushToast])

  return {
    moveDeal,
    retryDeal,
    discardFailed,
    resolveConflict,
    undoLast,
    requestMove,
    markSaved,
    scheduleClearSaved,
    persistDeal,
    snapshotDeal,
  }
}
